import { transaction } from "./db";
import { ApiError, isUUID } from "./api-error";

export type OwnedListingAction = "hide" | "show" | "delete";
/** Keep product/history rows; only the authenticated seller can change visibility. */
export async function changeOwnedListing(id: string, sellerId: string, action: OwnedListingAction, expectedStatus?: string) {
  if (!isUUID(id)) throw new ApiError("Không tìm thấy tin.", 404);
  if (!["hide", "show", "delete"].includes(action)) throw new ApiError("Thao tác không hợp lệ.");
  if (expectedStatus !== undefined && !["Active", "Hidden", "Sold"].includes(expectedStatus)) throw new ApiError("Trạng thái tin không hợp lệ.");
  return transaction(async client => {
    const { rows: [product] } = await client.query("SELECT * FROM products WHERE id=$1 FOR UPDATE", [id]);
    if (!product) throw new ApiError("Không tìm thấy tin.", 404);
    if (product.seller_id !== sellerId) throw new ApiError("Bạn không phải chủ tin.", 403);
    if (product.status === "Deleted") {
      if (action !== "delete") throw new ApiError("Tin đã được xóa.", 404);
      return { success: true, status: "Deleted", message: "Tin đã được xóa khỏi danh sách." };
    }
    if (expectedStatus && product.status !== expectedStatus) throw new ApiError("Tin đã thay đổi. Tải lại danh sách trước khi thao tác.", 409);
    if (action !== "delete" && product.status === "Sold") throw new ApiError("Không thể ẩn hoặc đăng lại tin đã bán.", 409);
    const target = action === "delete" ? "Deleted" : action === "hide" ? "Hidden" : "Active";
    if (product.status === target) return { success: true, status: target, message: "Trạng thái tin không thay đổi." };
    const promotions = await client.query("SELECT id FROM listing_promotions WHERE listing_id=$1 AND status='ACTIVE' AND end_at>NOW() LIMIT 1", [id]);
    if (promotions.rows.length) throw new ApiError("Chờ gói đẩy tin kết thúc trước khi ẩn, đăng lại hoặc xóa tin.", 409);
    const orders = await client.query("SELECT id FROM promotion_orders WHERE listing_id=$1 AND payment_status='PENDING' AND (expires_at IS NULL OR expires_at>NOW()) LIMIT 1", [id]);
    if (orders.rows.length) throw new ApiError("Tin còn đơn đẩy tin chờ thanh toán. Hủy đơn hoặc chờ hết hạn trước khi thao tác.", 409);
    const reservations = await client.query("SELECT id FROM listing_reservations WHERE listing_id=$1 AND status IN ('PENDING','CONFIRMED') AND expires_at>NOW() LIMIT 1", [id]);
    if (reservations.rows.length) throw new ApiError("Tin còn lịch hẹn hoặc giữ chỗ. Hủy lịch trước khi ẩn, đăng lại hoặc xóa tin.", 409);
    const sales = await client.query("SELECT id FROM transactions WHERE listing_id=$1 AND status='SELLER_CONFIRMED' LIMIT 1", [id]);
    if (sales.rows.length) throw new ApiError("Chờ người mua xác nhận giao dịch trước khi xóa tin.", 409);
    if (action === "show") {
      // A seller cannot bypass an earlier moderator hide/rejection by showing the listing.
      await client.query("UPDATE products SET status='Active',moderation_status='PENDING',moderated_by=NULL,moderated_at=NULL,rejection_reason=NULL,updated_at=NOW() WHERE id=$1", [id]);
    } else {
      await client.query("UPDATE products SET status=$2,updated_at=NOW() WHERE id=$1", [id, target]);
    }
    return {
      success: true, status: target, moderationStatus: action === "show" ? "PENDING" : product.moderation_status,
      message: action === "delete" ? "Đã xóa tin khỏi danh sách. Lịch sử giao dịch và tin nhắn vẫn được giữ." : action === "hide" ? "Đã ẩn tin khỏi trang công khai." : "Đã gửi yêu cầu hiện lại. Tin sẽ hiển thị sau khi được duyệt.",
    };
  });
}
