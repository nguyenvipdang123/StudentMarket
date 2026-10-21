import {test,expect,seed} from './fixtures';
import {randomUUID} from 'node:crypto';
import type {Page} from '@playwright/test';

test.skip(process.env.STUDENTMARKET_TEST_TURNSTILE!=='1','Run with STUDENTMARKET_TEST_TURNSTILE=1 (isolated mock provider).');
const token=(action:string)=>`e2e:${action}:${randomUUID()}`;
const widgetScript=`window.turnstile={
 render(container,options){
  const id='mock-'+crypto.randomUUID();container.id=id;
  const complete=document.createElement('button');complete.type='button';complete.textContent='Hoàn tất xác minh thử';
  complete.onclick=()=>options.callback('e2e:'+options.action+':'+crypto.randomUUID());
  const expire=document.createElement('button');expire.type='button';expire.textContent='Hết hạn xác minh thử';expire.onclick=()=>options['expired-callback']();
  container.append(complete,expire);return id;
 },remove(id){document.getElementById(id)?.replaceChildren();}
};`;
async function mockWidget(page:Page){await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js*',route=>route.fulfill({contentType:'application/javascript',body:widgetScript}));}
async function solve(page:Page){await page.getByRole('button',{name:'Hoàn tất xác minh thử',exact:true}).click();await expect(page.getByText('Đã xác minh chống bot.',{exact:true})).toBeVisible();}

test('Đăng ký cần xác minh, nhận OTP và xác thực email sau khi mã chống bot hết hạn',async({page,request},info)=>{
  await mockWidget(page);await page.goto('/explore?auth=register');
  const email=`turnstile-${info.project.name}@ui-test.edu.vn`,dialog=page.getByRole('dialog',{name:'Đăng ký',exact:true});
  await dialog.getByLabel(/^Họ và tên/).fill('Sinh viên chống bot');await dialog.getByLabel(/^Email sinh viên/).fill(email);
  await dialog.getByLabel(/^Mã sinh viên/).fill('TS-'+info.project.name);await dialog.getByLabel(/^Trường đại học/).selectOption('ĐH Công nghệ Đồng Nai');
  await dialog.getByLabel(/^Mật khẩu/).fill('TurnstilePass123');await dialog.getByLabel(/^Xác nhận mật khẩu/).fill('TurnstilePass123');
  const submit=dialog.getByRole('button',{name:'Tạo tài khoản',exact:true});await expect(submit).toBeDisabled();await solve(page);await expect(submit).toBeEnabled();
  await page.getByRole('button',{name:'Hết hạn xác minh thử'}).click();await expect(submit).toBeDisabled();await solve(page);
  await submit.click();const verification=page.getByRole('dialog',{name:'Xác thực email',exact:true});await expect(verification).toBeVisible();
  const mail=await (await request.get(seed.mailOrigin+'/?email='+encodeURIComponent(email))).json();expect(mail.code).toMatch(/^\d{6}$/);
  await verification.getByLabel(/^Mã xác thực 6 số/).fill(mail.code);await verification.getByRole('button',{name:'Xác thực email',exact:true}).click();await expect(verification).not.toBeVisible();
  expect((await (await page.request.get('/api/auth/me')).json()).user.email).toBe(email);
});

test('Yêu cầu OTP, thử lại với token mới và đổi email giữ xác minh đúng',async({page,request},info)=>{
  await page.clock.install();await mockWidget(page);await page.goto('/explore?auth=login');await page.getByRole('button',{name:'Quên mật khẩu?',exact:true}).click();
  const email=seed.accounts[info.project.name].email;await page.getByLabel('Email đã đăng ký',{exact:true}).fill(email);
  const send=page.getByRole('button',{name:'Gửi mã xác thực',exact:true});await expect(send).toBeDisabled();await solve(page);
  const first=page.waitForRequest(r=>r.url().endsWith('/api/auth/forgot-password'));await send.click();const sent=(await first).postDataJSON();expect(sent.turnstileToken).toContain('e2e:reset_password:');
  await expect(page.getByLabel('Email nhận mã',{exact:true})).toBeVisible();expect((await (await request.get(seed.mailOrigin+'/?email='+encodeURIComponent(email))).json()).code).toMatch(/^\d{6}$/);
  await page.clock.runFor(61000);const resend=page.getByRole('button',{name:'Gửi lại mã',exact:true});await expect(resend).toBeDisabled();await solve(page);
  const second=page.waitForRequest(r=>r.url().endsWith('/api/auth/forgot-password'));await resend.click();expect((await second).postDataJSON().turnstileToken).not.toBe(sent.turnstileToken);
  await expect(page.getByRole('button',{name:'Đổi email nhận mã',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Đổi email nhận mã',exact:true}).click();await expect(page.getByRole('dialog').locator('button.auth-submit')).toBeDisabled();await expect(page.getByLabel('Email đã đăng ký',{exact:true})).toHaveValue(email);
});

test('Phiếu hỗ trợ giữ nội dung khi token lỗi, gửi thành công và chống dùng lại',async({page},info)=>{
  await mockWidget(page);const account=seed.accounts[info.project.name];expect((await page.request.post('/api/auth/login',{data:account})).status()).toBe(200);await page.goto('/support');
  const subject='Phiếu Turnstile '+info.project.name;
  await page.getByLabel('Tiêu đề yêu cầu',{exact:true}).fill(subject);await page.getByLabel('Mô tả vấn đề',{exact:true}).fill('Tôi cần được hướng dẫn sử dụng chức năng hỗ trợ.');
  const submit=page.getByRole('button',{name:'Gửi yêu cầu hỗ trợ',exact:true});await expect(submit).toBeDisabled();await solve(page);
  let firstToken='';await page.route('**/api/support',async route=>{
    if(route.request().method()!=='POST')return route.fallback();
    const body=route.request().postDataJSON();firstToken=body.turnstileToken;await route.continue({postData:JSON.stringify({...body,turnstileToken:'invalid-token'})});
  });
  await submit.click();await expect(page.locator('#tao-phieu').getByRole('alert')).toContainText('Xác minh chống bot');await expect(page.getByLabel('Tiêu đề yêu cầu',{exact:true})).toHaveValue(subject);await expect(submit).toBeDisabled();
  await page.unroute('**/api/support');await solve(page);
  const submitted=page.waitForRequest(r=>r.url().endsWith('/api/support')&&r.method()==='POST');await submit.click();const body=(await submitted).postDataJSON();expect(body.turnstileToken).not.toBe(firstToken);
  await expect(page.getByRole('region',{name:'Chi tiết phiếu hỗ trợ'}).getByRole('heading',{name:subject,exact:true})).toBeVisible();
  expect((await page.request.post('/api/support',{data:body})).status()).toBe(403);
  await page.screenshot({path:info.outputPath('turnstile-support.png')});
});

test('Backend chặn gửi trực tiếp thiếu/sai token, sai hostname/action và provider lỗi',async({request},info)=>{
  for(const path of ['/api/auth/forgot-password','/api/auth/resend-verification']){
    expect((await request.post(path,{data:{email:'unknown@ui-test.edu.vn'}})).status()).toBe(403);
    expect((await request.post(path,{data:{email:'unknown@ui-test.edu.vn',turnstileToken:'invalid'}})).status()).toBe(403);
  }
  expect((await request.post('/api/auth/register',{multipart:{email:'bot@ui-test.edu.vn'}})).status()).toBe(403);
  expect((await request.post('/api/auth/forgot-password',{data:{email:'unknown@ui-test.edu.vn',turnstileToken:token('register')}})).status()).toBe(403);
  expect((await request.post('/api/auth/forgot-password',{data:{email:'unknown@ui-test.edu.vn',turnstileToken:token('reset_password')+':wrong-host'}})).status()).toBe(403);
  expect((await request.post('/api/auth/forgot-password',{data:{email:'unknown@ui-test.edu.vn',turnstileToken:'provider-down'}})).status()).toBe(503);
  const valid=token('resend_verification');expect((await request.post('/api/auth/resend-verification',{data:{email:'unknown@ui-test.edu.vn',turnstileToken:valid}})).status()).toBe(200);
  expect((await request.post('/api/auth/resend-verification',{data:{email:'unknown@ui-test.edu.vn',turnstileToken:valid}})).status()).toBe(403);
  expect((await request.post('/api/auth/login',{data:seed.accounts[info.project.name]})).status()).toBe(200);
  const before=(await (await request.get('/api/support')).json()).total;
  expect((await request.post('/api/support',{data:{subject:'Không có xác minh',category:'OTHER',content:'Không được tạo phiếu nếu chưa xác minh.'}})).status()).toBe(403);
  expect((await (await request.get('/api/support')).json()).total).toBe(before);
});

test('Script Cloudflare bị chặn có thể thử lại, không mất dữ liệu và không tràn mobile',async({page},info)=>{
  await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js*',route=>route.abort());await page.goto('/explore?auth=register');
  await page.getByLabel(/^Họ và tên/).fill('Tên vẫn được giữ');await expect(page.getByText(/Xác minh chưa thành công hoặc đã hết hạn/)).toBeVisible();
  await expect(page.getByRole('button',{name:'Tạo tài khoản',exact:true})).toBeDisabled();await mockWidget(page);await page.getByRole('button',{name:'Thử lại xác minh',exact:true}).click();await solve(page);
  await expect(page.getByLabel(/^Họ và tên/)).toHaveValue('Tên vẫn được giữ');await expect(page.getByRole('button',{name:'Tạo tài khoản',exact:true})).toBeEnabled();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath('turnstile-register.png')});
});
