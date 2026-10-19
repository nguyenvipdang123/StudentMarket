import assert from "node:assert/strict";

/** Runs only against the isolated integration database; never seed the live catalogue. */
export async function testCatalogSearch({ db, req, sellerId, check }) {
  assert.match(db.database, /^student_market_test_[a-f0-9]{12}$/);
  const original = (await db.query("SELECT full_name,university FROM users WHERE id=$1", [sellerId])).rows[0];
  const ids = [];
  let packageId;
  const search = async (values = {}, route = "/api/products") => {
    const result = await req(route + "?" + new URLSearchParams({ q: "catalogfixture", ...values }));
    assert.equal(result.status, 200); return result.data;
  };
  try {
    await db.query("UPDATE users SET full_name='Người Bán Độc Quyền',university='Trường Đại học Kinh tế Thành phố Hồ Chí Minh' WHERE id=$1", [sellerId]);
    for (let i = 1; i <= 35; i++) {
      const status = i === 34 ? "Hidden" : i === 35 ? "Sold" : "Active";
      const moderation = i === 32 ? "PENDING" : i === 33 ? "REJECTED" : "APPROVED";
      const row = await db.query(`INSERT INTO products(id,user_id,seller_id,category_id,title,description,price,condition,type,status,location,university,view_count,created_at,updated_at,moderation_status)
        VALUES(gen_random_uuid(),$1,$1,$2,$3,$4,$5,'Tốt',$6,$7,'Thủ Đức','Trường Đại học Kinh tế Thành phố Hồ Chí Minh',0,'2026-01-01','2026-01-01',$8) RETURNING id`,
      [sellerId, 1 + i % 3, `Sách phân trang ${i} catalogfixture`, i === 1 ? "Đèn bàn 100% special_code \\x" : "Giáo trình sinh viên", i % 5 ? i * 10000 : 0, i % 5 ? "Sell" : "Exchange", status, moderation]);
      ids.push(row.rows[0].id);
    }
    const first = await search({ sort: "newest" }), second = await search({ sort: "newest", page: "2" }), third = await search({ sort: "newest", page: "3" });
    assert.deepEqual(first.pagination, { page: 1, pageSize: 12, total: 31, totalPages: 3, hasPrevious: false, hasNext: true });
    assert.equal(first.products.length, 12); assert.equal(second.products.length, 12); assert.equal(third.products.length, 7);
    const ordered = [...first.products, ...second.products, ...third.products].map(p => p.id);
    assert.equal(new Set(ordered).size, 31); assert.deepEqual(ordered, [...ids.slice(0, 31)].sort().reverse());
    assert.deepEqual((await search({ sort: "newest" })).products.map(p => p.id), first.products.map(p => p.id));
    const beyond = await search({ page: "100000" }); assert.equal(beyond.pagination.page, 3); assert.equal(beyond.products.length, 7);
    assert.equal((await search({}, "/api/listings")).pagination.total, 31);
    check("catalogue server pagination is bounded, stable, complete, and hides pending/rejected/hidden/sold listings");

    assert.equal((await search({ q: "SACH TRANG PHAN catalogfixture" })).pagination.total, 31);
    assert.equal((await search({ q: "catalogfixture nguoi ban doc quyen" })).pagination.total, 31);
    for (const q of ["catalogfixture 100%", "catalogfixture special_code", "catalogfixture \\x"]) assert.equal((await search({ q })).pagination.total, 1);
    assert.equal((await search({ q: "' OR 1=1 --" })).pagination.total, 0);
    const empty = await search({ q: "no-results-catalogfixture" }); assert.equal(empty.products.length, 0); assert.equal(empty.pagination.totalPages, 0); assert.equal(empty.pagination.page, 1);
    for (const school of ["UEH", "ĐH Kinh tế TP.HCM", "Trường Đại học Kinh tế Thành phố Hồ Chí Minh"]) assert.equal((await search({ school })).pagination.total, 31);
    assert.equal((await search({ school: "DNTU" })).pagination.total, 0);
    for (const [value, expected] of [["ĐẶNG Đèn Ắ Ừ ộ", "dang den a u o"], ["A&B", "a&b"]]) assert.equal((await db.query("SELECT market_search_text($1) AS text", [value])).rows[0].text, expected);
    check("server search handles Vietnamese, words across seller/product fields, literal wildcards, injection attempts and university aliases");

    const filtered = await search({ category: "Học tập", minPrice: "100000", maxPrice: "300000", kind: "sell", condition: "Tốt", sort: "price-desc", pageSize: "48" });
    assert.ok(filtered.products.length > 0);
    assert.ok(filtered.products.every(p => p.category === "Học tập" && p.price >= 100000 && p.price <= 300000 && p.condition === "Tốt"));
    assert.deepEqual(filtered.products.map(p => p.price), filtered.products.map(p => p.price).sort((a, b) => b - a));
    for (const [section, predicate] of [["dorm", p => p.category === "Nội thất"], ["study", p => ["Học tập", "Công nghệ"].includes(p.category)], ["budget", p => p.price > 0 && p.price < 200000], ["exchange", p => p.price === 0]]) {
      const result = await search({ section, pageSize: "4" }); assert.ok(result.products.length > 0); assert.ok(result.products.length <= 4); assert.ok(result.products.every(predicate));
    }
    assert.deepEqual((await search({ section: "new", pageSize: "4" })).products.map(p => p.id), first.products.slice(0, 4).map(p => p.id));
    const excluded = await search({ exclude: first.products[0].id, pageSize: "3" }); assert.equal(excluded.products.length, 3); assert.equal(excluded.pagination.total, 30); assert.ok(excluded.products.every(p => p.id !== first.products[0].id));
    check("server category/price/condition/kind filters and bounded home sections/related listings cover the whole catalogue");

    packageId = (await db.query("INSERT INTO promotion_packages(name,duration_hours,price,priority) VALUES('Search test',24,5000,1) RETURNING id")).rows[0].id;
    const promoted = [...ids.slice(0, 31)].sort()[0];
    for (const priority of [2, 7]) await db.query("INSERT INTO listing_promotions(id,listing_id,user_id,package_id,status,start_at,end_at,price,payment_status,priority_snapshot) VALUES(gen_random_uuid(),$1,$2,$3,'ACTIVE',NOW()-INTERVAL '1 hour',NOW()+INTERVAL '1 hour',5000,'PAID',$4)", [promoted, sellerId, packageId, priority]);
    const featured = await search(); assert.equal(featured.products[0].id, promoted); assert.equal(featured.products[0].promotion.priority, 7); assert.equal(featured.pagination.total, 31); assert.equal(new Set(featured.products.map(p => p.id)).size, 12);
    assert.equal((await search({ sort: "newest" })).products[0].id, first.products[0].id);
    check("featured priority preserves paid promotion snapshots without duplicate products across active promotions");
    for (const values of [{ page: "0" }, { pageSize: "9999" }, { page: "-1" }, { page: "1.2" }, { sort: "id;DROP TABLE products" }, { minPrice: "200", maxPrice: "100" }, { category: "invalid" }, { q: "x".repeat(201) }]) assert.equal((await req("/api/products?" + new URLSearchParams(values))).status, 400);
    check("public catalogue rejects malformed pagination, oversized search, invalid filters and SQL sort injection");
  } finally {
    await db.query("DELETE FROM products WHERE id=ANY($1::uuid[])", [ids]);
    if (packageId) await db.query("DELETE FROM promotion_packages WHERE id=$1", [packageId]);
    await db.query("UPDATE users SET full_name=$2,university=$3 WHERE id=$1", [sellerId, original.full_name, original.university]);
  }
}
