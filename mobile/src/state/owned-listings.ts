import type { Product } from "../api/types.ts";
import { categories, conditions } from "../api/types.ts";
import { validateDraft } from "../api/policy.ts";
export type OwnedDraft = { title: string; description: string; price: string; category: string; condition: string; location: string; kind: string; status: "Active" | "Hidden" };
export const validListingId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
export function ownsListing(item: Product, actor?: string) { return !!actor && item.sellerId === actor; }
export function ownedDraft(item: Product): OwnedDraft {
  const gift = item.price === 0 && (item.freeGift ?? item.description.startsWith("Tặng miễn phí."));
  return { title: item.title, description: gift ? item.description.replace(/^Tặng miễn phí\.\s*/, "") : item.description, price: String(item.price), category: item.category || "", condition: item.condition, location: item.location, kind: gift ? "Gift" : item.price === 0 ? "Exchange" : "Sell", status: item.status === "Hidden" ? "Hidden" : "Active" };
}
export function editListingPayload(draft: OwnedDraft, image: string, expectedStatus: string) {
  const invalid = validateDraft(draft);
  if (invalid) throw Error(invalid);
  if (!categories.slice(1).includes(draft.category) || !conditions.includes(draft.condition)) throw Error("Chọn danh mục và tình trạng hợp lệ.");
  if (!["Sell", "Gift", "Exchange"].includes(draft.kind) || !["Active", "Hidden"].includes(draft.status)) throw Error("Loại tin hoặc trạng thái không hợp lệ.");
  return { title: draft.title.trim(), description: (draft.kind === "Gift" ? "Tặng miễn phí. " : "") + draft.description.trim(), price: draft.kind === "Sell" ? Number(draft.price) : 0, category: draft.category, condition: draft.condition, location: draft.location.trim(), status: draft.status, expectedStatus,
    // Sample placeholders are not stored image URLs; keep existing secondary images on server.
    image: /^https?:\/\//i.test(image) || image.startsWith("/api/product-images/") ? image : "" };
}
export function soldPayload(viaSangTay: boolean, buyer: string) {
  const buyerId = buyer.trim();
  if (viaSangTay && !validListingId(buyerId) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerId)) throw Error("Nhập email hoặc mã người mua đã nhắn tin về món đồ này.");
  return { viaSangTay, buyerId: viaSangTay ? buyerId : "" };
}
