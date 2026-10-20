import { test as base, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

type Account = { email: string; password: string; userId: string | null };
export const seed = JSON.parse(readFileSync(process.env.STUDENTMARKET_E2E_FIXTURES!, "utf8")) as {
  accounts: Record<string, Account>;
  products: { id: string; title: string; price: number; public: boolean }[];
  mailOrigin: string;
};
export const test = base.extend<{ browserGuards: void }>({
  browserGuards: [async ({ page, context, baseURL }, use) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await context.addInitScript(() => {
      if (localStorage.getItem("sangtay_search_university_v1") === null) localStorage.setItem("sangtay_search_university_v1", "");
      // General UI tests keep the optional GPU widget collapsed; its own tests open it explicitly.
      sessionStorage.setItem("sangtay_robot_collapsed", "1");
    });
    await context.route("**/*", route => {
      const url = route.request().url();
      if (url.startsWith(baseURL + "/") || url.startsWith("data:") || url.startsWith("blob:")) return route.continue();
      return route.abort();
    });
    await use();
    expect(errors, "Lỗi JavaScript/hydration trong trình duyệt").toEqual([]);
  }, { auto: true }],
});
export { expect };
export const cards = (page: Page) => page.locator("#listing-results > article");
export async function browse(page: Page) {
  await page.goto("/explore");
  await expect(cards(page)).toHaveCount(12);
}
export async function login(page: Page, account: Account) {
  await page.goto("/explore?auth=login");
  const dialog = page.getByRole("dialog", { name: "Đăng nhập", exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel(/Email đã đăng ký/).fill(account.email);
  await dialog.getByLabel(/^Mật khẩu/).fill(account.password);
  await dialog.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect.poll(async () => (await (await page.request.get("/api/auth/me")).json()).user?.email).toBe(account.email);
}
