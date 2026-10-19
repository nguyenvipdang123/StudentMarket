import { transaction } from "./db";
import { ApiError, isUUID } from "./api-error";
import { expireReservations, reservationEvent } from "./reservations";
export async function markSold(listingId: string, sellerId: string, viaSangTay: boolean, buyerIdentifier: string, reservationId?: string) {
  if (!isUUID(listingId)) throw new ApiError("Không tìm thấy tin.",404);
  return transaction(async c => {
    const { rows:[p] } = await c.query("SELECT * FROM products WHERE id=$1 FOR UPDATE",[listingId]);
    if (!p) throw new ApiError("Không tìm thấy tin.",404);
    if (p.seller_id !== sellerId) throw new ApiError("Bạn không phải chủ tin.",403);
    if (p.status !== "Active" || p.moderation_status !== "APPROVED") throw new ApiError("Tin phải đang hiển thị và được duyệt.",409);
    await expireReservations(c,listingId);
    const {rows:[hold]}=await c.query("SELECT * FROM listing_reservations WHERE listing_id=$1 AND status='CONFIRMED'",[listingId]);
    if (reservationId && hold?.id!==reservationId) throw new ApiError("Lịch giữ chỗ đã hết hạn hoặc không còn được xác nhận.",409);
    if (hold && !viaSangTay) throw new ApiError("Món đồ đang được giữ chỗ. Hủy lịch trước khi ghi nhận bán ngoài hệ thống.",409);
    const active = await c.query("SELECT id FROM transactions WHERE listing_id=$1 AND status IN ('SELLER_CONFIRMED','COMPLETED')",[listingId]);
    if(active.rows.length) throw new ApiError("Tin đã có giao dịch.",409);
    let transactionId: string | null = null;
    if (viaSangTay) {
      const {rows:[buyer]} = await c.query(`SELECT u.id FROM users u JOIN conversations cv ON cv.buyer_id=u.id
        WHERE cv.product_id=$1 AND cv.seller_id=$2 AND (u.id::text=$3 OR LOWER(u.email)=LOWER($3)) AND u.status='Verified' LIMIT 1`,
        [listingId,sellerId,buyerIdentifier]);
      if (!buyer || buyer.id === sellerId) throw new ApiError("Chọn UUID hoặc email của người mua đã nhắn tin về sản phẩm này.");
      if (hold && hold.buyer_id!==buyer.id) throw new ApiError("Món đồ đang được giữ cho người mua khác. Hủy lịch trước khi đổi người mua.",409);
      const {rows:[t]} = await c.query(`INSERT INTO transactions(id,listing_id,seller_id,buyer_id,status,sale_source,seller_confirmed_at)
        VALUES(gen_random_uuid(),$1,$2,$3,'SELLER_CONFIRMED','SANGTAY',NOW()) RETURNING id`,[listingId,sellerId,buyer.id]);
      transactionId=t.id;
    }
    if (hold) {
      await c.query("UPDATE listing_reservations SET status='FULFILLED',updated_at=NOW() WHERE id=$1",[hold.id]);
      await reservationEvent(c,hold.id,hold.buyer_id,'Người bán đã ghi nhận giao đồ',p.title+' · Vào Giao dịch của tôi để xác nhận sau khi đã nhận và kiểm tra món đồ.');
    }
    await c.query("UPDATE listing_reservations SET status='EXPIRED',updated_at=NOW() WHERE listing_id=$1 AND status='PENDING'",[listingId]);
    await c.query("UPDATE products SET status='Sold',updated_at=NOW() WHERE id=$1",[listingId]);
    return {success:true, transactionId, status:viaSangTay?"SELLER_CONFIRMED":"Sold", message:viaSangTay?"Đang chờ người mua xác nhận.":"Đã đánh dấu bán ngoài hệ thống."};
  });
}
export async function confirmSale(id: string, buyerId: string, confirm: boolean) {
  if (!isUUID(id) || typeof confirm !== "boolean") throw new ApiError("Dữ liệu xác nhận không hợp lệ.");
  return transaction(async c => {
    const {rows:[t]} = await c.query("SELECT * FROM transactions WHERE id=$1 FOR UPDATE",[id]);
    if(!t) throw new ApiError("Không tìm thấy giao dịch.",404);
    if(t.buyer_id!==buyerId) throw new ApiError("Chỉ người mua được xác nhận.",403);
    if(t.status!=="SELLER_CONFIRMED") throw new ApiError("Giao dịch đã kết thúc hoặc chưa sẵn sàng xác nhận.",409);
    const status=confirm?"COMPLETED":"CANCELLED";
    await c.query("UPDATE transactions SET status=$2,buyer_confirmed_at=CASE WHEN $3 THEN NOW() ELSE NULL END,completed_at=CASE WHEN $3 THEN NOW() ELSE NULL END WHERE id=$1",[id,status,confirm]);
    await c.query("UPDATE products SET status=$2,updated_at=NOW() WHERE id=$1",[t.listing_id,confirm?"Sold":"Active"]);
    return {success:true,status,message:confirm?"Đã xác nhận mua hàng.":"Đã hủy giao dịch."};
  });
}

