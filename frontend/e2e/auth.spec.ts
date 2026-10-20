import { test, expect, seed, login, cards } from "./fixtures";

test("Google trả lỗi phải mở đăng nhập và hiển thị lý do, đóng hộp thoại xóa lỗi khỏi URL", async ({ page }) => {
  await page.goto("/explore?authError=school_google&q=laptop");
  const dialog = page.getByRole("dialog", { name: "Đăng nhập", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/Vui lòng dùng tài khoản Google Workspace của trường/)).toBeVisible();
  await dialog.getByRole("button", { name: "Đóng", exact: true }).click();
  await expect(page).not.toHaveURL(/authError=/);
  await expect(page).toHaveURL(/q=laptop/);
  await page.reload();
  await expect(page.getByRole("dialog", { name: "Đăng nhập", exact: true })).toHaveCount(0);
});

test("Google xác thực xong phải mở form hoàn tất tài khoản, không tự tạo phiên từ URL", async ({ page }) => {
  await page.goto("/explore?auth=google-complete");
  const dialog = page.getByRole("dialog", { name: "Hoàn tất tài khoản Google", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel(/^Mã sinh viên/)).toBeVisible();
  expect((await (await page.request.get("/api/auth/me")).json()).user).toBeNull();
  const result = await page.request.post("/api/auth/google/complete", { headers: { Origin: new URL(page.url()).origin }, data: { fullName: "Không có phiên Google", studentId: "NO-GOOGLE", university: "ĐH Công nghệ Đồng Nai" } });
  expect(result.status()).toBe(401);
});

test("đăng nhập sai báo lỗi, đăng nhập đúng tạo phiên và đăng xuất được", async ({ page }, info) => {
  const account = seed.accounts[info.project.name];
  await page.goto("/explore?auth=login");
  const dialog = page.getByRole("dialog", { name: "Đăng nhập", exact: true });
  await dialog.getByLabel(/Email đã đăng ký/).fill(account.email); await dialog.getByLabel(/^Mật khẩu/).fill("WrongPass123");
  await dialog.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(dialog.getByRole("alert")).toHaveText("Email hoặc mật khẩu không đúng.");
  await dialog.getByLabel(/^Mật khẩu/).fill(account.password); await dialog.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.locator(".user-profile-button").click();
  await page.locator(".user-dropdown-menu").getByRole("button", { name: /Đăng xuất/ }).click();
  await expect(page.locator(".user-profile-button")).toHaveCount(0);
  const response = await page.request.get("/api/auth/me"); expect((await response.json()).user).toBeNull();
});
test("đăng ký đổi yêu cầu ảnh thẻ theo email và kiểm tra mật khẩu nhập lại", async ({ page }, info) => {
  await page.goto("/explore?auth=register");
  const dialog = page.getByRole("dialog", { name: "Đăng ký", exact: true });
  await dialog.getByLabel(/^Email sinh viên/).fill("outside@example.com");
  await expect(dialog.getByLabel(/^Ảnh thẻ sinh viên/)).toHaveJSProperty("required", true);
  await dialog.getByLabel(/^Email sinh viên/).fill(`mismatch-${info.project.name}@ui-test.edu.vn`);
  await expect(dialog.getByLabel(/^Ảnh thẻ sinh viên/)).toHaveJSProperty("required", false);
  await dialog.getByLabel(/^Họ và tên/).fill("Sinh viên kiểm thử"); await dialog.getByLabel(/^Mã sinh viên/).fill("MISMATCH-" + info.project.name);
  await dialog.getByLabel(/^Trường đại học/).selectOption("ĐH Công nghệ Đồng Nai");
  await dialog.getByLabel(/^Mật khẩu/).fill("NewPass123"); await dialog.getByLabel(/^Xác nhận mật khẩu/).fill("Different123");
  await dialog.getByRole("button", { name: "Tạo tài khoản", exact: true }).click();
  await expect(dialog.getByRole("alert")).toHaveText("Xác nhận mật khẩu không khớp.");
});
test("đăng ký email edu nhận mã qua SMTP giả lập và xác thực trên giao diện", async ({ page, request }, info) => {
  const email = `new-${info.project.name}@ui-test.edu.vn`;
  await page.goto("/explore?auth=register");
  const dialog = page.getByRole("dialog", { name: "Đăng ký", exact: true });
  await dialog.getByLabel(/^Họ và tên/).fill("Sinh viên mới " + info.project.name);
  await dialog.getByLabel(/^Email sinh viên/).fill(email); await dialog.getByLabel(/^Mã sinh viên/).fill("NEW-" + info.project.name);
  await dialog.getByLabel(/^Trường đại học/).selectOption("ĐH Công nghệ Đồng Nai");
  await dialog.getByLabel(/^Mật khẩu/).fill("NewPass12345"); await dialog.getByLabel(/^Xác nhận mật khẩu/).fill("NewPass12345");
  await dialog.getByRole("button", { name: "Tạo tài khoản", exact: true }).click();
  const verification = page.getByRole("dialog", { name: "Xác thực email", exact: true }); await expect(verification).toBeVisible();
  let code = "";
  await expect.poll(async () => { code = (await (await request.get(seed.mailOrigin + "/?email=" + encodeURIComponent(email))).json()).code; return code; }).toMatch(/^\d{6}$/);
  await verification.getByLabel(/^Mã xác thực 6 số/).fill(code); await verification.getByRole("button", { name: "Xác thực email", exact: true }).click();
  await expect(verification).not.toBeVisible();
  const current = (await (await page.request.get("/api/auth/me")).json()).user;
  expect(current.email).toBe(email); expect(current.status).toBe("verified");
});
test("trang quản trị yêu cầu đăng nhập và từ chối tài khoản sinh viên", async ({ page }, info) => {
  await page.goto("/admin"); await expect(page.getByRole("dialog", { name: "Đăng nhập", exact: true })).toBeVisible();
  await login(page, seed.accounts[info.project.name]);
  await page.goto("/admin"); await expect(page).not.toHaveURL(/\/admin(?:\?|$)/);
  await expect(page.getByRole("heading", { name: "Admin Dashboard", exact: true })).toHaveCount(0);
});
test("Admin đăng nhập và mở kiểm duyệt, thông báo ở desktop và mobile", async ({ page }, info) => {
  await login(page, seed.accounts.admin);
  await expect(page.getByRole("heading", { name: "Admin Dashboard", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Mở trợ lý SangTay" })).toHaveCount(0);
  if (info.project.name === "mobile") await page.getByRole("button", { name: "Mở menu quản trị" }).click();
  await page.getByRole("complementary", { name: "Thanh bên quản trị" }).getByRole("button", { name: /^Kiểm duyệt tin/ }).click();
  await expect(page.getByRole("heading", { name: "Kiểm duyệt tin đăng", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /^Thông báo/ }).click();
  await expect(page.getByRole("region", { name: "Danh sách thông báo" })).toBeVisible();
});
test("lưu sản phẩm qua giao diện và xem lại sau tải trang", async ({ page }, info) => {
  await login(page, seed.accounts[info.project.name]);
  await expect(cards(page)).toHaveCount(12);
  const button = cards(page).first().getByRole("button", { name: /^Lưu / });
  await button.click(); await expect(cards(page).first().getByRole("button", { name: /^Bỏ lưu / })).toHaveAttribute("aria-pressed", "true");
  await page.goto("/saved");
  await expect(page.getByRole("link", { name: seed.products[0].title, exact: true }).first()).toBeVisible();
  await page.reload(); await expect(page.getByRole("link", { name: seed.products[0].title, exact: true }).first()).toBeVisible();
});
