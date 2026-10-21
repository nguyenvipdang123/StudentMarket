import {test,expect,seed} from './fixtures';
import {Pool} from 'pg';
import type {APIRequestContext} from '@playwright/test';
const database=process.env.STUDENTMARKET_E2E_DATABASE!;
if(!/^student_market_e2e_[a-f0-9]{12}$/.test(database))throw Error('Support tests require an isolated database.');
const db=new Pool({host:process.env.PG_HOST,port:Number(process.env.PG_PORT||5432),user:process.env.PG_USER,password:process.env.PG_PASSWORD,database,max:2});
test.beforeEach(async()=>{await db.query('DELETE FROM support_tickets');});
test.afterAll(async()=>{await db.end();});
async function identity(api:APIRequestContext,name:string){expect((await api.post('/api/auth/login',{data:{email:seed.accounts[name].email,password:seed.accounts[name].password}})).status()).toBe(200);}
const draft={subject:'Đã chuyển tiền nhưng chưa kích hoạt gói',category:'PAYMENT',content:'Tôi chuyển khoản lúc 10 giờ, mã đơn STTEST, xin kiểm tra giúp.'};

test('Trung tâm hỗ trợ: FAQ công khai, tạo phiếu, nhận phản hồi, mở lại và Admin xử lý',async({page,playwright},info)=>{
  await page.goto('/support');await expect(page.getByRole('heading',{name:'Trung tâm hỗ trợ',exact:true})).toBeVisible();
  await page.getByText('Đã chuyển khoản nhưng gói đẩy tin chưa kích hoạt?',{exact:true}).click();await expect(page.getByText(/Không chuyển thêm cho cùng một đơn/)).toBeVisible();
  await expect(page.getByRole('heading',{name:'Hướng dẫn giao dịch an toàn',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Gửi yêu cầu hỗ trợ',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Đăng nhập để gửi hỗ trợ',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Đăng nhập',exact:true});await expect(dialog).toBeVisible();
  const student=seed.accounts[info.project.name];await dialog.getByLabel(/Email đã đăng ký/).fill(student.email);await dialog.getByLabel(/^Mật khẩu/).fill(student.password);await dialog.getByRole('button',{name:'Đăng nhập',exact:true}).click();await expect(dialog).not.toBeVisible();
  await page.getByLabel('Nhóm vấn đề',{exact:true}).selectOption('PAYMENT');await page.getByLabel('Tiêu đề yêu cầu',{exact:true}).fill(draft.subject);await page.getByLabel('Mô tả vấn đề',{exact:true}).fill(draft.content);await page.getByRole('button',{name:'Gửi yêu cầu hỗ trợ',exact:true}).click();
  const detail=page.getByRole('region',{name:'Chi tiết phiếu hỗ trợ',exact:true});await expect(detail.getByText(draft.content,{exact:true})).toBeVisible();const id=new URL(page.url()).searchParams.get('ticket')!;expect(id).toBeTruthy();await page.reload();await expect(detail.getByText(draft.content,{exact:true})).toBeVisible();
  const admin=await playwright.request.newContext({baseURL:process.env.STUDENTMARKET_E2E_BASE_URL});await identity(admin,'admin');
  try{
    const pending=await (await admin.get('/api/notifications')).json();expect(pending.notifications.some((n:{href:string})=>n.href.includes(id))).toBe(true);
    const ticket=(await (await admin.get('/api/admin/support/'+id)).json()).ticket;
    expect((await admin.post('/api/admin/support/'+id,{data:{content:'Đã kiểm tra đơn, cần bạn bổ sung thời điểm chuyển khoản.',status:'WAITING_USER',version:ticket.version}})).status()).toBe(200);
  }finally{await admin.dispose();}
  const notices=await (await page.request.get('/api/notifications')).json();expect(notices.notifications.some((n:{href:string;body:string})=>n.href.includes(id)&&n.body.includes('Đã kiểm tra đơn'))).toBe(true);
  await detail.getByRole('button',{name:'Làm mới cuộc trao đổi',exact:true}).click();await expect(detail.getByText('Đã kiểm tra đơn, cần bạn bổ sung thời điểm chuyển khoản.',{exact:true})).toBeVisible();
  await detail.getByLabel('Bổ sung thông tin',{exact:true}).fill('Tôi đã chuyển vào lúc 10:15 sáng hôm nay.');await detail.getByRole('button',{name:'Gửi bổ sung',exact:true}).click();await expect(detail.getByText('Tôi đã chuyển vào lúc 10:15 sáng hôm nay.',{exact:true})).toBeVisible();
  expect((await (await page.request.get('/api/support/'+id)).json()).ticket.status).toBe('OPEN');await detail.scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('support-student.png')});
  await identity(page.request,'admin');await page.goto('/admin?tab=SUPPORT&ticket='+id);const adminDetail=page.getByRole('region',{name:'Chi tiết phiếu hỗ trợ',exact:true});await expect(adminDetail.getByText(draft.content,{exact:true})).toBeVisible();
  await adminDetail.getByLabel('Cập nhật trạng thái',{exact:true}).selectOption('IN_PROGRESS');await adminDetail.getByRole('button',{name:'Lưu phản hồi & trạng thái',exact:true}).click();await expect(adminDetail.getByText('Đã lưu cập nhật hỗ trợ.',{exact:true})).toBeVisible();
  await adminDetail.getByLabel('Phản hồi cho người gửi',{exact:true}).fill('Đã hướng dẫn kiểm tra đơn thanh toán, bạn kiểm tra lại giúp nhé.');await adminDetail.getByLabel('Cập nhật trạng thái',{exact:true}).selectOption('RESOLVED');await adminDetail.getByRole('button',{name:'Lưu phản hồi & trạng thái',exact:true}).click();await expect(adminDetail.getByText('Đã hướng dẫn kiểm tra đơn thanh toán, bạn kiểm tra lại giúp nhé.',{exact:true})).toBeVisible();
  await adminDetail.scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('support-admin.png')});
  expect((await db.query("SELECT COUNT(*)::int total FROM audit_logs WHERE action='UPDATE_SUPPORT_TICKET' AND target_id=$1",[id])).rows[0].total).toBe(3);
  await identity(page.request,info.project.name);await page.goto('/support?ticket='+id);await page.getByLabel('Bổ sung thông tin',{exact:true}).fill('Tôi kiểm tra lại nhưng vẫn chưa thấy gói được bật.');await page.getByRole('button',{name:'Gửi bổ sung',exact:true}).click();await expect(page.getByText('Tôi kiểm tra lại nhưng vẫn chưa thấy gói được bật.',{exact:true})).toBeVisible();expect((await (await page.request.get('/api/support/'+id)).json()).ticket.status).toBe('OPEN');
});

test('Phiếu hỗ trợ: quyền riêng tư, trạng thái đồng thời, kiểm tra dữ liệu và chống gửi quá nhiều',async({playwright},info)=>{
  const api=await playwright.request.newContext({baseURL:process.env.STUDENTMARKET_E2E_BASE_URL}),other=await playwright.request.newContext({baseURL:process.env.STUDENTMARKET_E2E_BASE_URL}),admin=await playwright.request.newContext({baseURL:process.env.STUDENTMARKET_E2E_BASE_URL});
  try{
    expect((await api.get('/api/support')).status()).toBe(401);await identity(api,info.project.name);await identity(other,info.project.name==='desktop'?'mobile':'desktop');await identity(admin,'admin');
    expect((await api.get('/api/admin/support')).status()).toBe(403);expect((await admin.post('/api/support',{data:draft})).status()).toBe(403);expect((await api.post('/api/support',{data:draft,headers:{Origin:'https://evil.invalid'}})).status()).toBe(403);
    expect((await api.post('/api/support',{data:{...draft,category:'__proto__'}})).status()).toBe(400);expect((await api.post('/api/support',{data:{...draft,content:'short'}})).status()).toBe(400);expect((await api.post('/api/support',{data:{...draft,content:'x'.repeat(25000)}})).status()).toBe(413);
    const created=await api.post('/api/support',{data:draft});expect(created.status()).toBe(201);const {id}=await created.json();
    expect((await other.get('/api/support/'+id)).status()).toBe(404);expect((await other.post('/api/support/'+id,{data:{content:'Không được xem phiếu này'}})).status()).toBe(404);expect((await (await other.get('/api/support')).json()).total).toBe(0);
    expect((await api.post('/api/support/'+id,{data:{content:'Tôi tự xử lý',status:'RESOLVED'}})).status()).toBe(403);
    const detail=await api.get('/api/support/'+id);expect(detail.headers()['cache-control']).toContain('no-store');expect((await detail.json()).ticket.ownerEmail).toBeUndefined();
    expect((await api.get('/api/support?status=toString')).status()).toBe(400);expect((await api.get('/api/support/'+id+'?before=9999999999999999999')).status()).toBe(400);
    const changes=await Promise.all([admin.post('/api/admin/support/'+id,{data:{content:'Bắt đầu kiểm tra đơn của bạn.',status:'IN_PROGRESS',version:1}}),admin.post('/api/admin/support/'+id,{data:{content:'Cần thông tin bổ sung.',status:'WAITING_USER',version:1}})]);expect(changes.map(r=>r.status()).sort()).toEqual([200,409]);
    expect((await (await api.get('/api/support/'+id)).json()).messages).toHaveLength(2);
    for(let i=0;i<4;i++)expect((await api.post('/api/support',{data:{...draft,subject:'Phiếu thử giới hạn '+i}})).status()).toBe(201);
    expect((await api.post('/api/support',{data:draft})).status()).toBe(429);
    await db.query("INSERT INTO support_messages(ticket_id,author_account_id,author_role,author_name,content) SELECT $1,u.auth_id,'student',u.full_name,'Phản hồi giới hạn' FROM users u CROSS JOIN generate_series(1,30) WHERE u.id=$2",[id,seed.accounts[info.project.name].userId]);expect((await api.post('/api/support/'+id,{data:{content:'Quá giới hạn'}})).status()).toBe(429);
  }finally{await api.dispose();await other.dispose();await admin.dispose();}
});

test('Phiếu hỗ trợ: phân trang server, tìm mã, lịch sử dài và đánh dấu thông báo',async({playwright},info)=>{
  const api=await playwright.request.newContext({baseURL:process.env.STUDENTMARKET_E2E_BASE_URL}),admin=await playwright.request.newContext({baseURL:process.env.STUDENTMARKET_E2E_BASE_URL});
  try{await identity(api,info.project.name);await identity(admin,'admin');
    const {id}=await (await api.post('/api/support',{data:draft})).json();
    await db.query("INSERT INTO support_tickets(owner_id,subject,category,status) SELECT $1,'Phiếu kiểm tra phân trang '||g,'OTHER','RESOLVED' FROM generate_series(1,22) g",[seed.accounts[info.project.name].userId]);
    const list=await (await api.get('/api/support')).json();expect(list.total).toBe(23);expect(list.tickets).toHaveLength(20);const second=await (await api.get('/api/support?page=2')).json();expect(second.tickets).toHaveLength(3);expect(second.tickets.some((t:{id:string})=>list.tickets.some((a:{id:string})=>a.id===t.id))).toBe(false);
    const found=await (await api.get('/api/support?q=HT-'+id.slice(0,8).toUpperCase())).json();expect(found.total).toBe(1);expect((await (await admin.get('/api/admin/support?q='+encodeURIComponent(seed.accounts[info.project.name].email))).json()).total).toBe(23);
    await db.query("INSERT INTO support_messages(ticket_id,author_account_id,author_role,author_name,content) SELECT $1,123456,'admin','Admin kiểm thử','Nội dung phản hồi '||g FROM generate_series(1,45) g",[id]);
    const first=await (await api.get('/api/support/'+id)).json();expect(first.messages).toHaveLength(40);expect(first.hasMore).toBe(true);const older=await (await api.get('/api/support/'+id+'?before='+first.messages[0].id)).json();expect(older.messages).toHaveLength(6);expect(older.hasMore).toBe(false);expect(older.messages.at(-1).id).toBeLessThan(first.messages[0].id);
    const notices=await (await api.get('/api/notifications')).json(),notice=notices.notifications.find((n:{href:string})=>n.href.includes(id));expect(notice).toBeTruthy();expect(notice.read).toBe(false);expect((await api.patch('/api/notifications',{data:{ids:[notice.id]}})).status()).toBe(200);expect((await (await api.get('/api/notifications')).json()).notifications.find((n:{id:string})=>n.id===notice.id).read).toBe(true);
  }finally{await api.dispose();await admin.dispose();}
});

test('Thông báo mở đúng phiếu khác khi đang ở trung tâm hỗ trợ',async({page,playwright},info)=>{
  await identity(page.request,info.project.name);
  const first=await (await page.request.post('/api/support',{data:draft})).json();
  const second=await (await page.request.post('/api/support',{data:{...draft,subject:'Phiếu thứ hai cần xem phản hồi'}})).json();
  const admin=await playwright.request.newContext({baseURL:process.env.STUDENTMARKET_E2E_BASE_URL});
  try{await identity(admin,'admin');expect((await admin.post('/api/admin/support/'+second.id,{data:{content:'Admin đã kiểm tra phiếu thứ hai của bạn.',status:'IN_PROGRESS',version:1}})).status()).toBe(200);}finally{await admin.dispose();}
  await page.goto('/support?ticket='+first.id);
  const detail=page.getByRole('region',{name:'Chi tiết phiếu hỗ trợ',exact:true});await expect(detail.getByRole('heading',{name:draft.subject,exact:true})).toBeVisible();
  await page.getByRole('button',{name:/^Thông báo/}).click();
  await page.getByRole('region',{name:'Danh sách thông báo',exact:true}).getByRole('button').filter({hasText:'Phiếu thứ hai cần xem phản hồi'}).click();
  await expect(page).toHaveURL(new RegExp('ticket='+second.id));
  await expect(detail.getByRole('heading',{name:'Phiếu thứ hai cần xem phản hồi',exact:true})).toBeVisible();
  await expect(detail.getByText('Admin đã kiểm tra phiếu thứ hai của bạn.',{exact:true})).toBeVisible();
});
