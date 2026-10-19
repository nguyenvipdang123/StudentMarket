import type { PoolClient } from 'pg';
import { query, transaction } from './db';
import { ApiError, isUUID } from './api-error';
import type { Reservation } from './reservation-types';

// Every mutation locks the product first, then its reservations, including the sale path.
// Availability always checks the timestamp, so expiry never depends on a browser or worker.
export async function expireReservations(client: PoolClient, listingId: string) {
  await client.query(`UPDATE listing_reservations r SET status='EXPIRED',updated_at=NOW()
    FROM products p WHERE r.listing_id=p.id AND p.id=$1 AND r.status IN ('PENDING','CONFIRMED')
    AND (r.expires_at<=NOW() OR p.status<>'Active' OR p.moderation_status<>'APPROVED'
      OR p.seller_id IS DISTINCT FROM r.seller_id)`, [listingId]);
}
export async function reservationEvent(client: PoolClient, id: string, recipient: string, title: string, body: string) {
  await client.query('INSERT INTO reservation_events(reservation_id,recipient_id,title,body) VALUES($1,$2,$3,$4)', [id,recipient,title,body.slice(0,500)]);
}
const effective = `CASE WHEN r.status IN ('PENDING','CONFIRMED') AND
  (r.expires_at<=NOW() OR p.status<>'Active' OR p.moderation_status<>'APPROVED' OR p.seller_id IS DISTINCT FROM r.seller_id)
  THEN 'EXPIRED' ELSE r.status END`;
export async function listReservations(userId: string, listingId?: string) {
  if (listingId && !isUUID(listingId)) throw new ApiError('Mã tin không hợp lệ.');
  const rows = await query(`SELECT r.*,p.title,b.full_name AS buyer_name,s.full_name AS seller_name,${effective} AS effective_status
    FROM listing_reservations r JOIN products p ON p.id=r.listing_id
    JOIN users b ON b.id=r.buyer_id JOIN users s ON s.id=r.seller_id
    WHERE (r.buyer_id=$1 OR r.seller_id=$1) ${listingId ? 'AND r.listing_id=$2' : ''}
    ORDER BY CASE WHEN ${effective} IN ('PENDING','CONFIRMED') THEN 0 ELSE 1 END,r.meeting_at,r.id LIMIT 100`, listingId ? [userId,listingId] : [userId]);
  return rows.map(r => ({ id:r.id,listingId:r.listing_id,listingTitle:r.title,buyerId:r.buyer_id,sellerId:r.seller_id,
    buyerName:r.buyer_name,sellerName:r.seller_name,conversationId:r.conversation_id,meetingAt:r.meeting_at.toISOString(),
    expiresAt:r.expires_at.toISOString(),location:r.location,note:r.note,status:r.effective_status,isSeller:r.seller_id===userId }) as Reservation);
}
export async function heldUntil(listingId: string) {
  const rows = await query(`SELECT r.expires_at FROM listing_reservations r JOIN products p ON p.id=r.listing_id
    WHERE r.listing_id=$1 AND r.status='CONFIRMED' AND r.expires_at>NOW() AND p.status='Active'
    AND p.moderation_status='APPROVED' AND p.seller_id=r.seller_id`, [listingId]);
  return rows[0]?.expires_at.toISOString() || null;
}
export async function createReservation(userId: string, input: { listingId?: unknown; meetingAt?: unknown; location?: unknown; note?: unknown }) {
  const { listingId, meetingAt } = input;
  const location = typeof input.location==='string' ? input.location.trim() : '';
  const note = typeof input.note==='string' ? input.note.trim() : '';
  if (!isUUID(listingId) || typeof meetingAt!=='string' || !/(Z|[+-]\d\d:\d\d)$/.test(meetingAt) ||
      !Number.isFinite(Date.parse(meetingAt)) || location.length<5 || location.length>240 || note.length>500 || (input.note!=null && typeof input.note!=='string')) {
    throw new ApiError('Nhập thời gian hợp lệ và địa điểm từ 5–240 ký tự; ghi chú tối đa 500 ký tự.');
  }
  return transaction(async client => {
    const {rows:[p]} = await client.query(`SELECT *,NOW() AS server_now FROM products WHERE id=$1 FOR UPDATE`,[listingId]);
    if (!p || p.status!=='Active' || p.moderation_status!=='APPROVED') throw new ApiError('Tin không còn nhận lịch hẹn.',409);
    if (p.seller_id===userId) throw new ApiError('Bạn không thể giữ chỗ món đồ của mình.');
    const minutes=(Date.parse(meetingAt)-p.server_now.getTime())/60000;
    if (minutes<15 || minutes>7*24*60) throw new ApiError('Lịch gặp phải cách hiện tại ít nhất 15 phút và trong vòng 7 ngày.');
    await expireReservations(client,listingId);
    const {rows:busy} = await client.query("SELECT id FROM listing_reservations WHERE listing_id=$1 AND (status='CONFIRMED' OR (buyer_id=$2 AND status='PENDING'))",[listingId,userId]);
    if (busy.length) throw new ApiError('Món đồ đang được giữ chỗ hoặc bạn đã có yêu cầu đang chờ.',409);
    const {rows:[seller]}=await client.query("SELECT id FROM users WHERE id=$1 AND status='Verified'",[p.seller_id]);
    if (!seller) throw new ApiError('Người bán hiện chưa thể nhận lịch hẹn.',409);
    let {rows:[conversation]}=await client.query('SELECT id FROM conversations WHERE product_id=$1 AND buyer_id=$2 AND seller_id=$3 LIMIT 1',[listingId,userId,p.seller_id]);
    if (!conversation) ({rows:[conversation]}=await client.query(`INSERT INTO conversations(id,buyer_id,seller_id,product_id,last_message_at,created_at)
      VALUES(gen_random_uuid(),$1,$2,$3,NOW(),NOW()) RETURNING id`,[userId,p.seller_id,listingId]));
    const {rows:[r]}=await client.query(`INSERT INTO listing_reservations(listing_id,seller_id,buyer_id,conversation_id,meeting_at,location,note,expires_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,LEAST(NOW()+INTERVAL '24 hours',$5::timestamptz)) RETURNING id`,
      [listingId,p.seller_id,userId,conversation.id,meetingAt,location,note]);
    await reservationEvent(client,r.id,p.seller_id,'Có yêu cầu giữ chỗ & lịch hẹn mới',p.title+' · '+location);
    return { id:r.id,message:'Đã gửi yêu cầu. Món đồ chỉ được giữ sau khi người bán xác nhận.' };
  });
}
export async function updateReservation(id: string, userId: string, action: unknown) {
  if (!isUUID(id) || !['accept','reject','cancel'].includes(String(action))) throw new ApiError('Thao tác lịch hẹn không hợp lệ.');
  return transaction(async client => {
    const {rows:[ref]}=await client.query('SELECT listing_id FROM listing_reservations WHERE id=$1 AND (buyer_id=$2 OR seller_id=$2)',[id,userId]);
    if (!ref) throw new ApiError('Không tìm thấy lịch hẹn.',404);
    const {rows:[p]}=await client.query('SELECT * FROM products WHERE id=$1 FOR UPDATE',[ref.listing_id]);
    await expireReservations(client,ref.listing_id);
    const {rows:[r]}=await client.query('SELECT *,NOW() AS server_now FROM listing_reservations WHERE id=$1 FOR UPDATE',[id]);
    const seller=r.seller_id===userId;
    if (action!=='cancel' && !seller) throw new ApiError('Chỉ người bán được xác nhận hoặc từ chối lịch.',403);
    if (!['PENDING','CONFIRMED'].includes(r.status)) throw new ApiError('Lịch đã kết thúc hoặc hết hạn. Vui lòng tải lại.',409);
    if (action==='accept') {
      if (r.status!=='PENDING' || r.meeting_at<=r.server_now || p.status!=='Active' || p.moderation_status!=='APPROVED') throw new ApiError('Lịch hẹn không còn hợp lệ.',409);
      const {rows:held}=await client.query("SELECT id FROM listing_reservations WHERE listing_id=$1 AND status='CONFIRMED'",[ref.listing_id]);
      if (held.length) throw new ApiError('Món đồ đã được giữ cho một người mua khác.',409);
      const {rows:[buyer]}=await client.query("SELECT id FROM users WHERE id=$1 AND status='Verified'",[r.buyer_id]);
      if (!buyer) throw new ApiError('Người mua hiện chưa thể giao dịch.',409);
      await client.query("UPDATE listing_reservations SET status='CONFIRMED',expires_at=meeting_at+INTERVAL '2 hours',updated_at=NOW() WHERE id=$1",[id]);
      const {rows:others}=await client.query("UPDATE listing_reservations SET status='REJECTED',updated_at=NOW() WHERE listing_id=$1 AND id<>$2 AND status='PENDING' RETURNING id,buyer_id",[ref.listing_id,id]);
      for (const other of others) await reservationEvent(client,other.id,other.buyer_id,'Yêu cầu giữ chỗ chưa được chấp nhận',p.title+' đã được người bán giữ cho người khác.');
    } else {
      if (action==='reject' && r.status!=='PENDING') throw new ApiError('Lịch đã xác nhận; hãy dùng Hủy lịch.',409);
      await client.query('UPDATE listing_reservations SET status=$2,updated_at=NOW() WHERE id=$1',[id,action==='reject'?'REJECTED':'CANCELLED']);
    }
    const title=action==='accept'?'Người bán đã xác nhận lịch hẹn':action==='reject'?'Người bán từ chối yêu cầu giữ chỗ':'Lịch hẹn đã được hủy';
    await reservationEvent(client,id,seller?r.buyer_id:r.seller_id,title,p.title+' · '+r.location);
    return {message:action==='accept'?'Đã xác nhận lịch và giữ chỗ sản phẩm.':action==='reject'?'Đã từ chối yêu cầu.':'Đã hủy lịch và bỏ giữ chỗ.'};
  });
}
