import test from "node:test";
import assert from "node:assert/strict";
import {
  apiOrigin,
  mediaUrl,
  priceLabel,
  sessionCookie,
  validateDraft,
} from "../src/api/policy.ts";
test("production origin is HTTPS and never embeds credentials, paths or query strings", () => {
  assert.equal(apiOrigin("https://sangtay.shop"), "https://sangtay.shop");
  assert.equal(apiOrigin("http://10.0.2.2:3000"), "http://10.0.2.2:3000");
  for (const value of [
    "http://sangtay.shop",
    "https://secret:password@sangtay.shop",
    "https://sangtay.shop/evil",
    "https://sangtay.shop?key=secret",
  ])
    assert.throws(() => apiOrigin(value));
});
test("native session extracts only the exact application cookie and omits attributes", () => {
  const token = "a".repeat(64);
  assert.equal(
    sessionCookie(`sangtay_session=${token}; Path=/; HttpOnly; Secure`),
    `sangtay_session=${token}`,
  );
  assert.equal(
    sessionCookie(`other=x; Path=/, sangtay_session=${token}; Path=/`),
    `sangtay_session=${token}`,
  );
  for (const value of [
    null,
    "sangtay_session=; Max-Age=0",
    "other=token",
    "sangtay_session=short",
    "evil_sangtay_session=" + token,
  ])
    assert.equal(sessionCookie(value), null);
});
test("media paths resolve to the configured server, rejecting unsafe schemes", () => {
  assert.equal(
    mediaUrl("/api/product-images/test.jpg", "https://sangtay.shop"),
    "https://sangtay.shop/api/product-images/test.jpg",
  );
  for (const value of [
    "javascript:alert(1)",
    "file:///private",
    "//evil.invalid/image",
  ])
    assert.equal(mediaUrl(value, "https://sangtay.shop"), undefined);
});
test("listing forms validate before a real submission, keeping exchange and gift at zero", () => {
  const draft = {
    title: "Đèn bàn",
    description: "Đèn còn dùng tốt và có dây cắm.",
    price: "50000",
    location: "Thư viện",
    kind: "Sell",
  };
  assert.equal(validateDraft(draft), "");
  assert.ok(validateDraft({ ...draft, title: "a" }));
  for (const price of ["", "0", "-2", "NaN", "10000000000"])
    assert.ok(validateDraft({ ...draft, price }));
  assert.equal(validateDraft({ ...draft, kind: "Gift", price: "" }), "");
  assert.ok(
    validateDraft({ ...draft, kind: "Gift", description: "a".repeat(10000) }),
  );
  assert.equal(priceLabel(0, "Tặng miễn phí. Sách cũ"), "Tặng miễn phí");
  assert.equal(priceLabel(0), "Trao đổi");
  assert.equal(priceLabel(50000), "50.000đ");
});

test("saved cards use the explicit gift flag without needing a description", () => {
  assert.equal(priceLabel(0, "", true), "Tặng miễn phí");
  assert.equal(priceLabel(0, "", false), "Trao đổi");
  assert.equal(priceLabel(50000, "", true), "50.000đ");
  assert.equal(priceLabel(0, "Tặng miễn phí. Sách cũ"), "Tặng miễn phí");
});
