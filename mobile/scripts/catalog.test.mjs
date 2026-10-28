import assert from "node:assert/strict";
import test from "node:test";
import { catalogPath } from "../src/api/catalog.ts";
import { SOUTHERN_UNIVERSITIES, findUniversity, universityMatchesQuery } from "../src/data/universities.ts";
import { SOUTHERN_UNIVERSITIES as webUniversities } from "../../frontend/lib/universities.ts";
import { parseListingQuery } from "../../frontend/lib/listing-query.ts";

test("mobile school options stay aligned with the website and API aliases", () => {
  assert.deepEqual(SOUTHERN_UNIVERSITIES, webUniversities);
  const dntu = findUniversity("DNTU");
  assert.ok(dntu);
  assert.ok(universityMatchesQuery(dntu, "dai hoc cong nghe dong nai"));
  assert.ok(universityMatchesQuery(dntu, "dntu"));
  assert.ok(!universityMatchesQuery(dntu, "UEH"));
  assert.ok(universityMatchesQuery(findUniversity("HCMUTE"), "SPKT"));
});

test("refresh and pagination send the selected school with the other API filters", () => {
  const filters = { search: "Sách & vở", school: findUniversity("DNTU").name, category: "Học tập", sort: "price-asc" };
  const first = parseListingQuery(new URL(catalogPath(filters), "https://sangtay.shop").searchParams);
  const next = parseListingQuery(new URL(catalogPath(filters, 2), "https://sangtay.shop").searchParams);
  assert.equal(first.school, "ĐH Công nghệ Đồng Nai");
  assert.equal(first.search, "Sách & vở");
  assert.equal(first.page, 1);
  assert.equal(next.page, 2);
  assert.deepEqual({ ...next, page: 1 }, first);
});

test("changing or clearing school starts at page one while retaining search and category", () => {
  const filters = { search: "bàn", school: "ĐH Công nghệ Đồng Nai", category: "Nội thất", sort: "newest" };
  for (const school of [findUniversity("UTH").name, ""]) {
    const parsed = parseListingQuery(new URL(catalogPath({ ...filters, school }), "https://sangtay.shop").searchParams);
    assert.equal(parsed.school, school);
    assert.equal(parsed.page, 1);
    assert.equal(parsed.category, "Nội thất");
    assert.equal(parsed.search, "bàn");
  }
});
