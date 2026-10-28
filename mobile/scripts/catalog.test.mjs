import assert from "node:assert/strict";
import test from "node:test";
import { fetchCatalogue, selectProducts } from "../src/api/catalog.ts";
import { SOUTHERN_UNIVERSITIES, findUniversity, universityMatchesQuery } from "../src/data/universities.ts";
import { SOUTHERN_UNIVERSITIES as webUniversities } from "../../frontend/lib/universities.ts";


test("mobile school options stay aligned with the website and API aliases", () => {
  assert.deepEqual(SOUTHERN_UNIVERSITIES, webUniversities);
  const dntu = findUniversity("DNTU");
  assert.ok(dntu);
  assert.ok(universityMatchesQuery(dntu, "dai hoc cong nghe dong nai"));
  assert.ok(universityMatchesQuery(dntu, "dntu"));
  assert.ok(!universityMatchesQuery(dntu, "UEH"));
  assert.ok(universityMatchesQuery(findUniversity("HCMUTE"), "SPKT"));
});


const product = (id, category, school, title, price) => ({ id, category, school, title, price, description: "Đồ còn tốt", location: "Thư viện", seller: "Sinh viên", status: "Active" });
test("render selector combines category, accent-insensitive search and school without mutating raw data", () => {
  const raw = [product("a", "Học tập", "Đại học Công Nghệ Đồng Nai", "Sách lập trình", 70000), product("b", "Nội thất", "ĐH Công nghệ Đồng Nai", "Bàn học", 50000), product("c", "Học tập", "UTH", "Sách lập trình", 90000)];
  const filters = { search: "sach lap", category: "Học tập", school: "DNTU", sort: "featured" };
  assert.deepEqual(selectProducts(raw, filters).map(p => p.id), ["a"]);
  assert.deepEqual(selectProducts(raw, { ...filters, school: "" }).map(p => p.id), ["a", "c"]);
  assert.deepEqual(selectProducts(raw, { ...filters, search: "", category: "Tất cả", school: "", sort: "price-asc" }).map(p => p.id), ["b", "a", "c"]);
  assert.deepEqual(raw.map(p => p.id), ["a", "b", "c"]);
});
test("remote catalogue loads every unfiltered page before local search, deduplicating overlap", async () => {
  const calls=[];const a=product("a","Học tập","DNTU","Sách",20000),b=product("b","Nội thất","UTH","Bàn",50000);
  const raw=await fetchCatalogue(async path=>{ calls.push(path);const page=Number(new URL(path,"https://sangtay.shop").searchParams.get("page"));return {products:page===1?[a]:[a,b],pagination:{page,hasNext:page===1}}; });
  assert.equal(calls.length,2);assert.ok(calls.every(p=>!p.includes("q=")&&!p.includes("category=")&&!p.includes("school=")));
  assert.deepEqual(selectProducts(raw,{search:"ban",category:"Tất cả",school:"",sort:"featured"}).map(p=>p.id),["b"]);
  await assert.rejects(fetchCatalogue(async()=>({products:[],pagination:{page:1,hasNext:true}})));
});
