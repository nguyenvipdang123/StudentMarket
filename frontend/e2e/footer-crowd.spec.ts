import { test, expect, browse } from "./fixtures";
import type { Locator } from "@playwright/test";

async function canvasHash(canvas: Locator) {
  return canvas.evaluate((element: HTMLCanvasElement) => {
    const data = element.getContext("2d")!.getImageData(0, 0, element.width, element.height).data;
    let hash = 0;
    for (let i = 0; i < data.length; i += 68) hash = Math.imul(hash ^ data[i] ^ data[i + 3], 16777619);
    return hash;
  });
}

test("đám đông nằm sau footer, tải khi đến gần, có hình thật và dừng/tiếp tục được", async ({ page }, info) => {
  const spriteRequests: string[] = [];
  page.on("request", request => { if (request.url().includes("open-peeps-crowd.png")) spriteRequests.push(request.url()); });
  await browse(page);
  await expect(page.locator(".footer-crowd")).toHaveCount(0);
  expect(spriteRequests).toHaveLength(0);
  await page.locator(".footer-crowd-slot").scrollIntoViewIfNeeded();
  const section = page.getByRole("region", { name: "Cộng đồng SangTay", exact: true });
  await expect(section).toBeVisible();
  const canvas = section.locator("canvas");
  await expect(canvas).toHaveAttribute("data-ready", "true");
  await expect(canvas).toHaveAttribute("data-playing", "false");
  expect(await canvasHash(canvas)).not.toBe(0);
  expect(await page.locator("footer").evaluate(element => element.nextElementSibling?.classList.contains("footer-crowd-slot"))).toBe(true);
  await expect(section.getByRole("link", { name: "Skiper UI", exact: true })).toBeVisible();
  await section.screenshot({ path: info.outputPath("footer-crowd.png"), animations: "disabled" });
  await section.getByRole("button", { name: "Tiếp tục chuyển động", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-playing", "true");
  const moving = await canvasHash(canvas);
  await expect.poll(() => canvasHash(canvas)).not.toBe(moving);
  await section.getByRole("button", { name: "Tạm dừng chuyển động", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-playing", "false");
  const frozen = await canvasHash(canvas);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  expect(await canvasHash(canvas)).toBe(frozen);
  await section.getByRole("button", { name: "Tiếp tục chuyển động", exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(canvas).toHaveAttribute("data-playing", "false");
  await page.locator(".footer-crowd-slot").scrollIntoViewIfNeeded();
  await expect(canvas).toHaveAttribute("data-playing", "true");
  const layout = await page.evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth }));
  expect(layout.content).toBeLessThanOrEqual(layout.width + 1);
});

test("ảnh đám đông lỗi vẫn giữ footer và nút điều hướng hoạt động", async ({ page }) => {
  await page.route("**/illustrations/open-peeps-crowd.png", route => route.fulfill({ status: 404, body: "" }));
  await browse(page);
  await page.locator(".footer-crowd-slot").scrollIntoViewIfNeeded();
  await expect(page.getByText("Cùng nhau tạo nên cộng đồng SangTay.", { exact: true })).toBeVisible();
  await expect(page.locator("footer").getByText(/Sàn trao đổi P2P làm bằng sự tử tế/)).toBeVisible();
  await page.locator("footer").getByRole("link", { name: "Cách hoạt động", exact: true }).click();
  await expect(page).toHaveURL(/\/how-it-works$/);
});
