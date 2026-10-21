import { test, expect, seed, cards, browse } from "./fixtures";

test("trang chủ tải 12 tin công khai, ảnh và bố cục vừa màn hình", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Đồ cũ còn tốt/ })).toBeVisible();
  await expect(cards(page)).toHaveCount(12);
  await expect(page.locator(".results-count")).toHaveText("28 món đồ");
  await expect(page.getByText(/Tin E2E không công khai/)).toHaveCount(0);
  const image = cards(page).first().getByRole("img", { name: seed.products[0].title, exact: true }); await image.scrollIntoViewIfNeeded();
  await expect(image).toHaveJSProperty("complete", true);
  await expect(image).not.toHaveJSProperty("naturalWidth", 0);
  const layout = await page.evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth }));
  expect(layout.content).toBeLessThanOrEqual(layout.width + 1);
});
test("chuyển trang lấy dữ liệu server, không trùng sản phẩm", async ({ page }) => {
  await browse(page);
  const first = await cards(page).locator(".figma-card-title").allTextContents();
  const pagination = page.getByRole("navigation", { name: "Phân trang sản phẩm" });
  await pagination.getByRole("button", { name: "Trang 2", exact: true }).click();
  await expect(pagination.getByRole("button", { name: "Trang 2", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(cards(page)).toHaveCount(12);
  const second = await cards(page).locator(".figma-card-title").allTextContents();
  expect(second.some(title => first.includes(title))).toBe(false);
  await pagination.getByRole("button", { name: "Trang 3", exact: true }).click();
  await expect(cards(page)).toHaveCount(4);
  await expect(pagination.getByRole("button", { name: "Sau →", exact: true })).toBeDisabled();
});
test("tìm kiếm không dấu trên toàn database và đổi từ khóa về trang đầu", async ({ page }) => {
  await browse(page);
  await page.getByRole("navigation", { name: "Phân trang sản phẩm" }).getByRole("button", { name: "Trang 2", exact: true }).click();
  await expect(page.getByRole("button", { name: "Trang 2", exact: true })).toHaveAttribute("aria-current", "page");
  const request = page.waitForResponse(response => response.url().includes("/api/products?") && new URL(response.url()).searchParams.get("q") === "laptop e2e 28");
  await page.getByLabel("Tìm kiếm món đồ").fill("laptop e2e 28");
  await page.getByLabel("Tìm kiếm món đồ").press("Enter");
  const result = await (await request).json(); expect(result.pagination.page).toBe(1);
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).first()).toContainText("Laptop E2E 28");
  await page.getByLabel("Xóa tìm kiếm").click(); await expect(cards(page)).toHaveCount(12);
  await expect(page.getByRole("button", { name: "Trang 1", exact: true })).toHaveAttribute("aria-current", "page");
});
test("lọc danh mục, khoảng giá và sắp xếp được áp dụng cùng nhau", async ({ page }) => {
  await browse(page);
  await page.getByRole("group", { name: "Danh mục sản phẩm" }).getByRole("button", { name: "Học tập", exact: true }).click();
  await expect(page.locator(".results-count")).toHaveText("14 món đồ");
  await page.getByRole("button", { name: /^Bộ lọc/ }).click();
  await page.getByLabel("Giá từ (đ)", { exact: true }).fill("100000");
  await page.getByLabel("Đến (đ)", { exact: true }).fill("150000");
  await page.getByLabel("Sắp xếp sản phẩm").selectOption("price-desc");
  await expect(cards(page)).toHaveCount(6);
  const prices = (await cards(page).locator(".figma-card-price").allTextContents()).map(text => Number(text.replace(/\D/g, "")));
  expect(prices).toEqual([150000, 140000, 130000, 120000, 110000, 100000]);
  await page.getByRole("button", { name: "Xóa bộ lọc", exact: true }).click();
  await expect(page.locator(".results-count")).toHaveText("28 món đồ");
});
test("chọn trường bằng mã và giữ lựa chọn sau tải lại", async ({ page }) => {
  await browse(page);
  await page.locator(".market-region").getByRole("button", { name: "Đổi trường", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Bạn muốn tìm ở trường nào?" });
  await dialog.getByLabel("Tìm trường đại học").fill("UEH");
  await dialog.getByRole("button", { name: /ĐH Kinh tế TP.HCM/ }).click();
  await dialog.getByRole("button", { name: /Xem tin của ĐH Kinh tế TP.HCM/ }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator(".results-count")).toHaveText("14 món đồ");
  await expect(cards(page).first()).toContainText("Laptop");
  await page.reload();
  await expect(page.locator(".market-region")).toContainText("ĐH Kinh tế TP.HCM");
  await expect(page.locator(".results-count")).toHaveText("14 món đồ");
});
test("hiện trạng thái không có kết quả và xóa tìm kiếm để quay lại", async ({ page }) => {
  await browse(page);
  await page.getByLabel("Tìm kiếm món đồ").fill("khong-co-san-pham-e2e"); await page.getByLabel("Tìm kiếm món đồ").press("Enter");
  await expect(page.getByRole("heading", { name: "Chưa tìm thấy món đồ phù hợp" })).toBeVisible();
  await expect(page.locator(".results-count")).toHaveText("0 món đồ");
  await page.getByLabel("Xóa tìm kiếm").click(); await expect(cards(page)).toHaveCount(12);
});
test("lỗi tải sản phẩm có thông báo và thử lại thành công", async ({ page }) => {
  let fail = true;
  await page.route("**/api/products?**", async route => {
    if (fail && !new URL(route.request().url()).searchParams.has("section")) { fail = false; return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Kết nối thử nghiệm bị gián đoạn." }) }); }
    return route.continue();
  });
  await page.goto("/explore");
  const alert = page.getByRole("alert").filter({ has: page.getByRole("heading", { name: "Chưa tải được tin đăng" }) });
  await expect(alert).toBeVisible(); await alert.getByRole("button", { name: "Thử lại" }).click();
  await expect(cards(page)).toHaveCount(12);
});
test("mở chi tiết và hồ sơ người bán từ tin thật trong database kiểm thử", async ({ page }) => {
  await browse(page);
  await cards(page).first().getByRole("link", { name: seed.products[0].title, exact: true }).click();
  await expect(page.getByRole("heading", { name: seed.products[0].title, exact: true })).toBeVisible();
  await expect(page).toHaveURL(new RegExp("/listing/" + seed.products[0].id));
  await page.getByRole("link", { name: "Xem hồ sơ người bán" }).click();
  await expect(page).toHaveURL(new RegExp("/seller/" + seed.accounts.seller.userId));
  await expect(page.getByRole("heading", { name: "E2E seller", exact: true })).toBeVisible();
});

test("URL giữ số trang sau F5 và khôi phục khi Back/Forward", async ({ page }) => {
  await browse(page);
  const pagination = page.getByRole("navigation", { name: "Phân trang sản phẩm" });
  await pagination.getByRole("button", { name: "Trang 2", exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.locator("#listing-results")).toHaveAttribute("aria-label", "Sản phẩm trang 2");
  const titles = await cards(page).locator(".figma-card-title").allTextContents();
  await page.reload();
  await expect(page.locator("#listing-results")).toHaveAttribute("aria-label", "Sản phẩm trang 2");
  await expect(cards(page).locator(".figma-card-title")).toHaveText(titles);
  await pagination.getByRole("button", { name: "Trang 3", exact: true }).click();
  await expect(cards(page)).toHaveCount(4);
  await page.goBack();
  await expect(page.locator("#listing-results")).toHaveAttribute("aria-label", "Sản phẩm trang 2");
  await expect(cards(page).locator(".figma-card-title")).toHaveText(titles);
  await page.goForward();
  await expect(page.locator("#listing-results")).toHaveAttribute("aria-label", "Sản phẩm trang 3");
  await expect(cards(page)).toHaveCount(4);
});

test("chia sẻ bộ lọc đầy đủ, tải lại và trở về từ chi tiết không mất điều kiện", async ({ page, context }) => {
  await browse(page);
  await page.getByLabel("Tìm kiếm món đồ").fill("e2e");
  await page.getByLabel("Tìm kiếm món đồ").press("Enter");
  await page.getByRole("group", { name: "Danh mục sản phẩm" }).getByRole("button", { name: "Học tập", exact: true }).click();
  await page.getByRole("button", { name: /^Bộ lọc/ }).click();
  await page.getByLabel("Giá từ (đ)", { exact: true }).fill("100000");
  await page.getByLabel("Đến (đ)", { exact: true }).fill("150000");
  await page.getByLabel("Sắp xếp sản phẩm").selectOption("price-desc");
  await expect(cards(page)).toHaveCount(6);
  const url = page.url(), params = new URL(url).searchParams;
  expect(params.get("q")).toBe("e2e"); expect(params.get("category")).toBe("Học tập");
  expect(params.get("minPrice")).toBe("100000"); expect(params.get("maxPrice")).toBe("150000"); expect(params.get("sort")).toBe("price-desc");
  const titles = await cards(page).locator(".figma-card-title").allTextContents();
  await page.reload();
  await expect(cards(page).locator(".figma-card-title")).toHaveText(titles);
  await expect(page.getByLabel("Tìm kiếm món đồ")).toHaveValue("e2e");
  await cards(page).first().getByRole("link", { name: titles[0], exact: true }).click();
  await expect(page).toHaveURL(/\/listing\//); await page.goBack();
  await expect(cards(page).locator(".figma-card-title")).toHaveText(titles);
  const shared = await context.newPage(); await shared.goto(url);
  await expect(cards(shared).locator(".figma-card-title")).toHaveText(titles); await shared.close();
  await page.getByRole("button", { name: /^Bộ lọc/ }).click();
  await page.getByRole("button", { name: "Xóa bộ lọc", exact: true }).click();
  await expect(cards(page)).toHaveCount(12);
  expect(new URL(page.url()).searchParams.has("q")).toBe(false);
});
