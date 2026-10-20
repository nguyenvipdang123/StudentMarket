import { test, expect, browse } from "./fixtures";

test.use({ launchOptions: { args: ["--enable-unsafe-swiftshader"] } });

test("robot Spline tải thật, tạm dừng/thu gọn được và không chặn chatbot", async ({ page }, info) => {
  test.setTimeout(90000);
  await browse(page);
  await page.getByRole("button", { name: "Hiện robot 3D", exact: true }).click();
  const robot = page.locator(".robot-widget");
  await expect(robot).toHaveAttribute("data-status", "ready", { timeout: 60000 });
  await expect(robot.locator("canvas")).toBeVisible();
  // The fixture requests reduced motion: keep the first frame static until asked to play.
  await expect(robot).toHaveAttribute("data-paused", "true");
  await page.getByRole("button", { name: "Tiếp tục robot 3D", exact: true }).click();
  await expect(robot).toHaveAttribute("data-paused", "false");
  await page.mouse.move(100, 100);
  await robot.screenshot({ path: info.outputPath("robot-3d.png"), animations: "disabled" });
  await page.getByRole("button", { name: "Tạm dừng robot 3D", exact: true }).click();
  await expect(robot).toHaveAttribute("data-paused", "true");
  await page.getByRole("button", { name: "Mở trợ lý SangTay", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Trợ lý SangTay", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Đóng trợ lý", exact: true }).click();
  await page.getByRole("button", { name: "Thu gọn robot 3D", exact: true }).click();
  expect(await page.evaluate(() => sessionStorage.getItem("sangtay_robot_collapsed"))).toBe("1");
  await expect(robot.locator("canvas")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Hiện robot 3D", exact: true })).toBeFocused();
  await page.reload();
  await expect(page.getByRole("button", { name: "Hiện robot 3D", exact: true })).toBeVisible();
  await expect(robot.locator("canvas")).toHaveCount(0);
  const layout = await page.evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth }));
  expect(layout.content).toBeLessThanOrEqual(layout.width + 1);
});

test("scene lỗi có dự phòng, có thể thu gọn và website vẫn tìm sản phẩm được", async ({ page }) => {
  await page.route("**/scenes/robot.splinecode", route => route.fulfill({ status: 503, body: "unavailable" }));
  await browse(page);
  await page.getByRole("button", { name: "Hiện robot 3D", exact: true }).click();
  await expect(page.locator(".robot-widget")).toHaveAttribute("data-status", "error", { timeout: 30000 });
  await page.getByRole("button", { name: "Thu gọn robot 3D", exact: true }).click();
  await page.getByLabel("Tìm kiếm món đồ").fill("laptop e2e 28");
  await page.getByLabel("Tìm kiếm món đồ").press("Enter");
  await expect(page.locator("#listing-results > article")).toHaveCount(1);
});
