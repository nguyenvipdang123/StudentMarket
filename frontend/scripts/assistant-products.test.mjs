import test from "node:test";
import assert from "node:assert/strict";
import { productIntent } from "../lib/assistant-product-intent.ts";
import { assistantAnswer } from "../lib/assistant-answer.ts";
const search = text => { const result = productIntent(text); assert.equal(result?.type, "search", text); return result.search; };

test("product intent extracts Vietnamese item, precise money bounds and schools without consuming brand/model numbers", () => {
  for (const text of ["Tìm laptop dưới 5 triệu ở DNTU", "Bạn tìm giúp tôi laptop dưới 5.000.000đ ở DNTU", "Tìm laptop dưới 5000k ở Đại học Công nghệ Đồng Nai"]) {
    const result = search(text); assert.equal(result.q, "laptop"); assert.equal(result.maxPrice, "4999999"); assert.equal(result.school, "ĐH Công nghệ Đồng Nai");
  }
  assert.equal(search("Tìm laptop dưới 1,5 triệu ở UEH").maxPrice, "1499999");
  const range = search("Mình muốn mua sách từ 100k đến 300k"); assert.equal(range.minPrice, "100000"); assert.equal(range.maxPrice, "300000"); assert.equal(range.q, "sach");
  const inferred = search("Tìm laptop từ 1 đến 2 triệu"); assert.equal(inferred.minPrice, "1000000"); assert.equal(inferred.maxPrice, "2000000");
  assert.equal(search("Tìm Dell Latitude 5400 dưới 3 triệu").q, "dell latitude 5400");
  assert.equal(search("Tìm console").q, "console");
  assert.equal(search("Còn laptop không?").q, "laptop");
  assert.equal(search("Hiện có cuốn sách nào không?").q, "sach");
  assert.equal(search("Tìm tất cả sản phẩm").q, "");
  assert.equal(search("Tìm laptop giá rẻ").sort, "price-asc");
  assert.equal(search("Tìm sách ở Trường Đại học Kinh tế Thành phố Hồ Chí Minh").school, "ĐH Kinh tế TP.HCM");
  assert.equal(search("Tìm sách ở ĐH Kinh tế TPHCM").q, "sach");
});
test("free exchange, category, condition and sorting are expressed as validated catalogue filters", () => {
  const free = search("Có đồ trao đổi miễn phí không?"); assert.equal(free.kind, "exchange"); assert.equal(free.q, "");
  const item = search("Tìm laptop như mới giá thấp đến cao"); assert.equal(item.condition, "Như mới"); assert.equal(item.sort, "price-asc"); assert.equal(item.q, "laptop");
  assert.equal(search("Tìm đồ phòng trọ").category, "Nội thất");
  assert.equal(search("Tìm sách mới nhất").sort, "newest");
});

test("cheapest questions use the catalogue directly and preserve existing scope instead of searching below its minimum", () => {
  for(const question of ['Món nào rẻ nhất','Món nào rẻ nhất?','Sản phẩm nào rẻ nhất','Có món rẻ nhất không','Rẻ nhất']){
    const intent=productIntent(question,undefined,'ĐH Công nghệ Đồng Nai');
    assert.equal(intent.type,'search');assert.equal(intent.search.q,'');assert.equal(intent.search.sort,'price-asc');assert.equal(intent.search.school,'ĐH Công nghệ Đồng Nai');
  }
  const previous={search:{...search('Tìm laptop dưới 5 triệu ở DNTU'),page:3},minimumPrice:0};
  const result=productIntent('Món nào rẻ nhất',previous);
  assert.equal(result.type,'search');assert.deepEqual(result.search,{...previous.search,sort:'price-asc',page:1});
});
test("follow-ups preserve item/school, change bounds, page and price without trusting client history", () => {
  const context = { search: search("Tìm laptop dưới 5 triệu ở DNTU"), minimumPrice: 2000000 };
  const next = productIntent("Xem thêm", context); assert.equal(next.search.page, 2); assert.equal(next.search.q, "laptop");
  const cheaper = productIntent("Rẻ hơn", context); assert.equal(cheaper.search.maxPrice, "1999999"); assert.equal(cheaper.search.sort, "price-asc");
  const school = productIntent("Ở UEH", context); assert.equal(school.search.q, "laptop"); assert.equal(school.search.school, "ĐH Kinh tế TP.HCM");
  const budget = productIntent("Trên 1 triệu và dưới 2 triệu", context); assert.equal(budget.search.minPrice, "1000001"); assert.equal(budget.search.maxPrice, "1999999");
  assert.equal(productIntent("Xem thêm")?.type, "clarify");
  assert.equal(productIntent("Rẻ hơn", { ...context, minimumPrice: 0 })?.type, "clarify");
  assert.equal(productIntent("Tìm laptop từ 5 triệu đến 1 triệu")?.type, "clarify");
  assert.equal(productIntent("Tìm laptop dưới -1 triệu")?.type, "clarify");
  assert.equal(productIntent("Tìm " + "x".repeat(300))?.type, "clarify");
  assert.equal(productIntent("Tìm sách", undefined, "ĐH Công nghệ Đồng Nai").search.school, "ĐH Công nghệ Đồng Nai");
});
test("FAQ, account operations and general conversation keep their existing answer path", () => {
  for (const question of ["Xin chào", "Cảm ơn", "Làm sao để đăng tin?", "Cách tìm sản phẩm?", "Tìm sản phẩm ở đâu?", "Đăng tin có mất phí không?", "Có thể trao đổi đồ không?", "Cách thanh toán gói đẩy tin", "Tôi muốn bán laptop", "Tôi muốn đăng bán laptop", "Cách liên hệ người bán"]) assert.equal(productIntent(question), null, question);
  assert.equal(search("Tìm laptop đang bán ở DNTU").q, "laptop");
});
test("structured product replies accept only real UUID links and safe bounded cards, retaining legacy text events", () => {
  const product = { id: "00000000-0000-4000-8000-000000000001", title: "<script>plain text</script>", price: 100000, image: "/sample/khac.svg", school: "DNTU", location: "Đồng Nai", condition: "Tốt", freeGift: false };
  const reply = { event: "assistant/products", data: { text: "Tìm được tin", products: [product], searchUrl: "/explore?q=laptop", hasMore: true } };
  assert.equal(assistantAnswer(reply).products[0].title, product.title);
  for (const patch of [{ id: "../../admin" }, { price: -1 }, { image: "javascript:alert(1)" }]) assert.throws(() => assistantAnswer({ ...reply, data: { ...reply.data, products: [{ ...product, ...patch }] } }));
  assert.throws(() => assistantAnswer({ ...reply, data: { ...reply.data, searchUrl: "https://evil.invalid/" } }));
  assert.throws(() => assistantAnswer({ ...reply, data: { ...reply.data, products: Array(5).fill(product) } }));
  assert.equal(assistantAnswer({ event: "assistant/partial", data: { text: "FAQ" } }).text, "FAQ");
  assert.equal(assistantAnswer({ event: "updates", data: { directAnswer: { messages: [{ type: "ai", content: "FAQ answer" }] } } }).text, "FAQ answer");
});
