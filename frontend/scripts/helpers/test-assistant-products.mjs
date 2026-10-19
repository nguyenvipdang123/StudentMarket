import assert from "node:assert/strict";

export async function testAssistantProducts({ db, origin, sellerId, mock, check }) {
  assert.match(db.database, /^student_market_test_[a-f0-9]{12}$/);
  const original = (await db.query("SELECT university FROM users WHERE id=$1", [sellerId])).rows[0];
  const ids = [], forbidden = [];
  let requests = 0;
  async function ask(message, { cookie = "", school = "", headers = {} } = {}) {
    const response = await fetch(origin + "/api/assistant/chat", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json", "X-Forwarded-For": "assistant-test-client", ...(cookie ? { Cookie: cookie } : {}), ...headers }, body: JSON.stringify({ message, school }) });
    requests++;
    const text = await response.text();
    const events = text.split("\n\n").filter(f => f.startsWith("data:")).map(f => JSON.parse(f.slice(5).trim()));
    return { status: response.status, text, event: events.at(-1), cookie: response.headers.get("set-cookie")?.split(";")[0] };
  }
  try {
    mock.setReady(false);
    const initialCalls = mock.calls.length;
    await db.query("UPDATE users SET university='Đại học Công nghệ Đồng Nai' WHERE id=$1", [sellerId]);
    for (let i = 1; i <= 13; i++) {
      const status = i === 10 ? "Hidden" : i === 11 ? "Sold" : "Active";
      const moderation = i === 12 ? "PENDING" : i === 13 ? "REJECTED" : "APPROVED";
      const row = (await db.query(`INSERT INTO products(id,user_id,seller_id,category_id,title,description,price,condition,type,status,location,university,view_count,created_at,updated_at,moderation_status)
        VALUES(gen_random_uuid(),$1,$1,2,$2,$3,$4,'Tốt','Sell',$5,'Thư viện DNTU','Đại học Công nghệ Đồng Nai',0,NOW()-($6::int * INTERVAL '1 minute'),NOW(),$7) RETURNING id`,
      [sellerId, `Laptop ChatTest ${i}`, i > 9 ? "PRIVATE_CHATBOT_FIXTURE_DO_NOT_EXPOSE" : "Laptop dùng học tập", i >= 9 ? 5000000 : 500000 + i * 300000, status, i, moderation])).rows[0];
      ids.push(row.id); if (i >= 9) forbidden.push(row.id);
    }
    const query = "Tìm laptop chattest dưới 5 triệu ở DNTU";
    const first = await ask(query, { school: "UEH" });
    assert.equal(first.status, 200); assert.equal(first.event.event, "assistant/products"); assert.ok(first.cookie);
    const firstData = first.event.data;
    assert.equal(firstData.products.length, 4); assert.equal(firstData.hasMore, true);
    assert.ok(firstData.products.every(p => p.price < 5000000 && p.school === "Đại học Công nghệ Đồng Nai"));
    assert.equal(first.text.includes("PRIVATE_CHATBOT_FIXTURE"), false);
    for (const id of forbidden) assert.equal(first.text.includes(id), false);
    for (const product of firstData.products) assert.deepEqual(Object.keys(product).sort(), ["id", "title", "price", "image", "school", "location", "condition", "freeGift"].sort());
    assert.equal(mock.calls.length, initialCalls);
    check("assistant retrieves four live approved products from PostgreSQL even while Gemini/PDF upstream is offline; private fields stay excluded");

    const next = await ask("Xem thêm", { cookie: first.cookie });
    assert.equal(next.status, 200); assert.equal(next.event.data.products.length, 4); assert.equal(next.event.data.hasMore, false);
    assert.equal(next.event.data.products.some(p => firstData.products.some(q => q.id === p.id)), false);
    const ended = await ask("Xem thêm", { cookie: first.cookie }); assert.equal(ended.event.data.products.length, 0);
    const fresh = await ask("Xem thêm"); assert.equal(fresh.event.event, "assistant/partial"); assert.match(fresh.event.data.text, /Bạn muốn tìm món đồ nào/);
    const cheap = await ask("Rẻ hơn", { cookie: first.cookie }); assert.equal(cheap.status, 200); assert.ok(cheap.event.data.products.length); assert.ok(cheap.event.data.products.every(p => p.price < 2000000));
    const school = await ask("Ở UEH", { cookie: first.cookie }); assert.equal(school.event.data.products.length, 0);
    const preferred = await ask("Tìm laptop chattest dưới 5 triệu", { school: "DNTU" }); assert.equal(preferred.event.data.products.length, 4);
    check("assistant remembers filters for more/cheaper/school follow-ups and keeps independent browser sessions separate");

    await db.query("UPDATE products SET status='Hidden' WHERE id=$1", [firstData.products[0].id]);
    const current = await ask(query); assert.equal(current.event.data.products.some(p => p.id === firstData.products[0].id), false);
    const destination = new URL(current.event.data.searchUrl, origin);
    assert.equal(destination.pathname, "/explore"); assert.equal(destination.searchParams.get("q"), "laptop chattest"); assert.equal(destination.searchParams.get("school"), "ĐH Công nghệ Đồng Nai"); assert.equal(destination.searchParams.get("maxPrice"), "4999999");
    const canonical = await (await fetch(origin + "/api/products?" + destination.searchParams)).json();
    assert.ok(current.event.data.products.every(p => canonical.products.some(q => q.id === p.id && q.price === p.price && q.title === p.title)));
    const empty = await ask("Tìm laptop chattest dưới 100k ở DNTU"); assert.equal(empty.event.data.products.length, 0); assert.match(empty.event.data.text, /chưa tìm thấy/);
    const invalid = await ask("Tìm laptop từ 5 triệu đến 1 triệu"); assert.equal(invalid.event.event, "assistant/partial");
    assert.equal(mock.calls.length, initialCalls);
    check("assistant rechecks live visibility and prices every turn, preserves filters in Explore links and never invents missing products");

    const crossOrigin = await ask(query, { headers: { Origin: "https://evil.invalid" } }); assert.equal(crossOrigin.status, 403);
    const invalidSchool = await ask(query, { school: 123 }); assert.equal(invalidSchool.status, 400);
    mock.setReady(true);
    const faq = await ask("Làm sao để đăng tin?", { cookie: current.cookie }); assert.equal(faq.status, 200); assert.equal(faq.event.event, "assistant/partial"); assert.match(faq.event.data.text, /^FAQ giữ nguyên/);
    assert.deepEqual(mock.calls.slice(initialCalls), ["/api/status", "/threads", "/api/chat"]);
    const afterFaq = await ask("Xem thêm", { cookie: current.cookie }); assert.equal(afterFaq.event.event, "assistant/partial");
    assert.ok(requests < 30);
    check("assistant origin/input guards still apply and existing FAQ/AI streams continue on their original upstream path");
  } finally {
    await db.query("DELETE FROM products WHERE id=ANY($1::uuid[])", [ids]);
    await db.query("UPDATE users SET university=$2 WHERE id=$1", [sellerId, original.university]);
  }
}
