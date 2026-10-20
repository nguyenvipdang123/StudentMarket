import { test, expect, browse, cards } from "./fixtures";

test("đổi trang chậm có báo chờ và tự kết thúc khi nội dung sẵn sàng", async ({ page }, info) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/how-it-works?**", async route => {
    if (route.request().headers().rsc === "1") await gate;
    await route.continue();
  });
  try {
    await browse(page);
    if (info.project.name === "mobile") await page.getByRole("button", { name: "Mở menu", exact: true }).click();
    await page.locator("#main-navigation").getByRole("link", { name: "Cách hoạt động", exact: true }).click();
    await expect(page.locator(".navigation-wait")).toBeVisible();
    await expect(page.locator(".navigation-wait").getByRole("status")).toHaveText("Đang mở trang…");
    // Reduced-motion users still get a visible static pending indicator.
    await expect(page.locator(".navigation-wait .wait-spinner")).toHaveCSS("animation-name", "none");
    if (info.project.name === "desktop") await page.screenshot({ path: info.outputPath("navigation-wait.png"), animations: "disabled" });
    release();
    await expect(page).toHaveURL(/\/how-it-works$/);
    await expect(page.locator(".navigation-wait")).toHaveCount(0);
    await page.goBack();
    await expect(cards(page)).toHaveCount(12);
    await expect(page.locator(".navigation-wait")).toHaveCount(0);
  } finally { release(); }
});

test("đợi dữ liệu sản phẩm có skeleton, tự thay bằng tin thật và không tràn màn hình", async ({ page }, info) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/products?**", async route => { await gate; await route.continue(); });
  try {
    await page.goto("/explore");
    const skeleton = page.locator(".section-loading").first();
    await expect(skeleton.getByRole("status")).toHaveText("Đang tìm món đồ cho bạn…");
    await expect(skeleton.locator(".listing-skeleton")).not.toHaveCount(0);
    expect(await skeleton.locator(".listing-skeleton").first().evaluate(element => getComputedStyle(element, "::after").animationName)).toBe("none");
    const layout = await page.evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth }));
    expect(layout.content).toBeLessThanOrEqual(layout.width + 1);
    if (info.project.name === "desktop") await skeleton.screenshot({ path: info.outputPath("product-wait.png"), animations: "disabled" });
    release();
    await expect(cards(page)).toHaveCount(12);
    await expect(page.locator(".section-loading")).toHaveCount(0);
  } finally { release(); }
});

test("chuyển trang không tạo hoạt ảnh khi người dùng chọn giảm chuyển động", async ({ page }) => {
  await browse(page);
  expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
  expect(await page.locator(".page-transition").evaluate(element => element.getAnimations().map(animation => animation.id))).not.toContain("sangtay-page-enter");
});
