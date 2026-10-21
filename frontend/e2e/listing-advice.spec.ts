import {test,expect,seed,login} from './fixtures';
import {Pool} from 'pg';
import {readFile} from 'node:fs/promises';
import type {APIRequestContext} from '@playwright/test';
const database=process.env.STUDENTMARKET_E2E_DATABASE!;
if(!/^student_market_e2e_[a-f0-9]{12}$/.test(database))throw Error('Advice tests require an isolated database.');
const db=new Pool({host:process.env.PG_HOST,port:Number(process.env.PG_PORT||5432),user:process.env.PG_USER,password:process.env.PG_PASSWORD,database,max:2});
async function resetRate(){await db.query("DELETE FROM login_attempts WHERE attempt_key LIKE 'listing-advice:%'");}
test.beforeEach(resetRate);test.afterAll(async()=>{await db.end();});
async function identity(api:APIRequestContext,name:string){const account=seed.accounts[name];expect((await api.post('/api/auth/login',{data:{email:account.email,password:account.password}})).status()).toBe(200);}

test('AI góp ý: xem ảnh, góp ý cũ, người bán chọn sửa tiêu đề và gửi tin chờ duyệt',async({page},info)=>{
  const initialProducts=(await db.query('SELECT COUNT(*)::int n FROM products')).rows[0].n;
  await login(page,seed.accounts[info.project.name]);await page.goto('/create-listing');
  const panel=page.getByRole('region',{name:'AI góp ý tin đăng',exact:true});
  await expect(panel.getByRole('button',{name:'Nhờ AI góp ý',exact:true})).toBeDisabled();
  const image=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#141414';ctx.fillRect(0,0,512,512);return canvas.toDataURL('image/png').split(',')[1];});
  await page.getByLabel('Chọn ảnh sản phẩm',{exact:true}).setInputFiles([{name:'original-private-photo.png',mimeType:'image/png',buffer:Buffer.from(image,'base64')},{name:'second-photo.png',mimeType:'image/png',buffer:Buffer.from(image,'base64')}]);
  await page.getByRole('button',{name:'Tiếp tục',exact:true}).click();
  await page.getByLabel('Tên món đồ *',{exact:true}).fill('Đèn bàn CHẬM');await page.getByLabel(/^Mô tả món đồ/).fill('Đèn còn sử dụng được và có dây cắm.');
  await page.getByRole('button',{name:'Tiếp tục',exact:true}).click();await page.getByLabel('Giá mong muốn (đ) *',{exact:true}).fill('50000');await page.getByRole('button',{name:'Tiếp tục',exact:true}).click();
  await panel.getByRole('button',{name:'Nhờ AI góp ý',exact:true}).click();await expect(panel.getByRole('button',{name:'Đang xem tin & ảnh…',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:/^2 .*Thông tin/}).click();await page.getByLabel('Tên món đồ *',{exact:true}).fill('Đèn bàn cũ');
  await expect(panel.getByText(/Tin hoặc ảnh đã thay đổi/)).toBeVisible();await expect(panel.getByRole('button',{name:'Dùng tiêu đề này',exact:true})).toBeDisabled();
  expect((await db.query('SELECT COUNT(*)::int n FROM products')).rows[0].n).toBe(initialProducts);
  await panel.getByRole('button',{name:'Nhờ AI góp ý lại',exact:true}).click();await expect(panel.getByRole('button',{name:'Dùng tiêu đề này',exact:true})).toBeEnabled();
  await expect(page.getByLabel('Tên món đồ *',{exact:true})).toHaveValue('Đèn bàn cũ');
  await expect(panel.getByText('Ảnh 1 thiếu sáng, khó thấy món đồ.',{exact:true})).toBeVisible();
  const calls=await (await page.request.get(seed.adviceOrigin)).json();expect(calls.calls.at(-1).imageCount).toBe(2);expect(calls.calls.at(-1).mimeTypes).toEqual(['image/jpeg','image/jpeg']);
  await panel.scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('listing-advice.png')});
  await panel.getByRole('button',{name:'Sửa mục này →',exact:true}).first().click();await page.getByRole('button',{name:'Đặt làm ảnh bìa',exact:true}).click();
  await expect(panel.getByRole('button',{name:'Dùng tiêu đề này',exact:true})).toBeDisabled();
  await panel.getByRole('button',{name:'Nhờ AI góp ý lại',exact:true}).click();await expect(panel.getByRole('button',{name:'Dùng tiêu đề này',exact:true})).toBeEnabled();
  await panel.getByRole('button',{name:'Dùng tiêu đề này',exact:true}).click();await page.getByRole('button',{name:'Tiếp tục',exact:true}).click();
  await expect(page.getByLabel('Tên món đồ *',{exact:true})).toHaveValue('Đèn bàn học cũ còn hoạt động tốt');
  await page.getByRole('button',{name:'Tiếp tục',exact:true}).click();await page.getByRole('button',{name:'Tiếp tục',exact:true}).click();await page.getByRole('button',{name:'Gửi tin đăng',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Tin của bạn đã được gửi!',exact:true})).toBeVisible();
  const row=(await db.query("SELECT id,moderation_status FROM products WHERE seller_id=$1 AND title=$2",[seed.accounts[info.project.name].userId,'Đèn bàn học cũ còn hoạt động tốt'])).rows[0];expect(row.moderation_status).toBe('PENDING');
  expect((await db.query('SELECT COUNT(*)::int n FROM listing_ai_reviews WHERE listing_id=$1',[row.id])).rows[0].n).toBe(0);
});

test('AI góp ý: tự phục hồi sau một lần nhà cung cấp quá tải',async({page},info)=>{
  await login(page,seed.accounts[info.project.name]);await page.goto('/create-listing');
  await page.getByRole('button',{name:'Tiếp tục',exact:true}).click();
  const title='UPSTREAM_ONCE Đèn bàn '+info.project.name;
  await page.getByLabel('Tên món đồ *',{exact:true}).fill(title);
  await page.getByLabel(/^Mô tả món đồ/).fill('Đèn còn sử dụng tốt, có dây nguồn.');
  const panel=page.getByRole('region',{name:'AI góp ý tin đăng',exact:true});
  await panel.getByRole('button',{name:'Nhờ AI góp ý',exact:true}).click();
  await expect(panel.getByText('Có vài điểm giúp tin rõ ràng hơn.',{exact:true})).toBeVisible();
  await expect(panel.getByRole('alert')).toHaveCount(0);
  await expect(page.getByLabel('Tên món đồ *',{exact:true})).toHaveValue(title);
  const calls=(await (await page.request.get(seed.adviceOrigin)).json()).calls.filter((call:{input:{title:string}})=>call.input.title===title);
  expect(calls).toHaveLength(2);
});

test('AI góp ý: lỗi dịch vụ không cản đăng tin, hủy khi chờ và không áp dụng kết quả lỗi',async({page},info)=>{
  await login(page,seed.accounts[info.project.name]);await page.goto('/create-listing');await page.getByRole('button',{name:'Tiếp tục',exact:true}).click();
  await page.getByLabel('Tên món đồ *',{exact:true}).fill('CHẬM Đèn bàn');await page.getByLabel(/^Mô tả món đồ/).fill('Đèn còn dùng được, có thể xem trực tiếp.');
  const panel=page.getByRole('region',{name:'AI góp ý tin đăng',exact:true});await panel.getByRole('button',{name:'Nhờ AI góp ý',exact:true}).click();
  await panel.getByRole('button',{name:'Dừng góp ý',exact:true}).click();await expect(panel.getByRole('button',{name:'Nhờ AI góp ý',exact:true})).toBeEnabled();
  await page.getByLabel('Tên món đồ *',{exact:true}).fill('UPSTREAM_FAIL Đèn bàn');await panel.getByRole('button',{name:'Nhờ AI góp ý',exact:true}).click();await expect(panel.getByRole('alert')).toBeVisible();await expect(panel.getByRole('button',{name:'Dùng tiêu đề này',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Tiếp tục',exact:true}).click();await page.getByLabel('Giá mong muốn (đ) *',{exact:true}).fill('50000');await page.getByRole('button',{name:'Tiếp tục',exact:true}).click();await page.getByRole('button',{name:'Gửi tin đăng',exact:true}).click();await expect(page.getByRole('heading',{name:'Tin của bạn đã được gửi!',exact:true})).toBeVisible();
});

test('AI góp ý: xác thực, origin, payload ảnh, che thông tin liên hệ và giới hạn lượt gọi',async({playwright},info)=>{
  const api=await playwright.request.newContext({baseURL:process.env.STUDENTMARKET_E2E_BASE_URL}),admin=await playwright.request.newContext({baseURL:process.env.STUDENTMARKET_E2E_BASE_URL});
  const multipart={title:'Đèn bàn cũ',description:'Đèn còn sử dụng tốt.',category:'Học tập',condition:'Tốt',kind:'Sell',price:'50000',location:'Khu vực riêng'};
  try{
    expect((await api.post('/api/listings/advice',{multipart})).status()).toBe(401);await identity(api,info.project.name);await identity(admin,'admin');
    expect((await admin.post('/api/listings/advice',{multipart})).status()).toBe(403);
    expect((await api.post('/api/listings/advice',{multipart,headers:{Origin:'https://evil.invalid'}})).status()).toBe(403);
    expect((await api.post('/api/listings/advice',{data:{title:'bad format'}})).status()).toBe(415);await resetRate();
    const image=await readFile('public/figma/25-29571-imgHeroBooksAsset.png');
    expect((await api.post('/api/listings/advice',{multipart:{...multipart,imageFiles:{name:'fake.jpg',mimeType:'image/jpeg',buffer:image}}})).status()).toBe(400);await resetRate();
    const invalid=await api.post('/api/listings/advice',{multipart:{...multipart,title:'INVALID_REPLY Đèn bàn'}});expect(invalid.status()).toBe(503);expect(await invalid.text()).not.toContain('e2e-only-advice');await resetRate();
    const privateDraft={...multipart,description:'Gọi 0901234567 hoặc test@example.com',location:'Địa chỉ riêng cụ thể không gửi nhà cung cấp'};
    const result=await api.post('/api/listings/advice',{multipart:privateDraft});expect(result.status()).toBe(200);expect(result.headers()['cache-control']).toContain('no-store');
    const call=(await (await api.get(seed.adviceOrigin)).json()).calls.at(-1);expect(JSON.stringify(call)).not.toContain('0901234567');expect(JSON.stringify(call)).not.toContain('test@example.com');expect(JSON.stringify(call)).not.toContain(privateDraft.location);expect(call.input.hasMeetingArea).toBe(true);
    await resetRate();for(let n=0;n<3;n++)expect((await api.post('/api/listings/advice',{multipart})).status()).toBe(200);expect((await api.post('/api/listings/advice',{multipart})).status()).toBe(429);
    await resetRate();await db.query('INSERT INTO login_attempts(attempt_key,failures,blocked_until) VALUES($1,10,$2)', ['listing-advice:hour:'+seed.accounts[info.project.name].userId,Date.now()+3600000]);expect((await api.post('/api/listings/advice',{multipart})).status()).toBe(429);
  }finally{await api.dispose();await admin.dispose();}
});
