import {test,expect,seed,login} from './fixtures';

for(const motion of ['reduce','no-preference'] as const){
  test(`Đăng tin: Tiếp tục cuộn tới đầu bước mới, giữ lỗi tại bước hiện tại (${motion})`,async({page},info)=>{
    await page.emulateMedia({reducedMotion:motion});
    await login(page,seed.accounts[info.project.name]);await page.goto('/create-listing');
    const next=page.getByRole('button',{name:'Tiếp tục',exact:true});
    const expectStep=async(name:string)=>{
      const heading=page.getByRole('heading',{name,exact:true});
      await expect(heading).toBeFocused();
      await expect.poll(()=>heading.evaluate(el=>{
        const rect=el.getBoundingClientRect();
        const header=document.querySelector('.site-header')!.getBoundingClientRect();
        return rect.top>=header.bottom&&rect.bottom<window.innerHeight;
      })).toBe(true);
    };
    await next.click();await expectStep('Kể một chút về món đồ');
    await next.click();
    await expect(page.locator('#posting-form').getByRole('alert')).toContainText('Tên món đồ cần');
    await expect(page.locator('.figma-post-progress [aria-current="step"]')).toContainText('Thông tin');
    await page.getByLabel('Tên món đồ *',{exact:true}).fill('Đèn bàn học cũ');
    await page.getByLabel(/^Mô tả món đồ/).fill('Đèn hoạt động tốt, kèm dây nguồn.');
    await next.click();await expectStep('Giá phù hợp, hẹn gần bạn');
    await expect(page.getByLabel('Giá mong muốn (đ) *',{exact:true})).toBeInViewport();
    await page.screenshot({path:info.outputPath('next-step-scroll.png')});
    await page.getByLabel('Giá mong muốn (đ) *',{exact:true}).fill('50000');
    await next.click();await expectStep('Món đồ đã sẵn sàng sang tay');
    await expect(page.getByRole('heading',{name:'Đèn bàn học cũ',exact:true})).toBeVisible();
  });
}
