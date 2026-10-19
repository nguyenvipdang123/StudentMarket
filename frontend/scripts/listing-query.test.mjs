import test from "node:test";
import assert from "node:assert/strict";
import { parseListingQuery, listingQuery, ListingQueryError } from "../lib/listing-query.ts";
const parse = params => parseListingQuery(new URLSearchParams(params));
test("catalogue query validates bounded pages, prices, filters and UUIDs", () => {
  assert.equal(parse({}).pageSize, 12); assert.equal(parse({ pageSize: "48", page: "100000" }).pageSize, 48);
  for (const params of [{ page: "0" }, { page: "-1" }, { page: "Infinity" }, { page: "1.5" }, { page: "100001" }, { pageSize: "49" }, { pageSize: "0" }, { sort: "__proto__" }, { sort: "price;drop table products" }, { minPrice: "NaN" }, { maxPrice: "-1" }, { minPrice: "200", maxPrice: "100" }, { maxPrice: "10000000000" }, { condition: "broken" }, { kind: "invalid" }, { category: "other" }, { exclude: "bad" }, { q: "a".repeat(201) }, { q: "a ".repeat(21) }]) assert.throws(() => parse(params), ListingQueryError);
});
test("search normalizes Vietnamese and escapes wildcard literals; user input stays in parameters", () => {
  const input = "SÁCH đèn 100% a_b \\x 'OR'";
  const query = listingQuery(parse({ q: input, school: "DNTU", sort: "price-desc" }));
  assert.ok(query.where.includes("p.moderation_status = 'APPROVED'"));
  assert.equal(query.where.includes("'OR'"), false);
  for (const value of ["%sach%", "%den%", "%100\\%%", "%a\\_b%", "%\\\\x%"]) assert.ok(query.values.includes(value), value);
  assert.ok(Array.isArray(query.values[0])); assert.ok(query.values[0].includes("dh cong nghe dong nai"));
  assert.equal(query.orderBy, "p.price DESC, p.created_at DESC, p.id DESC");
});
