import { query } from "./db";
import type { AuthenticatedUser } from "./auth-pg";

// Read access is filtered by the authenticated identity, never a frontend account ID.
// Versions in event IDs make new decisions/messages unread without replaying old ones.
function feed(user: AuthenticatedUser) {
  if (user.role === "student") return `
    SELECT 'decision:'||p.id::text||':'||p.moderated_at::text AS id,'listing' AS kind,
      CASE p.moderation_status WHEN 'APPROVED' THEN 'Tin đăng đã được duyệt' ELSE 'Tin đăng chưa được duyệt' END AS title,
      LEFT(p.title||CASE WHEN p.moderation_status='REJECTED' THEN ' · '||COALESCE(p.rejection_reason,'Vui lòng xem lại nội dung tin.') ELSE ' đã có thể hiển thị trên sàn.' END,300) AS body,
      '/my-listings' AS href,p.moderated_at AS created_at,FALSE AS source_read
    FROM products p WHERE (p.seller_id=$1 OR p.user_id=$1) AND p.moderation_status IN ('APPROVED','REJECTED')
      AND p.moderated_at>NOW()-INTERVAL '30 days'
    UNION ALL
    SELECT 'message:'||m.id::text,'message','Bạn có tin nhắn mới',
      CASE WHEN m.content LIKE '[Ảnh] %' THEN 'Có người gửi ảnh trong cuộc trò chuyện.' ELSE LEFT(m.content,180) END,
      '/messages?listingId='||COALESCE(c.product_id::text,''),m.sent_at,m.is_read
    FROM messages m JOIN conversations c ON c.id=m.conversation_id
    WHERE (c.buyer_id=$1 OR c.seller_id=$1) AND m.sender_id<>$1 AND m.sent_at>NOW()-INTERVAL '30 days'
    UNION ALL
    SELECT 'report-result:'||r.id::text||':'||r.reviewed_at::text,'report','Báo cáo của bạn đã được xử lý',
      LEFT(r.context_title||' · '||COALESCE(NULLIF(r.review_note,''),'Xem trạng thái báo cáo trong tài khoản.'),300),
      '/account?tab=reports',r.reviewed_at,FALSE
    FROM user_reports r WHERE r.reporter_id=$1 AND r.status<>'PENDING' AND r.reviewed_at>NOW()-INTERVAL '30 days'
    UNION ALL
    SELECT 'reservation:'||e.id::text,'reservation',e.title,e.body,'/transactions',e.created_at,FALSE
    FROM reservation_events e WHERE e.recipient_id=$1 AND e.created_at>NOW()-INTERVAL '30 days'
    UNION ALL
    SELECT 'support-admin:'||m.id::text,'support','Phiếu hỗ trợ có cập nhật',LEFT(t.subject||' · '||COALESCE(NULLIF(m.content,''),'Admin vừa cập nhật trạng thái xử lý.'),300),
      '/support?ticket='||t.id::text||'#phieu-ho-tro',m.created_at,FALSE
    FROM support_messages m JOIN support_tickets t ON t.id=m.ticket_id
    WHERE t.owner_id=$1 AND m.author_role='admin' AND m.created_at>NOW()-INTERVAL '30 days'
      AND NOT EXISTS(SELECT 1 FROM support_messages newer WHERE newer.ticket_id=t.id AND newer.author_role='admin' AND newer.id>m.id)
    UNION ALL
    SELECT 'product-alert:'||e.id::text,'product-alert',
      CASE e.kind WHEN 'NEW_MATCH' THEN 'Có món đồ phù hợp nhu cầu của bạn' ELSE 'Món đồ đã lưu vừa giảm giá' END,
      LEFT(p.title||CASE e.kind WHEN 'NEW_MATCH' THEN ' · '||COALESCE(e.search_name,'Nhu cầu đã lưu') ELSE
        ' · '||replace(to_char(e.old_price,'FM999,999,999,990'),',','.')||'đ → '||replace(to_char(e.new_price,'FM999,999,999,990'),',','.')||'đ' END,300),
      '/listing/'||p.id::text,e.created_at,FALSE
    FROM product_alert_events e JOIN products p ON p.id=e.product_id
    WHERE e.user_id=$1 AND e.created_at>NOW()-INTERVAL '30 days' AND p.status='Active' AND p.moderation_status='APPROVED'
      AND (e.kind<>'PRICE_DROP' OR EXISTS(SELECT 1 FROM favorites f WHERE f.user_id=$1 AND f.product_id=p.id AND f.price_alert_enabled))`;

  const pending = `SELECT 'pending-listing:'||p.id::text||':'||p.updated_at::text AS id,'listing' AS kind,
    'Tin đăng đang chờ duyệt' AS title,LEFT(p.title,180) AS body,'/admin/moderation' AS href,p.updated_at AS created_at,FALSE AS source_read
    FROM products p WHERE p.moderation_status='PENDING' AND p.status='Active' AND p.updated_at>NOW()-INTERVAL '30 days'`;
  if (user.role !== "admin") return pending;
  return pending + ` UNION ALL
    SELECT 'pending-account:'||u.auth_id::text,'account','Tài khoản cần kiểm tra ảnh thẻ',
      LEFT(u.full_name||' · '||COALESCE(u.university,''),180),'/admin?tab=ACCOUNTS',to_timestamp(u.auth_created_at/1000.0),FALSE
    FROM users u WHERE u.auth_id IS NOT NULL AND u.auth_status='pending_review' AND u.auth_created_at>(EXTRACT(EPOCH FROM NOW()-INTERVAL '30 days')*1000)
    UNION ALL
    SELECT 'pending-report:'||r.id::text,'report','Có báo cáo mới cần xử lý',LEFT(r.context_title,180),
      '/admin?tab=REPORTS',r.created_at,FALSE
    FROM user_reports r WHERE r.status='PENDING' AND r.created_at>NOW()-INTERVAL '30 days'
    UNION ALL
    SELECT 'support-student:'||m.id::text,'support','Phiếu hỗ trợ cần xử lý',LEFT(t.subject,180),
      '/admin?tab=SUPPORT&ticket='||t.id::text,m.created_at,FALSE
    FROM support_messages m JOIN support_tickets t ON t.id=m.ticket_id
    WHERE t.status<>'RESOLVED' AND m.author_role='student' AND m.created_at>NOW()-INTERVAL '30 days'
      AND NOT EXISTS(SELECT 1 FROM support_messages newer WHERE newer.ticket_id=t.id AND newer.author_role='student' AND newer.id>m.id)`;
}

export async function listNotifications(user: AuthenticatedUser) {
  // Keep $1 typed for the admin branches, which do not otherwise filter by student UUID.
  const rows = await query(`WITH identity AS (SELECT $1::uuid), events AS (${feed(user)}), marked AS (
    SELECT e.*, (n.event_id IS NOT NULL OR e.source_read) AS read FROM events e
    LEFT JOIN notification_reads n ON n.account_id=$2::bigint AND n.event_id=e.id)
    SELECT COALESCE((SELECT json_agg(item ORDER BY item."createdAt" DESC,item.id) FROM
      (SELECT id,kind,title,body,href,created_at AS "createdAt",read FROM marked ORDER BY created_at DESC,id LIMIT 50) item),'[]'::json) AS notifications,
      (SELECT COUNT(*)::int FROM marked WHERE NOT read) AS "unreadCount"`, [user.pgUserId, user.accountId]);
  return rows[0];
}

export async function markNotificationsRead(user: AuthenticatedUser, ids: string[] | null) {
  const rows = await query(`WITH identity AS (SELECT $1::uuid), events AS (${feed(user)})
    INSERT INTO notification_reads(account_id,event_id)
    SELECT $2::bigint,id FROM events ${ids ? "WHERE id=ANY($3::text[])" : ""}
    ON CONFLICT(account_id,event_id) DO NOTHING RETURNING event_id`, ids ? [user.pgUserId, user.accountId, ids] : [user.pgUserId, user.accountId]);
  return rows.length;
}
