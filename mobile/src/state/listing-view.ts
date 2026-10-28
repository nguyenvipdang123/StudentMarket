import type { Product, User } from "../api/types.ts";
/** Seller/buyer is relative to this listing, never a user-controlled UI switch. */
export function listingView(product: Product, user: User | null) {
  return user?.pgUserId && user.pgUserId === product.sellerId ? "seller" : "buyer";
}
export function listingStatus(product: Product) {
  if (product.moderationStatus === "REJECTED") return "Cần chỉnh sửa";
  if (product.moderationStatus === "PENDING") return "Chờ kiểm duyệt";
  return product.status === "Sold" ? "Đã sang tay" : product.status === "Hidden" ? "Đã ẩn" : "Đang hiển thị";
}
