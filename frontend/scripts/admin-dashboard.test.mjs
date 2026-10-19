import assert from "node:assert/strict";
import { test } from "node:test";
import { dashboardMoney, listingTrend } from "../lib/admin-dashboard.ts";

test("shows zero revenue as currency rather than an exchange listing", () => {
  assert.equal(dashboardMoney(0), "0đ");
  assert.equal(dashboardMoney(19000), "19.000đ");
});

test("counts listings by Vietnam calendar date, including the UTC midnight boundary", () => {
  const result = listingTrend([
    { createdAt: "2026-10-12T16:59:59Z" },
    { createdAt: "2026-10-12T17:00:00Z" },
    { createdAt: "2026-10-13T03:00:00Z" },
    { createdAt: "2026-10-13T17:00:00Z" },
    { createdAt: "invalid" },
  ], 7, new Date("2026-10-13T08:00:00Z"));
  assert.equal(result.length, 7);
  assert.equal(result[0].day, "2026-10-07");
  assert.equal(result[5].count, 1);
  assert.equal(result[6].count, 2);
  assert.equal(result.reduce((sum, day) => sum + day.count, 0), 3);
});

test("includes zero days and crosses month/year boundaries without losing dates", () => {
  const result = listingTrend([{ createdAt: "2025-12-31T23:00:00Z" }], 30, new Date("2026-01-02T05:00:00Z"));
  assert.equal(result.length, 30);
  assert.equal(result[0].day, "2025-12-04");
  assert.equal(result[28].day, "2026-01-01");
  assert.equal(result[28].count, 1);
  assert.equal(result[29].count, 0);
  assert.equal(new Set(result.map(day => day.day)).size, 30);
});

test("excludes listings outside the selected window", () => {
  const listings = [{ createdAt: "2026-10-01T05:00:00Z" }];
  const now = new Date("2026-10-13T05:00:00Z");
  assert.equal(listingTrend(listings, 7, now).reduce((sum, day) => sum + day.count, 0), 0);
  assert.equal(listingTrend(listings, 30, now).reduce((sum, day) => sum + day.count, 0), 1);
});
