import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { error, requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";

export const runtime = "nodejs";

type ReportRow = {
  id: string;
  reporter_name: string;
  reporter_email: string;
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

const fromSql = `
  FROM user_reports r
  JOIN users reporter ON reporter.id = r.reporter_id
  JOIN users reported ON reported.id = r.reported_user_id
  WHERE ($1 = 'ALL' OR r.status = $1)
    AND ($2 = '' OR reporter.full_name ILIKE '%' || $2 || '%'
      OR reporter.email ILIKE '%' || $2 || '%'
      OR reported.full_name ILIKE '%' || $2 || '%'
      OR reported.email ILIKE '%' || $2 || '%'
      OR r.context_title ILIKE '%' || $2 || '%')
`;

export async function GET(request: NextRequest) {
  const { response } = await requireAdmin(request);
  if (response) return response;
  const status = request.nextUrl.searchParams.get("status") || "PENDING";
  const search = request.nextUrl.searchParams.get("q")?.trim() || "";
  const pageText = request.nextUrl.searchParams.get("page") || "1";
  if (!["ALL", "PENDING", "APPROVED", "REJECTED"].includes(status) ||
    search.length > 100 || !/^[1-9]\d{0,3}$/.test(pageText)) return error("Điều kiện lọc không hợp lệ.");
  const page = Number(pageText);
  const pageSize = 25;

  const [{ total }] = await query<{ total: number }>(`SELECT COUNT(*)::int AS total ${fromSql}`, [status, search]);
  const rows = await query<ReportRow>(`
    SELECT r.id, r.context_type, r.context_id, r.context_title, r.reason,
      r.description, r.status, r.review_note, r.created_at, r.reviewed_at,
      reporter.full_name AS reporter_name, reporter.email AS reporter_email,
      reported.full_name AS reported_name, reported.email AS reported_email,
      reported.auth_status AS reported_status
    ${fromSql}
    ORDER BY CASE WHEN r.status = 'PENDING' THEN 0 ELSE 1 END, r.created_at DESC, r.id DESC
    LIMIT $3 OFFSET $4
  `, [status, search, pageSize, (page - 1) * pageSize]);

  return NextResponse.json({
    reports: rows.map(row => ({
      id: row.id,
      reporterName: row.reporter_name,
      reporterEmail: row.reporter_email,
      reportedName: row.reported_name,
      reportedEmail: row.reported_email,
      reportedStatus: row.reported_status,
      contextType: row.context_type,
      contextId: row.context_id,
      contextTitle: row.context_title,
      reason: row.reason,
      description: row.description,
      status: row.status,
      reviewNote: row.review_note,
      createdAt: row.created_at.toISOString(),
      reviewedAt: row.reviewed_at?.toISOString() || null,
    })),
    total,
    page,
    pageSize,
  }, { headers: { "Cache-Control": "private, no-store" } });
}
