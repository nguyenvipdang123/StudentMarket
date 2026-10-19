import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-pg";
import { query } from "@/lib/db";

export const runtime = "nodejs";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const reasons = new Set(["SCAM", "HARASSMENT", "MISLEADING", "OTHER"]);

type ReportRow = {
  id: string;
  context_type: string;
  context_id: string;
  context_title: string;
  reason: string;
  description: string;
  status: string;
  review_note: string | null;
  reported_name: string | null;
  created_at: Date;
  reviewed_at: Date | null;
};

export async function GET(request: NextRequest) {
  const { user, errorResponse } = await requireAuth(request);
  if (errorResponse) return errorResponse;
  if (user!.role !== "student") return NextResponse.json({ error: "Chỉ sinh viên có thể xem báo cáo của mình." }, { status: 403 });

  const rows = await query<ReportRow>(`
    SELECT r.id, r.context_type, r.context_id, r.context_title, r.reason,
      r.description, r.status, r.review_note, r.created_at, r.reviewed_at,
      u.full_name AS reported_name
    FROM user_reports r
    LEFT JOIN users u ON u.id = r.reported_user_id
    WHERE r.reporter_id = $1
    ORDER BY r.created_at DESC, r.id DESC LIMIT 100
  `, [user!.pgUserId]);

  return NextResponse.json({ reports: rows.map(row => ({
    id: row.id,
    contextType: row.context_type,
    contextId: row.context_id,
    contextTitle: row.context_title,
    reason: row.reason,
    description: row.description,
    status: row.status,
    reviewNote: row.review_note,
    reportedName: row.reported_name || "Tài khoản không còn tồn tại",
    createdAt: row.created_at.toISOString(),
    reviewedAt: row.reviewed_at?.toISOString() || null,
  })) }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: NextRequest) {
  const { user, errorResponse } = await requireAuth(request);
  if (errorResponse) return errorResponse;
  if (user!.role !== "student") return NextResponse.json({ error: "Chỉ sinh viên có thể gửi báo cáo." }, { status: 403 });

  let body: { contextType?: unknown; contextId?: unknown; reason?: unknown; description?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Dữ liệu báo cáo không hợp lệ." }, { status: 400 }); }
  const contextType = body.contextType;
  const contextId = body.contextId;
  const reason = body.reason;
  const description = typeof body.description === "string" ? body.description.trim() : "";
  if ((contextType !== "LISTING" && contextType !== "CONVERSATION") ||
    typeof contextId !== "string" || !uuidPattern.test(contextId) ||
    typeof reason !== "string" || !reasons.has(reason) ||
    description.length < 20 || description.length > 2000) {
    return NextResponse.json({ error: "Chọn lý do và mô tả sự việc từ 20 đến 2000 ký tự." }, { status: 400 });
  }

  let targetId: string;
  let contextTitle: string;
  if (contextType === "LISTING") {
    const [listing] = await query<{ seller_id: string | null; title: string }>(
      "SELECT seller_id, title FROM products WHERE id = $1", [contextId]
    );
    if (!listing?.seller_id) return NextResponse.json({ error: "Không tìm thấy người bán của tin đăng." }, { status: 404 });
    targetId = listing.seller_id;
    contextTitle = listing.title;
  } else {
    const [conversation] = await query<{ buyer_id: string; seller_id: string; title: string | null }>(`
      SELECT c.buyer_id, c.seller_id, p.title
      FROM conversations c LEFT JOIN products p ON p.id = c.product_id
      WHERE c.id = $1
    `, [contextId]);
    if (!conversation) return NextResponse.json({ error: "Không tìm thấy cuộc trò chuyện." }, { status: 404 });
    if (conversation.buyer_id !== user!.pgUserId && conversation.seller_id !== user!.pgUserId) {
      return NextResponse.json({ error: "Bạn không thuộc cuộc trò chuyện này." }, { status: 403 });
    }
    targetId = conversation.buyer_id === user!.pgUserId ? conversation.seller_id : conversation.buyer_id;
    contextTitle = conversation.title || "Cuộc trò chuyện mua bán";
  }
  if (targetId === user!.pgUserId) return NextResponse.json({ error: "Bạn không thể tự báo cáo chính mình." }, { status: 400 });

  const rows = await query<{ id: string }>(`
    INSERT INTO user_reports (reporter_id, reported_user_id, context_type, context_id,
      context_title, reason, description)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT DO NOTHING RETURNING id
  `, [user!.pgUserId, targetId, contextType, contextId, contextTitle, reason, description]);
  if (!rows.length) return NextResponse.json({ error: "Bạn đã gửi báo cáo cho trường hợp này và đang chờ admin xử lý." }, { status: 409 });
  return NextResponse.json({ id: rows[0].id, status: "PENDING" }, { status: 201 });
}
