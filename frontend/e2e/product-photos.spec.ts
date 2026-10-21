import {test,expect,seed,login} from './fixtures';
import {readFile} from 'node:fs/promises';

test('Ảnh đăng tin: biểu tượng gọn, chọn ảnh bìa và xóa ảnh trên desktop/mobile',async({page},info)=>{
  await login(page,seed.accounts[info.project.name]);
  await page.goto('/create-listing');
  const image=await readFile('public/figma/25-29571-imgHeroBooksAsset.png');
  const longName='anh-san-pham-voi-ten-rat-dai-'.repeat(6)+'.png';
  await page.getByLabel('Chọn ảnh sản phẩm',{exact:true}).setInputFiles([
    {name:longName,mimeType:'image/png',buffer:image},
    {name:'goc-chup-thu-hai.png',mimeType:'image/png',buffer:image},
  ]);
  const photos=page.locator('.figma-upload-photo');
  await expect(photos).toHaveCount(2);
  await expect(page.getByText('Ảnh đã chọn · 2 / 8',{exact:true})).toBeVisible();
  await expect(photos.first().locator(':scope > img')).toBeVisible();
  await expect(photos.first().getByRole('button',{name:'Ảnh bìa',exact:true})).toBeDisabled();
  for(const photo of await photos.all()){
    await expect(photo.locator(':scope > img')).toHaveJSProperty('complete',true);
    for(const icon of await photo.locator('.figma-icon').all()){
      const box=await icon.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeLessThanOrEqual(24);
      expect(box!.height).toBeLessThanOrEqual(24);
    }
    const remove=await photo.getByRole('button',{name:/Xóa ảnh/}).boundingBox();
    expect(remove!.width).toBeGreaterThanOrEqual(44);
    expect(remove!.height).toBeGreaterThanOrEqual(44);
    expect(await photo.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await photos.first().scrollIntoViewIfNeeded();
  await page.screenshot({path:info.outputPath('product-photos.png'),fullPage:true});

  await photos.nth(1).getByRole('button',{name:'Đặt làm ảnh bìa',exact:true}).click();
  await expect(photos.first().getByText('goc-chup-thu-hai.png',{exact:true})).toBeVisible();
  await photos.first().getByRole('button',{name:'Xóa ảnh 1',exact:true}).click();
  await expect(photos).toHaveCount(1);
  await expect(photos.first().getByText(longName,{exact:true})).toBeVisible();
  await expect(photos.first().getByRole('button',{name:'Ảnh bìa',exact:true})).toBeDisabled();
  await photos.first().getByRole('button',{name:'Xóa ảnh 1',exact:true}).click();
  await expect(photos).toHaveCount(0);
  await expect(page.getByText('Ảnh đã chọn · 0 / 8',{exact:true})).toBeVisible();
});
