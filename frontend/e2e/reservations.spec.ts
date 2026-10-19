import { test, expect, seed, login } from './fixtures';
import { Pool } from 'pg';
import type { APIRequestContext } from '@playwright/test';

const database=process.env.STUDENTMARKET_E2E_DATABASE!;
if(!/^student_market_e2e_[a-f0-9]{12}$/.test(database)) throw Error('Reservation tests require the isolated E2E database.');
const db=new Pool({host:process.env.PG_HOST,port:Number(process.env.PG_PORT||5432),user:process.env.PG_USER,password:process.env.PG_PASSWORD,database,max:2});
const listing=seed.products[8];
const meeting=()=>new Date(Date.now()+2*60*60*1000).toISOString();
const requestBody=()=>({listingId:listing.id,meetingAt:meeting(),location:'Sảnh thư viện DNTU',note:'Kiểm tra sách trước khi nhận.'});
async function identity(api:APIRequestContext,name:string) {
  const account=seed.accounts[name];
  const response=await api.post('/api/auth/login',{data:{email:account.email,password:account.password}});
  expect(response.status()).toBe(200);
}
test.afterEach(async()=>{
  await db.query('DELETE FROM transactions WHERE listing_id=$1',[listing.id]);
  await db.query('DELETE FROM listing_reservations WHERE listing_id=$1',[listing.id]);
  await db.query("UPDATE products SET status='Active',moderation_status='APPROVED' WHERE id=$1",[listing.id]);
});
test.afterAll(async()=>{await db.end();});

test('giữ chỗ: đặt lịch, người bán xác nhận và giao, người mua xác nhận nhận hàng',async({page,browser},info)=>{
  const buyer=seed.accounts[info.project.name];
  await login(page,buyer);await page.goto('/listing/'+listing.id);
  const panel=page.getByRole('region',{name:'Giữ chỗ và lịch hẹn'});
  await panel.getByRole('button',{name:'Yêu cầu giữ chỗ & đặt lịch',exact:true}).click();
  const local=new Date(Date.now()+2*3600000+7*3600000).toISOString().slice(0,16);
  await panel.getByLabel('Thời gian gặp (giờ Việt Nam)').fill(local);
  await panel.getByLabel('Địa điểm công cộng').fill('Sảnh thư viện DNTU');
  await panel.getByLabel('Ghi chú cho người bán').fill('Kiểm tra sách trước khi nhận.');
  await panel.getByRole('button',{name:'Gửi yêu cầu giữ chỗ',exact:true}).click();
  await expect(panel.getByText('Chờ người bán xác nhận',{exact:true})).toBeVisible();
  const sellerContext=await browser.newContext({baseURL:process.env.STUDENTMARKET_E2E_BASE_URL});
  try {
    const seller=await sellerContext.newPage();await login(seller,seed.accounts.seller);await seller.goto('/transactions');
    const card=seller.getByRole('article',{name:'Lịch hẹn '+listing.title});
    await card.getByRole('button',{name:'Xác nhận & giữ chỗ',exact:true}).click();
    await expect(card.getByText('Đang giữ chỗ',{exact:true})).toBeVisible();
    await panel.getByRole('button',{name:'Làm mới lịch',exact:true}).click();
    await expect(panel.getByText('Đang giữ chỗ',{exact:true})).toBeVisible();
    const product=await (await page.request.get('/api/products/'+listing.id)).json();expect(product.product.reservedUntil).toBeTruthy();
    await card.getByRole('button',{name:'Đã giao cho người mua',exact:true}).click();
    await card.getByRole('button',{name:'Đồng ý xác nhận',exact:true}).click();
    await expect(card).not.toBeVisible();
    await page.goto('/transactions');
    await page.getByRole('button',{name:'Tôi đã nhận hàng',exact:true}).click();
    await expect(page.getByText('Hoàn tất',{exact:true})).toBeVisible();
    const result=await db.query("SELECT status FROM transactions WHERE listing_id=$1",[listing.id]);expect(result.rows[0].status).toBe('COMPLETED');
    const notices=await (await page.request.get('/api/notifications')).json();
    expect(notices.notifications.some((n:{title:string})=>n.title==='Người bán đã xác nhận lịch hẹn')).toBe(true);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  } finally {await sellerContext.close();}
});

test('giữ chỗ: chỉ một người được chấp nhận khi hai yêu cầu chạy đồng thời',async({playwright})=>{
  const contexts=await Promise.all(['desktop','mobile','seller'].map(()=>playwright.request.newContext({baseURL:process.env.STUDENTMARKET_E2E_BASE_URL})));
  try {
    await Promise.all(contexts.map((api,i)=>identity(api,['desktop','mobile','seller'][i])));
    const [a,b]=await Promise.all(contexts.slice(0,2).map(api=>api.post('/api/reservations',{data:requestBody()})));
    expect(a.status()).toBe(201);expect(b.status()).toBe(201);
    const [ra,rb]=await Promise.all([a.json(),b.json()]);
    const accepted=await Promise.all([ra.id,rb.id].map(id=>contexts[2].patch('/api/reservations/'+id,{data:{action:'accept'}})));
    expect(accepted.map(r=>r.status()).sort()).toEqual([200,409]);
    const rows=await db.query("SELECT status,count(*)::int AS n FROM listing_reservations WHERE listing_id=$1 GROUP BY status",[listing.id]);
    expect(rows.rows.find(r=>r.status==='CONFIRMED')?.n).toBe(1);expect(rows.rows.find(r=>r.status==='REJECTED')?.n).toBe(1);
    const confirmed=(await db.query("SELECT buyer_id FROM listing_reservations WHERE listing_id=$1 AND status='CONFIRMED'",[listing.id])).rows[0];
    const other=confirmed.buyer_id===seed.accounts.desktop.userId?seed.accounts.mobile.userId:seed.accounts.desktop.userId;
    const blocked=await contexts[2].post('/api/listings/'+listing.id+'/mark-sold',{data:{viaSangTay:true,buyerId:other}});
    expect(blocked.status()).toBe(409);
  } finally {await Promise.all(contexts.map(api=>api.dispose()));}
});

test('giữ chỗ: quyền riêng tư, từ chối, hủy và đặt lại',async({playwright})=>{
  const apis=await Promise.all(['desktop','mobile','seller','admin'].map(()=>playwright.request.newContext({baseURL:process.env.STUDENTMARKET_E2E_BASE_URL})));
  try {
    await Promise.all(apis.map((api,i)=>identity(api,['desktop','mobile','seller','admin'][i])));
    expect((await apis[2].post('/api/reservations',{data:requestBody()})).status()).toBe(400);
    expect((await apis[3].post('/api/reservations',{data:requestBody()})).status()).toBe(403);
    expect((await apis[0].post('/api/reservations',{data:requestBody(),headers:{Origin:'https://evil.invalid'}})).status()).toBe(403);
    const created=await apis[0].post('/api/reservations',{data:requestBody()});expect(created.status()).toBe(201);const {id}=await created.json();
    expect((await apis[0].post('/api/reservations',{data:requestBody()})).status()).toBe(409);
    expect((await (await apis[1].get('/api/reservations?listingId='+listing.id)).json()).reservations).toHaveLength(0);
    expect((await apis[1].patch('/api/reservations/'+id,{data:{action:'cancel'}})).status()).toBe(404);
    expect((await apis[0].patch('/api/reservations/'+id,{data:{action:'accept'}})).status()).toBe(403);
    expect((await apis[2].patch('/api/reservations/'+id,{data:{action:'reject'}})).status()).toBe(200);
    const second=await (await apis[0].post('/api/reservations',{data:requestBody()})).json();
    expect((await apis[2].patch('/api/reservations/'+second.id,{data:{action:'accept'}})).status()).toBe(200);
    expect((await apis[0].patch('/api/reservations/'+second.id,{data:{action:'cancel'}})).status()).toBe(200);
    expect((await apis[1].post('/api/reservations',{data:requestBody()})).status()).toBe(201);
  } finally {await Promise.all(apis.map(api=>api.dispose()));}
});

test('giữ chỗ: thời gian hợp lệ, tự hết hạn và vô hiệu khi tin bị ẩn',async({playwright})=>{
  const buyer=await playwright.request.newContext({baseURL:process.env.STUDENTMARKET_E2E_BASE_URL});
  const seller=await playwright.request.newContext({baseURL:process.env.STUDENTMARKET_E2E_BASE_URL});
  try {
    await identity(buyer,'desktop');await identity(seller,'seller');
    for(const meetingAt of [new Date(Date.now()-60000).toISOString(),new Date(Date.now()+8*86400000).toISOString(),'invalid']) {
      expect((await buyer.post('/api/reservations',{data:{...requestBody(),meetingAt}})).status()).toBe(400);
    }
    const {id}=await (await buyer.post('/api/reservations',{data:requestBody()})).json();
    await seller.patch('/api/reservations/'+id,{data:{action:'accept'}});
    await db.query("UPDATE listing_reservations SET expires_at=NOW()-INTERVAL '1 minute' WHERE id=$1",[id]);
    const state=await (await buyer.get('/api/reservations?listingId='+listing.id)).json();
    expect(state.heldUntil).toBeNull();expect(state.reservations[0].status).toBe('EXPIRED');
    expect((await seller.patch('/api/reservations/'+id,{data:{action:'complete'}})).status()).toBe(409);
    expect((await buyer.post('/api/reservations',{data:requestBody()})).status()).toBe(201);
    await db.query("UPDATE products SET status='Hidden' WHERE id=$1",[listing.id]);
    expect((await buyer.post('/api/reservations',{data:requestBody()})).status()).toBe(409);
    await db.query("UPDATE products SET status='Active' WHERE id=$1",[listing.id]);
    expect((await db.query("SELECT count(*)::int n FROM listing_reservations WHERE listing_id=$1 AND status IN ('PENDING','CONFIRMED')",[listing.id])).rows[0].n).toBe(0);
  } finally {await buyer.dispose();await seller.dispose();}
});
