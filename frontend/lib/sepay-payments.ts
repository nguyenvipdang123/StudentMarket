import { randomBytes } from "node:crypto";
import type { PoolClient, QueryResultRow } from "pg";
import type { AuthenticatedUser } from "./auth-pg";
import { ApiError, isUUID } from "./api-error";
import { query, transaction } from "./db";
import { bankMatches, missingSePaySettings, paymentCode, paymentEventFingerprint, sepayConfig, sepayQr, type SePayEvent } from "./sepay-policy";

export function paymentOrder(row: QueryResultRow) {
  const details = row.payment_details;
  const expired = row.expires_at && new Date(row.expires_at).getTime() <= Date.now();
  const status = row.payment_status === "PAID" ? "PAID" : row.review_required ? "REVIEW" : row.payment_status !== "PENDING" ? row.payment_status : expired ? "EXPIRED" : "PENDING";
  const ready = missingSePaySettings().length === 0;
  return { id: row.id as string, listingId: row.listing_id as string, listingTitle: String(row.listing_title || ""), packageId: Number(row.package_id),
    packageName: String(row.package_name_snapshot || row.package_name || ""), durationHours: Number(row.duration_hours_snapshot || row.duration_hours), amount: Number(row.amount),
    paymentStatus: row.payment_status as string, status, transactionCode: String(row.transaction_code || ""), paymentMethod: String(row.payment_method),
    expiresAt: row.expires_at?.toISOString() || null, createdAt: row.created_at?.toISOString() || "", paidAt: row.paid_at?.toISOString() || null,
    cancelledAt: row.cancelled_at?.toISOString() || null,
    canCancel: row.payment_method === "SEPAY" && row.payment_status === "PENDING" && !row.review_required,
    reviewReason: row.review_reason || "", paymentConfigured: ready,
    bank: details?.bank || "", accountNumber: details?.qrAccount || "", accountName: details?.holder || "",
    transferContent: details ? sepayQr(details, row.transaction_code, Number(row.amount)).memo : "",
    qrUrl: ready && status === "PENDING" && details ? sepayQr(details, row.transaction_code, Number(row.amount)).qrUrl : null };
}
export type PaymentOrder = ReturnType<typeof paymentOrder>;
export async function pendingListingPayment(listingId: string, user: AuthenticatedUser) {
  if (!isUUID(listingId)) throw new ApiError("Không tìm thấy tin.", 404);
  const listing = (await query("SELECT seller_id FROM products WHERE id=$1", [listingId]))[0];
  if (!listing || listing.seller_id !== user.pgUserId) throw new ApiError("Không tìm thấy tin của bạn.", 404);
  const row = (await query(`SELECT po.*,p.title AS listing_title FROM promotion_orders po JOIN products p ON p.id=po.listing_id
    WHERE po.listing_id=$1 AND po.user_id=$2 AND payment_method='SEPAY' ORDER BY po.created_at DESC LIMIT 1`, [listingId, user.pgUserId]))[0];
  return row ? paymentOrder(row) : null;
}
export async function getPaymentOrder(id: string, user: AuthenticatedUser) {
  if (!isUUID(id)) throw new ApiError("Không tìm thấy đơn thanh toán.", 404);
  const row = (await query(`SELECT po.*,p.title AS listing_title,pp.name AS package_name,pp.duration_hours FROM promotion_orders po
    JOIN products p ON p.id=po.listing_id JOIN promotion_packages pp ON pp.id=po.package_id
    WHERE po.id=$1 AND (po.user_id=$2 OR $3='admin')`, [id, user.pgUserId, user.role]))[0];
  if (!row) throw new ApiError("Không tìm thấy đơn thanh toán.", 404);
  return paymentOrder(row);
}
export async function createPromotionOrder(listingId: string, packageId: number, user: AuthenticatedUser) {
  const config = sepayConfig();
  if (missingSePaySettings(config).length) throw new ApiError("Thanh toán SePay chưa được cấu hình đầy đủ. Vui lòng liên hệ Admin.", 503);
  if (user.role !== "student") throw new ApiError("Chỉ tài khoản sinh viên được mua gói cho tin của mình.", 403);
  if (!isUUID(listingId) || !Number.isSafeInteger(packageId) || packageId < 1) throw new ApiError("Tin đăng hoặc gói không hợp lệ.");
  const row = await transaction(async client => {
    const seller = (await client.query("SELECT auth_status FROM users WHERE id=$1 FOR UPDATE", [user.pgUserId])).rows[0];
    if (seller?.auth_status !== "verified") throw new ApiError("Tài khoản không còn đủ điều kiện mua gói.", 403);
    const listing = (await client.query("SELECT * FROM products WHERE id=$1 FOR UPDATE", [listingId])).rows[0];
    if (!listing) throw new ApiError("Không tìm thấy tin.", 404);
    if (listing.seller_id !== user.pgUserId) throw new ApiError("Bạn không phải chủ tin.", 403);
    if (listing.status !== "Active" || listing.moderation_status !== "APPROVED") throw new ApiError("Chỉ đẩy tin đang bán và đã được duyệt.", 409);
    const active = await client.query("SELECT 1 FROM listing_promotions WHERE listing_id=$1 AND status='ACTIVE' AND end_at>NOW()", [listingId]);
    if (active.rowCount) throw new ApiError("Tin đang có gói đẩy tin hoạt động. Hãy chờ gói hiện tại kết thúc.", 409);
    const existing = (await client.query(`SELECT po.*, $2::text AS listing_title FROM promotion_orders po WHERE listing_id=$1
      AND payment_method='SEPAY' AND payment_status IN ('PENDING','CANCELLED')
      AND ((payment_status='PENDING' AND expires_at>NOW()) OR review_required) ORDER BY created_at DESC LIMIT 1 FOR UPDATE`, [listingId, listing.title])).rows[0];
    if (existing) return existing;
    const pkg = (await client.query("SELECT * FROM promotion_packages WHERE id=$1 AND is_active=TRUE AND deleted_at IS NULL FOR SHARE", [packageId])).rows[0];
    if (!pkg) throw new ApiError("Gói không còn được cung cấp.", 404);
    const amount = Number(pkg.price), hours = Number(pkg.duration_hours), priority = Number(pkg.priority);
    if (!Number.isSafeInteger(amount) || amount <= 0 || !Number.isInteger(hours) || hours < 1 || hours > 8760 || !Number.isSafeInteger(priority) || priority < 0) throw new ApiError("Gói cần có giá nguyên VNĐ lớn hơn 0 và thời hạn hợp lệ. Vui lòng liên hệ Admin.", 409);
    const pending = (await client.query("SELECT COUNT(*)::int AS n FROM promotion_orders WHERE user_id=$1 AND payment_status='PENDING' AND expires_at>NOW()", [user.pgUserId])).rows[0].n;
    if (pending >= 10) throw new ApiError("Bạn đang có nhiều đơn chờ thanh toán. Vui lòng hoàn tất các đơn trước.", 429);
    const code = config.orderPrefix + randomBytes(8).toString("hex").toUpperCase();
    const details = { bank: config.bank, account: config.account, holder: config.holder, qrAccount: config.qrAccount, subAccount: config.subAccount, descriptionPrefix: config.descriptionPrefix };
    const order = (await client.query(`INSERT INTO promotion_orders(user_id,listing_id,package_id,amount,payment_method,transaction_code,expires_at,
      package_name_snapshot,duration_hours_snapshot,priority_snapshot,payment_details)
      VALUES($1,$2,$3,$4,'SEPAY',$5,NOW()+INTERVAL '20 minutes',$6,$7,$8,$9::jsonb) RETURNING *`,
    [user.pgUserId, listingId, packageId, amount, code, pkg.name, hours, priority, JSON.stringify(details)])).rows[0];
    return { ...order, listing_title: listing.title };
  });
  return paymentOrder(row);
}

export async function cancelPromotionOrder(id: string, confirmed: unknown, user: AuthenticatedUser) {
  if (user.role !== "student") throw new ApiError("Chỉ chủ tin được hủy đơn thanh toán của mình.", 403);
  if (!isUUID(id)) throw new ApiError("Không tìm thấy đơn thanh toán.", 404);
  if (confirmed !== true) throw new ApiError("Vui lòng xác nhận bạn chưa chuyển khoản trước khi hủy đơn.");
  const row = await transaction(async client => {
    await client.query("SET LOCAL lock_timeout='5s'");
    await client.query("SET LOCAL statement_timeout='15s'");
    const first = (await client.query("SELECT listing_id FROM promotion_orders WHERE id=$1 AND user_id=$2 AND payment_method='SEPAY'", [id, user.pgUserId])).rows[0];
    if (!first) throw new ApiError("Không tìm thấy đơn thanh toán của bạn.", 404);
    const seller = (await client.query("SELECT auth_status FROM users WHERE id=$1 FOR UPDATE", [user.pgUserId])).rows[0];
    const listing = (await client.query("SELECT title FROM products WHERE id=$1 FOR UPDATE", [first.listing_id])).rows[0];
    const order = (await client.query("SELECT * FROM promotion_orders WHERE id=$1 AND user_id=$2 FOR UPDATE", [id, user.pgUserId])).rows[0];
    if (!order || !listing) throw new ApiError("Không tìm thấy đơn thanh toán.", 404);
    if (seller?.auth_status !== "verified") throw new ApiError("Tài khoản không còn đủ điều kiện thao tác.", 403);
    if (order.payment_status === "CANCELLED" && !order.review_required) return { ...order, listing_title: listing.title };
    if (order.payment_status !== "PENDING" || order.review_required) throw new ApiError("Đơn đã thanh toán hoặc đang cần đối soát, không thể hủy. Vui lòng kiểm tra trạng thái và liên hệ Admin nếu đã chuyển tiền.", 409);
    const received = await client.query("SELECT 1 FROM sepay_payment_events WHERE order_id=$1 AND transfer_type='in' AND status IN ('RECEIVED','REVIEW','APPLIED') LIMIT 1", [id]);
    if (received.rowCount) throw new ApiError("Đã ghi nhận giao dịch cho đơn này. Vui lòng liên hệ Admin để đối soát, không hủy đơn.", 409);
    const cancelled = (await client.query("UPDATE promotion_orders SET payment_status='CANCELLED',cancelled_at=NOW() WHERE id=$1 RETURNING *", [id])).rows[0];
    // Student identities are not staff audit actors; retain the owner UUID in the immutable audit description.
    await client.query(`INSERT INTO audit_logs(id,actor_id,action,target_type,target_id,description,created_at)
      VALUES(gen_random_uuid(),NULL,'SEPAY_PAYMENT_CANCELLED','PAYMENT',$1,$2,NOW())`,
    [id, `Chủ tin ${user.pgUserId} xác nhận chưa chuyển tiền và hủy đơn ${order.transaction_code}.`]);
    return { ...cancelled, listing_title: listing.title };
  });
  return paymentOrder(row);
}

async function activatePurchasedPackage(client: PoolClient, order: QueryResultRow, eventId: string | number) {
  const promotion = (await client.query(`INSERT INTO listing_promotions(listing_id,user_id,package_id,status,start_at,end_at,price,payment_status,transaction_id,package_name_snapshot,priority_snapshot)
    VALUES($1,$2,$3,'ACTIVE',NOW(),NOW()+$4*INTERVAL '1 hour',$5,'PAID',$6,$7,$8) RETURNING id`,
  [order.listing_id, order.user_id, order.package_id, order.duration_hours_snapshot, order.amount, String(eventId), order.package_name_snapshot, order.priority_snapshot])).rows[0];
  await client.query(`UPDATE promotion_orders SET payment_status='PAID',paid_at=NOW(),promotion_id=$2,sepay_transaction_id=$3,
    review_required=FALSE,review_reason=NULL WHERE id=$1`, [order.id, promotion.id, eventId]);
}

/** Reconcile a received, authenticated transfer; never create a payment from client-supplied amounts. */
export async function approveSePayPackage(eventId: string, note: unknown, confirmed: unknown, admin: AuthenticatedUser) {
  if (admin.role !== "admin") throw new ApiError("Chỉ Admin được duyệt gói thanh toán.", 403);
  if (!/^[1-9]\d{0,15}$/.test(eventId) || !Number.isSafeInteger(Number(eventId))) throw new ApiError("Mã giao dịch không hợp lệ.");
  if (confirmed !== true) throw new ApiError("Vui lòng xác nhận đã kiểm tra khoản tiền thực nhận trên SePay/ngân hàng.");
  if (typeof note !== "string" || note.trim().length < 10 || note.trim().length > 1000) throw new ApiError("Nhập ghi chú đối soát từ 10 đến 1000 ký tự.");
  return transaction(async client => {
    await client.query("SET LOCAL lock_timeout='5s'");
    await client.query("SET LOCAL statement_timeout='15s'");
    const first = (await client.query(`SELECT po.id,po.user_id,po.listing_id FROM sepay_payment_events e
      JOIN promotion_orders po ON po.id=e.order_id WHERE e.transaction_id=$1`, [eventId])).rows[0];
    if (!first) throw new ApiError("Giao dịch chưa khớp đơn thanh toán; chưa thể duyệt gói.", 404);
    // Keep the same lock order as webhook settlement and account/report moderation.
    const seller = (await client.query("SELECT auth_status FROM users WHERE id=$1 FOR UPDATE", [first.user_id])).rows[0];
    const listing = (await client.query("SELECT * FROM products WHERE id=$1 FOR UPDATE", [first.listing_id])).rows[0];
    const order = (await client.query("SELECT * FROM promotion_orders WHERE id=$1 FOR UPDATE", [first.id])).rows[0];
    const event = (await client.query("SELECT * FROM sepay_payment_events WHERE transaction_id=$1 FOR UPDATE", [eventId])).rows[0];
    if (!order || !event || event.order_id !== order.id) throw new ApiError("Giao dịch đã thay đổi. Vui lòng làm mới.", 409);
    if (event.status === "APPLIED" && order.payment_status === "PAID" && String(order.sepay_transaction_id) === eventId) return { orderId: order.id as string, alreadyApproved: true };
    if (event.status !== "REVIEW" || order.payment_method !== "SEPAY" || !["PENDING", "CANCELLED"].includes(order.payment_status)) throw new ApiError("Chỉ duyệt giao dịch cần đối soát của đơn chưa thanh toán.", 409);
    const details = order.payment_details;
    if (event.transfer_type !== "in" || !details || event.account_number !== details.account || !bankMatches(event.gateway, details.bank) || (details.subAccount && event.sub_account !== details.subAccount)) throw new ApiError("Giao dịch không khớp tài khoản nhận của đơn.", 409);
    if (!Number.isSafeInteger(Number(order.amount)) || Number(order.amount) <= 0 || Number(event.amount) !== Number(order.amount)) throw new ApiError("Số tiền chưa khớp đơn; cần đối soát riêng, không thể kích hoạt gói.", 409);
    if (!listing || listing.seller_id !== order.user_id || listing.status !== "Active" || listing.moderation_status !== "APPROVED" || seller?.auth_status !== "verified") throw new ApiError("Tin hoặc tài khoản không còn đủ điều kiện đẩy tin.", 409);
    if ((await client.query("SELECT 1 FROM listing_promotions WHERE listing_id=$1 AND status='ACTIVE' AND end_at>NOW()", [order.listing_id])).rowCount) throw new ApiError("Tin đã có gói đang hoạt động; không thể kích hoạt chồng gói.", 409);
    if (!Number.isInteger(order.duration_hours_snapshot) || order.duration_hours_snapshot < 1 || order.duration_hours_snapshot > 8760 || !Number.isSafeInteger(order.priority_snapshot) || order.priority_snapshot < 0) throw new ApiError("Đơn thiếu thông tin gói hợp lệ.", 409);
    await activatePurchasedPackage(client, order, eventId);
    // Retain the original exception alongside the administrator's reconciliation note.
    const reason = `${event.reason}\nAdmin đã đối soát và duyệt gói: ${note.trim()}`;
    await client.query("UPDATE sepay_payment_events SET status='APPLIED',reason=$2 WHERE transaction_id=$1", [eventId, reason]);
    await client.query(`INSERT INTO audit_logs(id,actor_id,action,target_type,target_id,description,created_at)
      VALUES(gen_random_uuid(),$1,'SEPAY_PAYMENT_MANUALLY_APPROVED','PAYMENT',$2,$3,NOW())`,
    [admin.pgUserId, order.id, `Giao dịch SePay ${eventId}; mã đơn ${order.transaction_code}; ${Number(order.amount)} VNĐ; gói ${order.package_name_snapshot}. Lý do ban đầu: ${event.reason}. Ghi chú: ${note.trim()}`]);
    return { orderId: order.id as string, alreadyApproved: false };
  });
}

export async function processSePayEvent(event: SePayEvent) {
  const config = sepayConfig(), fingerprint = paymentEventFingerprint(event);
  return transaction(async client => {
    await client.query("SET LOCAL lock_timeout='5s'");
    await client.query("SET LOCAL statement_timeout='15s'");
    const inserted = await client.query(`INSERT INTO sepay_payment_events(transaction_id,fingerprint,amount,gateway,account_number,sub_account,reference_code,transfer_type,content,transaction_at,status)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'RECEIVED') ON CONFLICT DO NOTHING RETURNING transaction_id`,
    [event.id, fingerprint, event.transferAmount, event.gateway, event.accountNumber, event.subAccount, event.referenceCode, event.transferType, event.content, event.transactionAt]);
    if (!inserted.rowCount) {
      const previous = (await client.query("SELECT fingerprint FROM sepay_payment_events WHERE transaction_id=$1", [event.id])).rows[0];
      if (previous && previous.fingerprint !== fingerprint) throw new ApiError("Mã giao dịch đã được nhận với dữ liệu khác.", 409);
      return;
    }
    async function finish(status: "APPLIED" | "REVIEW" | "IGNORED", reason: string, orderId?: string, flagOrder = false) {
      await client.query("UPDATE sepay_payment_events SET status=$2,reason=$3,order_id=$4 WHERE transaction_id=$1", [event.id, status, reason, orderId || null]);
      if (flagOrder && orderId) await client.query("UPDATE promotion_orders SET review_required=TRUE,review_reason=$2 WHERE id=$1", [orderId, reason]);
      if (status === "REVIEW") await client.query(`INSERT INTO audit_logs(id,actor_id,action,target_type,target_id,description,created_at)
        VALUES(gen_random_uuid(),NULL,'SEPAY_PAYMENT_REVIEW','PAYMENT',$1,$2,NOW())`, [orderId || String(event.id), reason]);
    }
    if (event.transferType !== "in") { await finish("IGNORED", "Giao dịch tiền ra."); return; }
    const code = paymentCode(event, config.orderPrefix);
    const first = code ? (await client.query("SELECT id,listing_id,user_id FROM promotion_orders WHERE transaction_code=$1 AND payment_method='SEPAY'", [code])).rows[0] : null;
    if (!first) {
      const ours = event.accountNumber === config.account && bankMatches(event.gateway, config.bank) && (!config.subAccount || event.subAccount === config.subAccount);
      await finish(ours ? "REVIEW" : "IGNORED", ours ? "Không tìm thấy mã đơn duy nhất trong nội dung chuyển khoản." : "Không thuộc tài khoản nhận được cấu hình."); return;
    }
    // Same lock order as account/report moderation: user, product, then order.
    const seller = (await client.query("SELECT auth_status FROM users WHERE id=$1 FOR UPDATE", [first.user_id])).rows[0];
    const listing = (await client.query("SELECT * FROM products WHERE id=$1 FOR UPDATE", [first.listing_id])).rows[0];
    const order = (await client.query("SELECT * FROM promotion_orders WHERE id=$1 FOR UPDATE", [first.id])).rows[0];
    if (!order) { await finish("REVIEW", "Đơn không còn tồn tại; cần đối soát."); return; }
    const details = order.payment_details;
    if (!details || event.accountNumber !== details.account || !bankMatches(event.gateway, details.bank) || (details.subAccount && event.subAccount !== details.subAccount)) {
      await finish("IGNORED", "Ngân hàng, tài khoản nhận hoặc tài khoản ảo không khớp đơn.", order.id); return;
    }
    if (order.payment_status === "CANCELLED") { await finish("REVIEW", "Nhận tiền cho đơn đã hủy; cần Admin đối soát trước khi kích hoạt hoặc xử lý hoàn tiền.", order.id, true); return; }
    if (order.payment_status !== "PENDING") { await finish("REVIEW", "Có giao dịch bổ sung cho đơn đã xử lý; cần kiểm tra hoàn tiền/đối soát.", order.id); return; }
    if (event.transferAmount !== Number(order.amount)) { await finish("REVIEW", "Số tiền chuyển khoản không khớp số tiền của đơn.", order.id, true); return; }
    const at = new Date(event.transactionAt).getTime();
    if (!order.expires_at || at < new Date(order.created_at).getTime() - 60000 || at > new Date(order.expires_at).getTime() || at > Date.now() + 300000) {
      await finish("REVIEW", "Giao dịch ngoài thời hạn thanh toán; cần đối soát.", order.id, true); return;
    }
    if (order.review_required) { await finish("REVIEW", "Đơn đã có giao dịch cần đối soát; không tự kích hoạt thêm.", order.id); return; }
    if (!listing || listing.seller_id !== order.user_id || listing.status !== "Active" || listing.moderation_status !== "APPROVED" || seller?.auth_status !== "verified") {
      await finish("REVIEW", "Tin hoặc tài khoản không còn đủ điều kiện đẩy tin; cần đối soát.", order.id, true); return;
    }
    const active = await client.query("SELECT 1 FROM listing_promotions WHERE listing_id=$1 AND status='ACTIVE' AND end_at>NOW()", [order.listing_id]);
    if (active.rowCount) { await finish("REVIEW", "Tin đã có gói đang hoạt động; không kích hoạt chồng gói.", order.id, true); return; }
    if (!Number.isInteger(order.duration_hours_snapshot) || order.duration_hours_snapshot < 1) { await finish("REVIEW", "Đơn thiếu thông tin thời hạn gói.", order.id, true); return; }
    await activatePurchasedPackage(client, order, event.id);
    await finish("APPLIED", "Đã xác nhận thanh toán và kích hoạt gói.", order.id);
    await client.query(`INSERT INTO audit_logs(id,actor_id,action,target_type,target_id,description,created_at)
      VALUES(gen_random_uuid(),NULL,'SEPAY_PAYMENT_CONFIRMED','PAYMENT',$1,$2,NOW())`, [order.id, `Đã nhận ${Number(order.amount)} VNĐ, kích hoạt gói ${order.package_name_snapshot}. Giao dịch SePay ${event.id}.`]);
  });
}
