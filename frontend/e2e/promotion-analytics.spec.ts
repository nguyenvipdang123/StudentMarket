import {test,expect,seed,login} from './fixtures';
import {Pool} from 'pg';
import type {APIRequestContext} from '@playwright/test';
import {readFile} from 'node:fs/promises';

const database=process.env.STUDENTMARKET_E2E_DATABASE!;
if(!/^student_market_e2e_[a-f0-9]{12}$/.test(database))throw Error('Promotion analytics tests require an isolated database.');
const db=new Pool({host:process.env.PG_HOST,port:Number(process.env.PG_PORT||5432),user:process.env.PG_USER,password:process.env.PG_PASSWORD,database,max:2});
const listing=seed.products[7],owner=seed.accounts.seller.userId!;
let packageId:number;
async function identity(api:APIRequestContext,name:string){const account=seed.accounts[name];expect((await api.post('/api/auth/login',{data:{email:account.email,password:account.password}})).status()).toBe(200);}
async function promotion(active=false){
  return (await db.query(`INSERT INTO listing_promotions(listing_id,user_id,package_id,status,start_at,end_at,price,payment_status,package_name_snapshot,priority_snapshot)
    VALUES($1,$2,$3,'ACTIVE',date_trunc('hour',NOW())-$4::interval,date_trunc('hour',NOW())-$4::interval+INTERVAL '24 hours',5000,'PAID','Gói đẩy E2E',1) RETURNING *`,[listing.id,owner,packageId,active?'2 hours':'48 hours'])).rows[0];
}
async function view(at:Date,user:string|null=null){await db.query("INSERT INTO listing_analytics(listing_id,event_type,user_id,visitor_id,created_at) VALUES($1,'VIEW',$2,gen_random_uuid()::text,$3)",[listing.id,user,at]);}
async function sampleHistory(p:{start_at:Date;end_at:Date}){
  const start=p.start_at.getTime(),end=p.end_at.getTime();
  for(const timestamp of [start-86400000-1,start-86400000,start-1,start,start+3600000,end-1,end,end+1,Date.now()+86400000])await view(new Date(timestamp));
  await view(new Date(start+3600000),owner);
  // A removed save stays in its original period; repeated saves count once per person per period.
  for(const [person,timestamp] of [[seed.accounts.desktop.userId,start-3600000],[seed.accounts.desktop.userId,start+3600000],[seed.accounts.mobile.userId,start+7200000],[seed.accounts.desktop.userId,start+7200000]] as const){
    await db.query('DELETE FROM favorites WHERE user_id=$1 AND product_id=$2',[person,listing.id]);
    await db.query('INSERT INTO favorites(user_id,product_id,created_at) VALUES($1,$2,$3)',[person,listing.id,new Date(timestamp)]);
  }
  for(const name of ['desktop','mobile','sellerUEH']){
    const buyer=seed.accounts[name].userId!;
    const c=(await db.query('INSERT INTO conversations(id,product_id,buyer_id,seller_id) VALUES(gen_random_uuid(),$1,$2,$3) RETURNING id',[listing.id,buyer,owner])).rows[0];
    if(name==='sellerUEH')continue; // An empty conversation is not a contact.
    if(name==='desktop')await db.query('INSERT INTO messages(id,conversation_id,sender_id,content,sent_at) VALUES(gen_random_uuid(),$1,$2,$3,$4)',[c.id,buyer,'Tin nhắn trước đẩy',new Date(start-1800000)]);
    for(const minutes of [10,20])await db.query('INSERT INTO messages(id,conversation_id,sender_id,content,sent_at) VALUES(gen_random_uuid(),$1,$2,$3,$4)',[c.id,buyer,'Tin nhắn trong đẩy',new Date(start+minutes*60000)]);
    await db.query('INSERT INTO messages(id,conversation_id,sender_id,content,sent_at) VALUES(gen_random_uuid(),$1,$2,$3,$4)',[c.id,owner,'Người bán trả lời',new Date(start+3600000)]);
    await db.query('INSERT INTO messages(id,conversation_id,sender_id,content,sent_at) VALUES(gen_random_uuid(),$1,$2,$3,$4)',[c.id,buyer,'Tin nhắn đúng lúc hết hạn',p.end_at]);
  }
}
test.beforeEach(async()=>{
  packageId=(await db.query("INSERT INTO promotion_packages(name,duration_hours,price,priority) VALUES('Gói thống kê kiểm thử',24,5000,1) RETURNING id")).rows[0].id;
  await db.query("UPDATE products SET created_at=NOW()-INTERVAL '30 days',view_count=987654,status='Active',moderation_status='APPROVED' WHERE id=$1",[listing.id]);
  await db.query("UPDATE analytics_tracking SET started_at=NOW()-INTERVAL '60 days' WHERE event_type='FAVORITE'");
});
test.afterEach(async()=>{
  await db.query('DELETE FROM listing_promotions WHERE listing_id=$1',[listing.id]);
  await db.query('DELETE FROM favorites WHERE product_id=$1',[listing.id]);
  await db.query('DELETE FROM conversations WHERE product_id=$1',[listing.id]);
  await db.query('DELETE FROM listing_analytics WHERE listing_id=$1',[listing.id]);
  await db.query('DELETE FROM promotion_packages WHERE id=$1',[packageId]);
});
test.afterAll(async()=>{await db.end();});

test('hiệu quả: hai khoảng bằng nhau, đúng ranh giới, xem lại gói hết hạn trên desktop/mobile',async({page},info)=>{
  const p=await promotion();await sampleHistory(p);
  await db.query(`INSERT INTO listing_promotions(listing_id,user_id,package_id,status,start_at,end_at,price,payment_status,package_name_snapshot)
    VALUES($1,$2,$3,'EXPIRED',NOW()-INTERVAL '12 days',NOW()-INTERVAL '11 days',5000,'PAID','Gói cũ kiểm thử')`,[listing.id,owner,packageId]);
  await login(page,seed.accounts.seller);
  const response=await page.request.get('/api/my-promotions/'+p.id+'/analytics');expect(response.status()).toBe(200);expect(response.headers()['cache-control']).toContain('no-store');
  const data=await response.json();expect(data.status).toBe('EXPIRED');expect(data.durationSeconds).toBe(86400);
  expect(data.before.metrics).toEqual({views:2,favorites:1,contacts:1});expect(data.during.metrics).toEqual({views:3,favorites:2,contacts:2});
  expect(data.change.views).toEqual({difference:1,percent:50});expect(data.change.favorites.percent).toBe(100);
  expect(data.startAt).toBe(p.start_at.toISOString());expect(data.endAt).toBe(p.end_at.toISOString());
  expect(data.before.to).toBe(data.during.from);expect(Date.parse(data.before.to)-Date.parse(data.before.from)).toBe(Date.parse(data.during.to)-Date.parse(data.during.from));
  // Rerunning migration neither duplicates recovered saves nor resets coverage.
  await db.query(await readFile('scripts/promotion-analytics-schema.sql','utf8'));
  expect((await (await page.request.get('/api/my-promotions/'+p.id+'/analytics')).json()).during.metrics.favorites).toBe(2);
  await page.goto('/my-listings');
  const card=page.locator('.figma-owned-card').filter({has:page.getByRole('heading',{name:listing.title,exact:true})});
  await card.getByRole('button',{name:'Xem hiệu quả',exact:true}).click();
  const modal=page.getByRole('dialog',{name:'Hiệu quả đẩy tin',exact:true});await expect(modal.getByText('Đã hết hạn',{exact:true})).toBeVisible();
  await expect(modal.getByText('Hết hạn lúc',{exact:true})).toBeVisible();
  const table=modal.getByRole('table');await expect(table.getByRole('row',{name:/Lượt xem/})).toContainText('3');
  await expect(table.getByRole('row',{name:/Lượt xem/})).toContainText('+50%');
  await expect(modal.getByText('987.654',{exact:true})).toHaveCount(0);
  await expect.poll(()=>modal.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
  await page.screenshot({path:info.outputPath('promotion-performance.png')});
  await modal.getByLabel('Gói đã mua').selectOption({label:(await modal.getByLabel('Gói đã mua').locator('option').allTextContents()).find(text=>text.includes('Gói cũ kiểm thử'))!});
  await expect(modal.locator('section[aria-label="Thời hạn gói đẩy tin"]')).toContainText('Gói cũ kiểm thử');
  await page.keyboard.press('Escape');await expect(modal).not.toBeVisible();
  await expect(card.getByRole('button',{name:'Xem hiệu quả',exact:true})).toBeFocused();
});

test('hiệu quả: sự kiện thực tế, chống xem lặp, bỏ lưu và nhiều tin nhắn không làm phồng số người',async({playwright})=>{
  const p=await promotion(true);
  const contexts=await Promise.all(['seller','desktop','mobile'].map(()=>playwright.request.newContext({baseURL:process.env.STUDENTMARKET_E2E_BASE_URL})));
  try{
    await Promise.all(contexts.map((api,i)=>identity(api,['seller','desktop','mobile'][i])));
    const url='/api/my-promotions/'+p.id+'/analytics';
    expect((await (await contexts[1].post('/api/analytics/event',{data:{listingId:listing.id,eventType:'VIEW'}})).json()).recorded).toBe(true);
    expect((await (await contexts[1].post('/api/analytics/event',{data:{listingId:listing.id,eventType:'VIEW'}})).json()).recorded).toBe(false);
    expect((await (await contexts[0].post('/api/analytics/event',{data:{listingId:listing.id,eventType:'VIEW'}})).json()).recorded).toBe(false);
    for(let n=0;n<3;n++)expect((await contexts[1].post('/api/favorites',{data:{productId:listing.id}})).status()).toBe(200);
    const c=await (await contexts[2].post('/api/conversations',{data:{listingId:listing.id}})).json();
    expect((await (await contexts[0].get(url)).json()).during.metrics.contacts).toBe(0);
    for(const api of [contexts[2],contexts[2],contexts[0]])expect((await api.post('/api/conversations/'+c.id+'/messages',{data:{content:'Tin nhắn kiểm thử thống kê thực tế.'}})).status()).toBe(201);
    await view(new Date(Date.now()+3600000));
    const result=await (await contexts[0].get(url)).json();
    expect(result.during.metrics).toEqual({views:1,favorites:1,contacts:1});
    expect(result.before.metrics).toEqual({views:0,favorites:0,contacts:0});expect(result.change.views.percent).toBeNull();
    expect(Math.abs((Date.parse(result.before.to)-Date.parse(result.before.from))-(Date.parse(result.during.to)-Date.parse(result.during.from)))).toBeLessThanOrEqual(1);
    expect(result.during.to).not.toBe(result.endAt);
  }finally{await Promise.all(contexts.map(api=>api.dispose()));}
});

test('hiệu quả: quyền riêng tư, gói chưa thanh toán, lịch sử thiếu và lỗi tải có thể thử lại',async({page,playwright})=>{
  const p=await promotion();await sampleHistory(p);
  await db.query('UPDATE products SET created_at=$2 WHERE id=$1',[listing.id,new Date(p.start_at.getTime()-3600000)]);
  await db.query("UPDATE analytics_tracking SET started_at=NOW() WHERE event_type='FAVORITE'");
  await db.query(`INSERT INTO listing_promotions(listing_id,user_id,package_id,status,start_at,end_at,price,payment_status)
    VALUES($1,$2,$3,'EXPIRED',$4::timestamptz-INTERVAL '6 hours',$4::timestamptz-INTERVAL '1 hour',5000,'PAID')`,[listing.id,owner,packageId,p.start_at]);
  const pending=(await db.query("INSERT INTO listing_promotions(listing_id,user_id,package_id,price) VALUES($1,$2,$3,5000) RETURNING id",[listing.id,owner,packageId])).rows[0].id;
  const foreign=await playwright.request.newContext({baseURL:process.env.STUDENTMARKET_E2E_BASE_URL});
  const url='/api/my-promotions/'+p.id+'/analytics';
  try{
    expect((await foreign.get(url)).status()).toBe(401);await identity(foreign,'desktop');expect((await foreign.get(url)).status()).toBe(404);
    expect((await (await foreign.get('/api/my-promotions?listingId='+listing.id)).json()).promotions).toHaveLength(0);
    await login(page,seed.accounts.seller);
    expect((await page.request.get('/api/my-promotions/not-a-uuid/analytics')).status()).toBe(404);
    expect((await page.request.get('/api/my-promotions?listingId=bad')).status()).toBe(400);
    expect((await page.request.get('/api/my-promotions/'+pending+'/analytics')).status()).toBe(404);
    const data=await (await page.request.get(url)).json();
    expect(data.coverage).toMatchObject({shortHistory:true,previousPromotion:true,favoritesPartial:true});expect(data.change.views.percent).toBeNull();expect(data.change.favorites.percent).toBeNull();
    let fail=true;await page.route('**/api/my-promotions/*/analytics',route=>fail?(fail=false,route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Lỗi tải thống kê kiểm thử.'})})):route.continue());
    await page.goto('/my-listings');const card=page.locator('.figma-owned-card').filter({has:page.getByRole('heading',{name:listing.title,exact:true})});
    await card.getByRole('button',{name:'Xem hiệu quả',exact:true}).click();const modal=page.getByRole('dialog',{name:'Hiệu quả đẩy tin',exact:true});
    await expect(modal.getByRole('alert')).toContainText('Lỗi tải thống kê kiểm thử.');await expect(modal.getByRole('table')).toHaveCount(0);
    await modal.getByRole('button',{name:'Thử lại',exact:true}).click();await expect(modal.getByRole('table')).toBeVisible();await expect(modal.getByText('Chưa đủ dữ liệu so sánh',{exact:true})).toHaveCount(3);
    await expect(modal.getByText(/Lịch sử lưu tin trước/)).toBeVisible();
  }finally{await foreign.dispose();}
});

test('hiệu quả: gói hủy chốt tại thời điểm dừng, không cộng sự kiện về sau',async({page})=>{
  const p=await promotion();await sampleHistory(p);
  await db.query("UPDATE listing_promotions SET status='CANCELLED',updated_at=start_at+INTERVAL '6 hours' WHERE id=$1",[p.id]);
  await view(new Date(p.start_at.getTime()+7*3600000));
  await login(page,seed.accounts.seller);
  const data=await (await page.request.get('/api/my-promotions/'+p.id+'/analytics')).json();expect(data.status).toBe('CANCELLED');expect(data.durationSeconds).toBe(21600);expect(data.during.metrics.views).toBe(2);
  expect(data.during.to).toBe(new Date(p.start_at.getTime()+6*3600000).toISOString());
});
