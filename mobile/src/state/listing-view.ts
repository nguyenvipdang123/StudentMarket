import type { Product, User } from "../api/types.ts";
/** Seller/buyer is relative to this listing, never a user-controlled UI switch. */
export function listingView(product: Product, user: User | null) {
  return user?.pgUserId && user.pgUserId === product.sellerId ? "seller" : "buyer";
}
export function listingStatus(product: Product) {
  if (product.status === "Sold") return "Đã sang tay";
  if (product.status === "Hidden") return "Đã ẩn";
  if (product.moderationStatus === "REJECTED") return "Cần chỉnh sửa";
  if (product.moderationStatus === "PENDING") return "Chờ kiểm duyệt";
  return "Đang hiển thị";
}
