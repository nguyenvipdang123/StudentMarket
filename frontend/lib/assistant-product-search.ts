import { assistantSearchFilters, assistantSearchParameters, type AssistantSearch, type ProductContext } from "./assistant-product-intent";
import { searchPublicProducts } from "./public-product-search";
import type { AssistantAnswer } from "./assistant-answer";

export async function findAssistantProducts(search: AssistantSearch, more: boolean): Promise<{ answer: AssistantAnswer; context: ProductContext }> {
  let effective = { ...search };
  let result = await searchPublicProducts(assistantSearchFilters(effective));
  // Only equivalent item names may be retried; never relax price, school or visibility.
  if (!result.pagination.total && !more) {
    const variants = [["laptop", "may tinh xach tay"], ["tai nghe", "headphone"], ["balo", "ba lo"]];
    for (const [from, to] of variants) {
      if (!effective.q.includes(from)) continue;
      const candidate = { ...effective, q: effective.q.replace(from, to) };
      const retry = await searchPublicProducts(assistantSearchFilters(candidate));
      if (retry.pagination.total) { effective = candidate; result = retry; break; }
    }
  }
  const params = assistantSearchParameters(effective);
  const searchUrl = "/explore?" + params + "#marketplace-grid";
  const description = [effective.q ? `“${effective.q}”` : "món đồ", effective.school ? `tại ${effective.school}` : "", effective.minPrice ? `từ ${Number(effective.minPrice).toLocaleString("vi-VN")}đ` : "", effective.maxPrice ? `tối đa ${Number(effective.maxPrice).toLocaleString("vi-VN")}đ` : ""].filter(Boolean).join(" ");
  const ended = more && effective.page > result.pagination.page;
  const products = ended ? [] : result.products.map(product => ({ id: product.id, title: product.title, price: product.price, image: product.image, school: product.school || "", location: product.location || "", condition: product.condition || "", freeGift: product.price === 0 && product.description.startsWith("Tặng miễn phí.") }));
  const text = ended ? "Bạn đã xem hết các tin phù hợp hiện tại. Bạn có thể đổi trường, khoảng giá hoặc tên món đồ để tìm tiếp."
    : result.pagination.total ? `Mình tìm thấy ${result.pagination.total} tin ${description} đang hiển thị. ${more ? "Đây là các tin tiếp theo." : "Bạn có thể mở từng tin để xem chi tiết và liên hệ người bán."}`
      : `Hiện chưa tìm thấy tin ${description} phù hợp đang hiển thị. Bạn thử đổi tên món đồ, khoảng giá hoặc trường nhé.`;
  return {
    answer: { text, products, searchUrl, hasMore: !ended && result.pagination.hasNext },
    context: { search: { ...effective, page: result.pagination.page }, minimumPrice: result.products.length ? Math.min(...result.products.map(product => product.price)) : null },
  };
}
