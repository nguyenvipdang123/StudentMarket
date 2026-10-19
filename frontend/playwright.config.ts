import { defineConfig, devices } from "@playwright/test";
import { resolve } from "node:path";

if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(process.env.STUDENTMARKET_E2E_BASE_URL || "") || !/^student_market_e2e_[a-f0-9]{12}$/.test(process.env.STUDENTMARKET_E2E_DATABASE || "") || !process.env.STUDENTMARKET_E2E_RUN_DIR) {
  throw new Error("Chạy npm run test:e2e để tạo database và server kiểm thử riêng; không trỏ Playwright trực tiếp vào website đang dùng.");
}
const output = process.env.STUDENTMARKET_E2E_RUN_DIR;
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  maxFailures: 5,
  timeout: 45000,
  globalTimeout: 10 * 60 * 1000,
  expect: { timeout: 10000 },
  outputDir: resolve(output, "test-results"),
  reporter: [["list"], ["html", { outputFolder: resolve(output, "report"), open: "never" }], ["json", { outputFile: resolve(output, "results.json") }]],
  use: {
    baseURL: process.env.STUDENTMARKET_E2E_BASE_URL,
    locale: "vi-VN",
    timezoneId: "Asia/Bangkok",
    reducedMotion: "reduce",
    serviceWorkers: "block",
    headless: true,
    actionTimeout: 10000,
    navigationTimeout: 30000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } },
    { name: "mobile", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 }, defaultBrowserType: "chromium" } },
  ],
});
