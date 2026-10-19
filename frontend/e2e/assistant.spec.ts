import { test, expect, browse } from "./fixtures";

test("chatbot mở bằng nút, chọn câu hỏi và đóng bằng Escape trả focus", async ({ page }) => {
  await browse(page);
  const toggle = page.getByRole("button", { name: "Mở trợ lý SangTay", exact: true }); await toggle.click();
  const dialog = page.getByRole("dialog", { name: "Trợ lý SangTay", exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Tìm sách ở DNTU", exact: true }).click();
  await expect(dialog.getByLabel("Câu hỏi cho trợ lý")).toHaveValue("Tìm sách ở DNTU");
  await dialog.getByLabel("Câu hỏi cho trợ lý").press("Escape");
  await expect(dialog).not.toBeVisible(); await expect(toggle).toBeFocused();
});
test("chatbot trả thẻ sản phẩm thật, xem thêm và mở Khám phá cùng bộ lọc", async ({ page }) => {
  await browse(page); await page.getByRole("button", { name: "Mở trợ lý SangTay", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Trợ lý SangTay", exact: true });
  await dialog.getByLabel("Câu hỏi cho trợ lý").fill("Tìm sách e2e ở DNTU"); await dialog.getByRole("button", { name: "Gửi câu hỏi" }).click();
  await expect(dialog.locator(".assistant-products li")).toHaveCount(4);
  const first = await dialog.locator(".assistant-product strong").allTextContents();
  await dialog.getByRole("button", { name: "Xem thêm", exact: true }).click();
  await expect(dialog.locator(".assistant-products li")).toHaveCount(8);
  const all = await dialog.locator(".assistant-product strong").allTextContents(); expect(all.slice(4).some(title => first.includes(title))).toBe(false);
  await dialog.getByRole("link", { name: "Xem trong Khám phá →" }).last().click();
  await expect(dialog).not.toBeVisible(); await expect(page).toHaveURL(/\/explore\?q=sach\+e2e/);
  await expect(page.getByLabel("Tìm kiếm món đồ")).toHaveValue("sach e2e");
  await expect(page.locator(".market-region")).toContainText("ĐH Công nghệ Đồng Nai");
  await expect(page.locator(".results-count")).toHaveText("14 món đồ");
});
test("chatbot không bịa thẻ sản phẩm khi không có tin đúng ngân sách", async ({ page }) => {
  await browse(page); await page.getByRole("button", { name: "Mở trợ lý SangTay", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Trợ lý SangTay", exact: true });
  await dialog.getByLabel("Câu hỏi cho trợ lý").fill("Tìm laptop dưới 100k"); await dialog.getByRole("button", { name: "Gửi câu hỏi" }).click();
  await expect(dialog.locator(".assistant-message.assistant")).toContainText("chưa tìm thấy");
  await expect(dialog.locator(".assistant-products li")).toHaveCount(0);
  await expect(dialog.getByRole("link", { name: "Xem trong Khám phá →" })).toBeVisible();
});
