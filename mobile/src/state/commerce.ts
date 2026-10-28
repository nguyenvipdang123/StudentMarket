import type { Product } from "../api/types.ts";
export type Delivery = "pickup" | "delivery";
export function availability(product: Product, actorId?: string, now = Date.now()) {
  if (product.sellerId && product.sellerId === actorId) return "Bạn không thể mua món đồ của chính mình.";
  if (product.status !== "Active") return "Món đồ đã bán hoặc không còn khả dụng.";
  if (product.moderationStatus && product.moderationStatus !== "APPROVED") return "Tin chưa được duyệt để giao dịch.";
  if (product.reservedUntil && Date.parse(product.reservedUntil) > now) return "Món đồ đang được giữ chỗ. Vui lòng chọn món khác hoặc chờ hết hạn.";
  if (product.price === 0 && !(product.freeGift ?? product.description?.startsWith("Tặng miễn phí."))) return "Món trao đổi cần liên hệ người bán, không thêm vào giỏ mua hàng.";
  return "";
}
export function addCartItem(cart: Product[], product: Product, actorId?: string) {
  const reason = availability(product, actorId);
  if (reason) throw Error(reason);
  if (cart.some(p => p.id === product.id)) throw Error("Mỗi tin chỉ có 1 món. Món này đã nằm trong giỏ, không thể tăng số lượng.");
  return [...cart, product];
}
export function checkoutSummary(cart: Product[], delivery: Delivery) {
  const subtotal = cart.reduce((sum, product) => sum + product.price, 0);
  const sellers = new Set(cart.map(p => p.sellerId || p.id)).size;
  const deliveryFee = delivery === "delivery" ? sellers * 30000 : 0;
  return { subtotal, deliveryFee, total: subtotal + deliveryFee, sellers, count: cart.length };
}
// Any unknown/removed/reserved item blocks checkout, including network failure.
export async function checkCart(cart: Product[], get: (id: string) => Promise<Product>, actorId?: string) {
  const results = await Promise.all(cart.map(async old => {
    try {
      const product = await get(old.id);
      if (product.id !== old.id) throw Error("Mã món đồ không khớp.");
      return { product, error: availability(product, actorId), changed: product.price !== old.price };
    } catch { return { product: old, error: "Không xác minh được món đồ. Có thể tin đã ẩn/xóa hoặc mất kết nối.", changed: false }; }
  }));
  return { products: results.map(r => r.product), issues: Object.fromEntries(results.filter(r => r.error).map(r => [r.product.id, r.error])), priceChanged: results.some(r => r.changed) };
}
