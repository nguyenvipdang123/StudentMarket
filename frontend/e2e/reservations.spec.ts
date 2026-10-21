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
  await db.query('DELETE FROM reviews WHERE product_id=$1',[listing.id]);
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
    await expect(card.getByRole('button',{name:'Đã giao cho người mua',exact:true})).toBeDisabled();
    expect((await seller.request.patch('/api/reservations/'+(await (await seller.request.get('/api/reservations')).json()).reservations.find((r:{listingId:string})=>r.listingId===listing.id).id,{data:{action:'complete'}})).status()).toBe(409);
    // Advance only the isolated appointment to after its agreed meeting time.
    await db.query("UPDATE listing_reservations SET meeting_at=NOW()-INTERVAL '1 minute' WHERE listing_id=$1",[listing.id]);
    await seller.getByRole('button',{name:'Làm mới lịch',exact:true}).click();
    await card.getByRole('button',{name:'Đã giao cho người mua',exact:true}).click();
    await card.getByRole('button',{name:'Đồng ý xác nhận',exact:true}).click();
    await expect(card.getByText('Đã giao · Chờ xác nhận giao dịch',{exact:true})).toBeVisible();
    const transaction=(await db.query('SELECT * FROM transactions WHERE listing_id=$1',[listing.id])).rows[0];
    expect(transaction.reservation_id).toBeTruthy();expect(transaction.seller_confirmed_at).toBeTruthy();expect(transaction.buyer_confirmed_at).toBeNull();
    expect((await page.request.post('/api/reviews',{data:{transactionId:transaction.id,rating:5,content:'Chưa nhận hàng nên không được đánh giá.'}})).status()).toBe(403);
    await page.goto('/transactions');
    const sale=page.getByRole('article',{name:'Giao dịch '+listing.title,exact:true});
    await expect(sale.getByRole('button',{name:'Gửi đánh giá',exact:true})).toHaveCount(0);
    await sale.getByRole('button',{name:'Tôi đã nhận hàng',exact:true}).click();
    await sale.getByRole('button',{name:'Xác nhận đã nhận hàng',exact:true}).click();
    await expect(sale.getByText('Hoàn tất',{exact:true})).toBeVisible();
    await sale.scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('transaction-completed.png'),fullPage:true});
    const result=await db.query("SELECT status FROM transactions WHERE listing_id=$1",[listing.id]);expect(result.rows[0].status).toBe('COMPLETED');
    await sale.getByLabel('Nội dung đánh giá').fill('Người bán đúng hẹn, món đồ đúng mô tả.');
    await sale.getByRole('button',{name:'Gửi đánh giá',exact:true}).click();
    await expect(sale.getByText('Bạn đã đánh giá giao dịch này.',{exact:false})).toBeVisible();
    await page.reload();await expect(sale.getByRole('button',{name:'Gửi đánh giá',exact:true})).toHaveCount(0);
    const myReview=(await (await page.request.get('/api/reviews')).json()).reviews.find((r:{transactionId:string})=>r.transactionId===transaction.id);
    expect(myReview.verifiedTransaction).toBe(true);expect(myReview.targetRole).toBe('Người bán');
    expect((await page.request.post('/api/reviews',{data:{transactionId:transaction.id,rating:5,content:'Không được gửi đánh giá trùng.'}})).status()).toBe(409);
    await seller.getByRole('button',{name:'Làm mới giao dịch',exact:true}).click();
    const sellerSale=seller.getByRole('article',{name:'Giao dịch '+listing.title,exact:true});
    await expect(sellerSale.getByText('Hoàn tất',{exact:true})).toBeVisible();
    await sellerSale.getByLabel('Nội dung đánh giá').fill('Người mua đến đúng hẹn, giao dịch thuận lợi.');
    await sellerSale.getByRole('button',{name:'Gửi đánh giá',exact:true}).click();
    await expect(sellerSale.getByText('Bạn đã đánh giá giao dịch này.',{exact:false})).toBeVisible();
    const sellerReview=(await (await seller.request.get('/api/reviews')).json()).reviews.find((r:{transactionId:string})=>r.transactionId===transaction.id);
    expect(sellerReview.targetRole).toBe('Người mua');
    const notices=await (await page.request.get('/api/notifications')).json();
    expect(notices.notifications.some((n:{title:string})=>n.title==='Người bán đã xác nhận lịch hẹn')).toBe(true);
    expect(notices.notifications.some((n:{title:string})=>n.title==='Hai bên đã xác nhận giao dịch hoàn tất')).toBe(true);
    const sellerNotices=await (await seller.request.get('/api/notifications')).json();
    expect(sellerNotices.notifications.some((n:{title:string})=>n.title==='Hai bên đã xác nhận giao dịch hoàn tất')).toBe(true);
    await page.goto('/seller/'+seed.accounts.seller.userId);
    await page.getByRole('tab',{name:/Đánh giá \(/}).click();
    await expect(page.getByText('Giao dịch đã được hai bên xác nhận',{exact:true})).toBeVisible();
    await page.screenshot({path:info.outputPath('verified-review.png'),fullPage:true});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  } finally {await sellerContext.close();}
});

test('giao dịch: quyền xác nhận, gửi lặp, hủy và đánh giá đúng giao dịch',async({playwright})=>{
  const apis=await Promise.all(['desktop','mobile','seller','admin'].map(()=>playwright.request.newContext({baseURL:process.env.STUDENTMARKET_E2E_BASE_URL})));
  try {
    await Promise.all(apis.map((api,i)=>identity(api,['desktop','mobile','seller','admin'][i])));
    const {id}=await (await apis[0].post('/api/reservations',{data:requestBody()})).json();
    await apis[2].patch('/api/reservations/'+id,{data:{action:'accept'}});
    await db.query("UPDATE listing_reservations SET meeting_at=NOW()-INTERVAL '1 minute' WHERE id=$1",[id]);
    const sold=await apis[2].patch('/api/reservations/'+id,{data:{action:'complete'}});expect(sold.status()).toBe(200);
    const {transactionId}=await sold.json();
    const url='/api/transactions/'+transactionId+'/confirm';
    expect((await apis[1].post(url,{data:{confirm:true}})).status()).toBe(404);
    expect((await apis[2].post(url,{data:{confirm:true}})).status()).toBe(404);
    expect((await apis[3].post(url,{data:{confirm:true}})).status()).toBe(403);
    expect((await apis[0].post(url,{headers:{Origin:'https://evil.invalid'},data:{confirm:true}})).status()).toBe(403);
    expect((await apis[0].post(url,{data:{confirm:'true'}})).status()).toBe(400);
    expect((await apis[0].post(url,{data:null})).status()).toBe(400);
    const attempts=await Promise.all([true,true].map(confirm=>apis[0].post(url,{data:{confirm}})));
    expect(attempts.map(r=>r.status())).toEqual([200,200]);
    expect((await db.query("SELECT count(*)::int n FROM reservation_events WHERE reservation_id=$1 AND title='Hai bên đã xác nhận giao dịch hoàn tất'",[id])).rows[0].n).toBe(2);
    expect((await apis[0].post(url,{data:{confirm:false}})).status()).toBe(409);
    expect((await apis[1].get('/api/transactions')).status()).toBe(200);
    expect((await (await apis[1].get('/api/transactions')).json()).transactions.some((t:{id:string})=>t.id===transactionId)).toBe(false);
    const review={transactionId,rating:5,content:'Giao dịch đã hoàn thành, đánh giá hợp lệ.'};
    expect((await apis[1].post('/api/reviews',{data:review})).status()).toBe(403);
    expect((await apis[3].post('/api/reviews',{data:review})).status()).toBe(403);
    expect((await apis[0].post('/api/reviews',{data:{...review,targetUserId:seed.accounts.mobile.userId}})).status()).toBe(400);
    expect((await apis[0].post('/api/reviews',{data:{...review,productId:seed.products[7].id}})).status()).toBe(400);
    expect((await apis[0].post('/api/reviews',{data:null})).status()).toBe(400);
    const posted=await Promise.all([review,review].map(data=>apis[0].post('/api/reviews',{data})));
    expect(posted.map(r=>r.status()).sort()).toEqual([201,409]);
    // A cancelled transaction never unlocks reviews or re-completion.
    await db.query('DELETE FROM reviews WHERE product_id=$1',[listing.id]);
    await db.query('DELETE FROM transactions WHERE listing_id=$1',[listing.id]);
    await db.query('DELETE FROM listing_reservations WHERE listing_id=$1',[listing.id]);
    await db.query("UPDATE products SET status='Active' WHERE id=$1",[listing.id]);
    const again=await (await apis[0].post('/api/reservations',{data:requestBody()})).json();
    await apis[2].patch('/api/reservations/'+again.id,{data:{action:'accept'}});
    await db.query("UPDATE listing_reservations SET meeting_at=NOW()-INTERVAL '1 minute' WHERE id=$1",[again.id]);
    const next=await (await apis[2].patch('/api/reservations/'+again.id,{data:{action:'complete'}})).json();
    const nextUrl='/api/transactions/'+next.transactionId+'/confirm';
    expect((await apis[0].post(nextUrl,{data:{confirm:false}})).status()).toBe(200);
    expect((await apis[0].post(nextUrl,{data:{confirm:true}})).status()).toBe(409);
    expect((await apis[0].post('/api/reviews',{data:{...review,transactionId:next.transactionId}})).status()).toBe(403);
    expect((await db.query('SELECT status FROM products WHERE id=$1',[listing.id])).rows[0].status).toBe('Active');
    await db.query('INSERT INTO reviews(reviewer_id,target_user_id,product_id,rating,content) VALUES($1,$2,$3,4,$4)',[seed.accounts.desktop.userId,seed.accounts.seller.userId,listing.id,'Đánh giá cũ chưa liên kết giao dịch']);
    const publicReviews=(await (await apis[0].get('/api/sellers/'+seed.accounts.seller.userId)).json()).reviews;
    expect(publicReviews.find((r:{content:string})=>r.content==='Đánh giá cũ chưa liên kết giao dịch').verifiedTransaction).toBe(false);
  } finally {await Promise.all(apis.map(api=>api.dispose()));}
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
