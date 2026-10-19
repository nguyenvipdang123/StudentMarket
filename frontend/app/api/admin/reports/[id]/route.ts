import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { error, requireAdmin } from "@/lib/auth";
import { query, transaction } from "@/lib/db";

export const runtime = "nodejs";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ReportDetailRow = {
  id: string;
  reporter_id: string;
  reporter_name: string;
  reporter_email: string;
  reported_user_id: string;
  reported_name: string;
  reported_email: string;
  reported_status: string | null;
  context_type: string;
  context_id: string;
  context_title: string;
  reason: string;
  description: string;
  status: string;
  review_note: string | null;
  created_at: Date;
  reviewed_at: Date | null;
};

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { response } = await requireAdmin(request);
  if (response) return response;
  const { id } = await context.params;
  if (!uuidPattern.test(id)) return error("Báo cáo không hợp lệ.");

  const [report] = await query<ReportDetailRow>(`
    SELECT r.*, reporter.full_name AS reporter_name, reporter.email AS reporter_email,
      reported.full_name AS reported_name, reported.email AS reported_email,
      reported.auth_status AS reported_status
    FROM user_reports r
    JOIN users reporter ON reporter.id = r.reporter_id
    JOIN users reported ON reported.id = r.reported_user_id
    WHERE r.id = $1
  `, [id]);
  if (!report) return error("Không tìm thấy báo cáo.", 404);

  const evidence = report.context_type === "CONVERSATION"
    ? await query<{ id: string; content: string; sender_name: string | null; sent_at: Date }>(`
        SELECT m.id, m.content, u.full_name AS sender_name, m.sent_at
        FROM messages m LEFT JOIN users u ON u.id = m.sender_id
        WHERE m.conversation_id = $1
        ORDER BY m.sent_at DESC, m.id DESC LIMIT 50
      `, [report.context_id])
    : [];

  return NextResponse.json({ report: {
    id: report.id,
    reporterId: report.reporter_id,
    reporterName: report.reporter_name,
    reporterEmail: report.reporter_email,
    reportedUserId: report.reported_user_id,
    reportedName: report.reported_name,
    reportedEmail: report.reported_email,
    reportedStatus: report.reported_status,
    contextType: report.context_type,
    contextId: report.context_id,
    contextTitle: report.context_title,
    reason: report.reason,
    description: report.description,
    status: report.status,
    reviewNote: report.review_note,
    createdAt: report.created_at.toISOString(),
    reviewedAt: report.reviewed_at?.toISOString() || null,
    evidence: evidence.reverse().map(message => ({
      id: message.id,
      senderName: message.sender_name || "Người dùng",
      content: message.content,
      sentAt: message.sent_at.toISOString(),
    })),
  } }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { account, response } = await requireAdmin(request);
  if (response) return response;
  const { id } = await context.params;
  if (!uuidPattern.test(id)) return error("Báo cáo không hợp lệ.");
  let body: { action?: unknown; note?: unknown };
  try { body = await request.json(); } catch { return error("Dữ liệu xử lý không hợp lệ."); }
  const action = body.action;
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if ((action !== "APPROVE" && action !== "REJECT") || note.length > 1000 ||
    (action === "REJECT" && note.length < 10)) {
    return error("Chọn thao tác và nhập ghi chú từ chối ít nhất 10 ký tự.");
  }

  return transaction(async client => {
    const { rows: [report] } = await client.query<{
      id: string; status: string; reported_user_id: string; reporter_id: string;
    }>("SELECT id, status, reported_user_id, reporter_id FROM user_reports WHERE id = $1 FOR UPDATE", [id]);
    if (!report) return error("Không tìm thấy báo cáo.", 404);
    if (report.status !== "PENDING") return error("Báo cáo này đã được xử lý.", 409);

    const { rows: [actor] } = await client.query<{ actor_id: string }>(
      "SELECT actor_id FROM staff_accounts WHERE id = $1 AND role = 'admin'", [account!.id]
    );
    if (!actor) return error("Không tìm thấy tài khoản quản trị.", 403);

    if (action === "APPROVE") {
      const { rows: [target] } = await client.query<{ auth_id: number | null }>(`
        UPDATE users SET auth_status = 'locked', status = 'Locked', updated_at = NOW()
        WHERE id = $1 RETURNING auth_id
      `, [report.reported_user_id]);
      if (!target) return error("Không tìm thấy tài khoản bị báo cáo.", 404);
      if (target.auth_id !== null) {
        await client.query("DELETE FROM sessions WHERE account_id = $1", [target.auth_id]);
      }
      await client.query("UPDATE products SET status = 'Hidden', updated_at = NOW() WHERE seller_id = $1 AND status = 'Active'", [report.reported_user_id]);
    }

    const newStatus = action === "APPROVE" ? "APPROVED" : "REJECTED";
    await client.query(`
      UPDATE user_reports SET status = $2, review_note = $3, reviewed_by = $4, reviewed_at = NOW()
      WHERE id = $1
    `, [id, newStatus, note || null, actor.actor_id]);
    await client.query(`
      INSERT INTO audit_logs (id, actor_id, action, target_type, target_id, description, created_at)
      VALUES (gen_random_uuid(), $1, $2, 'USER_REPORT', $3, $4, NOW())
    `, [actor.actor_id, newStatus === "APPROVED" ? "REPORT_APPROVED" : "REPORT_REJECTED", id,
      newStatus === "APPROVED" ? `Duyệt báo cáo, khóa tài khoản và ẩn tin đang bán của ${report.reported_user_id}.` : `Từ chối báo cáo về tài khoản ${report.reported_user_id}.`]);
    return NextResponse.json({ ok: true, status: newStatus });
  });
}
