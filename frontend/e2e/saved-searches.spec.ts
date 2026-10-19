import {test,expect,seed,login} from './fixtures';
import {Pool} from 'pg';
import type {APIRequestContext} from '@playwright/test';
const database=process.env.STUDENTMARKET_E2E_DATABASE!;
if(!/^student_market_e2e_[a-f0-9]{12}$/.test(database))throw Error('Saved search tests require an isolated E2E database.');
const db=new Pool({host:process.env.PG_HOST,port:Number(process.env.PG_PORT||5432),user:process.env.PG_USER,password:process.env.PG_PASSWORD,database,max:2});
const created:string[]=[];
const filters={q:'laptop watch',category:'Công nghệ',school:'DNTU',kind:'sell',condition:'Tốt',minPrice:'100000',maxPrice:'5000000'};
async function product(title:string,price=3000000,status='Active',moderation='PENDING',seller=seed.accounts.seller.userId) {
  const {rows:[p]}=await db.query(`INSERT INTO products(id,user_id,seller_id,category_id,title,description,price,condition,type,status,location,university,view_count,created_at,updated_at,moderation_status)
    VALUES(gen_random_uuid(),$1,$1,2,$2,'Sản phẩm kiểm thử theo dõi nhu cầu.',$3,'Tốt','Sell',$4,'Thư viện DNTU','Đại học Công nghệ Đồng Nai',0,NOW(),NOW(),$5) RETURNING id`,[seller,title,price,status,moderation]);
  created.push(p.id);return p.id as string;
}
async function identity(api:APIRequestContext,name:string) {
  const response=await api.post('/api/auth/login',{data:{email:seed.accounts[name].email,password:seed.accounts[name].password}});expect(response.status()).toBe(200);
}
async function events(userId:string|null,kind?:string) {
  return (await db.query('SELECT * FROM product_alert_events WHERE user_id=$1 AND product_id=ANY($2::uuid[])'+(kind?' AND kind=$3':''),kind?[userId,created,kind]:[userId,created])).rows;
}
test.afterEach(async()=>{
  await db.query('DELETE FROM saved_searches WHERE user_id=ANY($1::uuid[])',[[seed.accounts.desktop.userId,seed.accounts.mobile.userId,seed.accounts.seller.userId]]);
  if(created.length)await db.query('DELETE FROM products WHERE id=ANY($1::uuid[])',[created.splice(0)]);
});
test.afterAll(async()=>{await db.end();});

test('theo dõi: lưu bộ lọc, nhận chuông, tạm dừng/bật lại và xóa trên giao diện',async({page},info)=>{
  const account=seed.accounts[info.project.name];await login(page,account);
  await page.goto('/explore?q=laptop&maxPrice=5000000&school=DNTU');
  const save=page.getByRole('region',{name:'Theo dõi nhu cầu mua'});
  await save.getByRole('button',{name:'Theo dõi nhu cầu này',exact:true}).click();
  await save.getByLabel('Tên nhu cầu').fill('Laptop dưới 5 triệu tại DNTU');
  await save.getByRole('button',{name:'Lưu & bật thông báo',exact:true}).click();
  await expect(save.getByRole('status')).toContainText('Đã lưu nhu cầu');
  const id=await product('Laptop watch mới ở DNTU');await db.query("UPDATE products SET moderation_status='APPROVED' WHERE id=$1",[id]);
  await page.getByRole('button',{name:/^Thông báo/}).click();
  const notification=page.getByRole('region',{name:'Danh sách thông báo'});
  await expect(notification.getByText('Có món đồ phù hợp nhu cầu của bạn',{exact:true})).toBeVisible();
  await notification.getByRole('button',{name:'Đóng thông báo',exact:true}).click();
  await page.goto('/saved#needs');
  const card=page.getByRole('article',{name:'Nhu cầu Laptop dưới 5 triệu tại DNTU'});
  await expect(card.getByText('Đang theo dõi',{exact:true})).toBeVisible();
  const href=await card.getByRole('link',{name:'Xem món phù hợp',exact:true}).getAttribute('href');
  expect(new URL(href!,'http://test').searchParams.get('maxPrice')).toBe('5000000');
  await card.getByRole('button',{name:'Tạm dừng',exact:true}).click();await page.reload();
  await expect(card.getByText('Đã tạm dừng',{exact:true})).toBeVisible();
  await card.getByRole('button',{name:'Bật lại',exact:true}).click();await expect(card.getByText('Đang theo dõi',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await card.getByRole('button',{name:'Xóa nhu cầu',exact:true}).click();await card.getByRole('button',{name:'Đồng ý xóa',exact:true}).click();await expect(card).not.toBeVisible();
});

test('theo dõi: khớp từ khóa không dấu, trường/ngân sách/danh mục/tình trạng, duyệt rồi mới báo và không trùng',async({playwright})=>{
  const api=await playwright.request.newContext({baseURL:process.env.STUDENTMARKET_E2E_BASE_URL});
  try {
    await identity(api,'desktop');
    // Existing matching products form a baseline, not a historical notification flood.
    await product('Laptop watch cũ',3000000,'Active','APPROVED');
    expect((await api.post('/api/saved-searches',{data:{name:'Nhu cầu chính',filters}})).status()).toBe(201);
    expect(await events(seed.accounts.desktop.userId)).toHaveLength(0);
    expect((await api.post('/api/saved-searches',{data:{name:'Chồng bộ lọc',filters:{...filters,q:'watch',minPrice:''}}})).status()).toBe(201);
    const pending=await product('Laptop watch mới');expect(await events(seed.accounts.desktop.userId)).toHaveLength(0);
    await product('Laptop watch giá cao',6000000,'Active','APPROVED');
    await product('Laptop watch trường khác',3000000,'Active','APPROVED',seed.accounts.sellerUEH.userId);
    await product('Laptop watch ẩn',3000000,'Hidden','APPROVED');
    const bad=await product('Laptop watch sai danh mục');await db.query("UPDATE products SET category_id=1,moderation_status='APPROVED' WHERE id=$1",[bad]);
    const condition=await product('Laptop watch sai tình trạng');await db.query("UPDATE products SET condition='Như mới',moderation_status='APPROVED' WHERE id=$1",[condition]);
    await product('Điện thoại không khớp');
    await db.query("UPDATE products SET title='Láptop watch mới',moderation_status='APPROVED' WHERE id=$1",[pending]);
    const rows=await events(seed.accounts.desktop.userId,'NEW_MATCH');expect(rows).toHaveLength(1);expect(rows[0].product_id).toBe(pending);
    await db.query("UPDATE products SET moderation_status='PENDING' WHERE id=$1",[pending]);
    expect((await (await api.get('/api/notifications')).json()).notifications.filter((n:{id:string})=>n.id.startsWith('product-alert:'))).toHaveLength(0);
    await db.query("UPDATE products SET moderation_status='APPROVED' WHERE id=$1",[pending]);
    expect(await events(seed.accounts.desktop.userId,'NEW_MATCH')).toHaveLength(1);
    const first=await (await api.get('/api/notifications')).json();const second=await (await api.get('/api/notifications')).json();
    expect(first.unreadCount).toBe(second.unreadCount);
    const notice=first.notifications.find((n:{id:string})=>n.id.startsWith('product-alert:'));
    expect(notice.href).toBe('/listing/'+pending);
    await api.patch('/api/notifications',{data:{ids:[notice.id]}});
    expect((await (await api.get('/api/notifications')).json()).notifications.find((n:{id:string})=>n.id===notice.id).read).toBe(true);
  }finally{await api.dispose();}
});

test('theo dõi giảm giá: chỉ báo giá được duyệt, bật/tắt từng món và bỏ lưu',async({page},info)=>{
  await login(page,seed.accounts[info.project.name]);
  const id=await product('Laptop watch giảm giá',3000000,'Active','APPROVED');
  expect((await page.request.post('/api/favorites',{data:{productId:id}})).status()).toBe(200);
  await db.query("UPDATE products SET price=2500000,moderation_status='PENDING' WHERE id=$1",[id]);
  expect(await events(seed.accounts[info.project.name].userId,'PRICE_DROP')).toHaveLength(0);
  await db.query("UPDATE products SET moderation_status='APPROVED' WHERE id=$1",[id]);
  const rows=await events(seed.accounts[info.project.name].userId,'PRICE_DROP');expect(rows).toHaveLength(1);expect(Number(rows[0].old_price)).toBe(3000000);expect(Number(rows[0].new_price)).toBe(2500000);
  await db.query('UPDATE products SET price=price WHERE id=$1',[id]);expect(await events(seed.accounts[info.project.name].userId,'PRICE_DROP')).toHaveLength(1);
  await page.goto('/saved');const card=page.locator('.product-card').filter({has:page.getByRole('link',{name:'Laptop watch giảm giá',exact:true})});
  await card.getByRole('button',{name:'Tắt báo giảm giá',exact:true}).click();await page.reload();await expect(card.getByRole('button',{name:'Bật báo giảm giá',exact:true})).toBeVisible();
  await db.query('UPDATE products SET price=2000000 WHERE id=$1',[id]);expect(await events(seed.accounts[info.project.name].userId,'PRICE_DROP')).toHaveLength(1);
  await card.getByRole('button',{name:'Bật báo giảm giá',exact:true}).click();await expect(card.getByRole('button',{name:'Tắt báo giảm giá',exact:true})).toBeVisible();await db.query('UPDATE products SET price=1900000 WHERE id=$1',[id]);
  expect(await events(seed.accounts[info.project.name].userId,'PRICE_DROP')).toHaveLength(2);
  await page.request.post('/api/favorites',{data:{productId:id}});await db.query('UPDATE products SET price=1800000 WHERE id=$1',[id]);
  expect(await events(seed.accounts[info.project.name].userId,'PRICE_DROP')).toHaveLength(2);
  const notifications=await (await page.request.get('/api/notifications')).json();expect(notifications.notifications.some((n:{href:string})=>n.href==='/listing/'+id)).toBe(false);
});

test('theo dõi: lưu nhu cầu không khóa chéo khi người bán sửa tin, giới hạn đúng khi gửi đồng thời',async({playwright})=>{
  const api=await playwright.request.newContext({baseURL:process.env.STUDENTMARKET_E2E_BASE_URL});
  const editor=await db.connect();
  try {
    await identity(api,'desktop');const id=await product('Laptop watch đang sửa',3000000,'Active','APPROVED');
    await editor.query('BEGIN');await editor.query('SELECT id FROM products WHERE id=$1 FOR UPDATE',[id]);
    const saved=await api.post('/api/saved-searches',{data:{name:'Không khóa chéo',filters},timeout:5000});expect(saved.status()).toBe(201);
    await editor.query('UPDATE products SET price=2900000 WHERE id=$1',[id]);await editor.query('COMMIT');
    expect(await events(seed.accounts.desktop.userId)).toHaveLength(0);
    const results=await Promise.all(Array.from({length:11},(_,i)=>api.post('/api/saved-searches',{data:{name:'Đồng thời '+i,filters:{...filters,q:'watch concurrent '+i}}})));
    expect(results.filter(r=>r.status()===201)).toHaveLength(9);expect(results.filter(r=>r.status()===409)).toHaveLength(2);
    expect((await (await api.get('/api/saved-searches')).json()).searches).toHaveLength(10);
  }finally{await editor.query('ROLLBACK');editor.release();await api.dispose();}
});

test('theo dõi: quyền sở hữu, chống dữ liệu sai/trùng, tạm dừng không báo dồn và giới hạn 10 nhu cầu',async({playwright})=>{
  const apis=await Promise.all(['desktop','mobile','admin'].map(()=>playwright.request.newContext({baseURL:process.env.STUDENTMARKET_E2E_BASE_URL})));
  try {
    await Promise.all(apis.map((api,i)=>identity(api,['desktop','mobile','admin'][i])));
    const [api,other,admin]=apis;
    expect((await admin.post('/api/saved-searches',{data:{name:'x',filters}})).status()).toBe(403);
    expect((await api.post('/api/saved-searches',{data:{name:'x',filters},headers:{Origin:'https://evil.invalid'}})).status()).toBe(403);
    for(const bad of [{...filters,maxPrice:'-1'},{...filters,minPrice:'6000000'}, {...filters,q:['bad']},{}])expect((await api.post('/api/saved-searches',{data:{name:'x',filters:bad}})).status()).toBe(400);
    const response=await api.post('/api/saved-searches',{data:{name:'Riêng tư',filters}});expect(response.status()).toBe(201);const {id}=await response.json();
    expect((await api.post('/api/saved-searches',{data:{name:'Trùng',filters:{...filters,q:'WATCH laptop',school:'Đại học Công nghệ Đồng Nai'}}})).status()).toBe(409);
    expect((await (await other.get('/api/saved-searches')).json()).searches).toHaveLength(0);
    expect((await other.patch('/api/saved-searches/'+id,{data:{enabled:false}})).status()).toBe(404);
    expect((await other.delete('/api/saved-searches/'+id)).status()).toBe(404);
    await api.patch('/api/saved-searches/'+id,{data:{enabled:false}});
    await product('Laptop watch trong lúc tạm dừng',3000000,'Active','APPROVED');
    expect(await events(seed.accounts.desktop.userId)).toHaveLength(0);
    await api.patch('/api/saved-searches/'+id,{data:{enabled:true}});expect(await events(seed.accounts.desktop.userId)).toHaveLength(0);
    const pending=await product('Laptop watch mới sau bật lại');await db.query("UPDATE products SET moderation_status='APPROVED' WHERE id=$1",[pending]);
    expect(await events(seed.accounts.desktop.userId)).toHaveLength(1);
    for(let i=0;i<9;i++)expect((await api.post('/api/saved-searches',{data:{name:'Nhu cầu '+i,filters:{...filters,q:'watch '+i}}})).status()).toBe(201);
    expect((await api.post('/api/saved-searches',{data:{name:'Quá giới hạn',filters:{...filters,q:'watch 10'}}})).status()).toBe(409);
    await api.delete('/api/saved-searches/'+id);expect(await events(seed.accounts.desktop.userId)).toHaveLength(0);
  }finally{await Promise.all(apis.map(api=>api.dispose()));}
});
