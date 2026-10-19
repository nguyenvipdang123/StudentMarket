/**
 * GET /api/admin/audit-logs — List system audit logs (Admin only)
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-pg";
import { query } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { user, errorResponse } = await requireAuth(request);
  if (errorResponse) return errorResponse;

  if (user!.role !== "admin") {
    return NextResponse.json({ error: "Chỉ quản trị viên mới có quyền xem nhật ký hoạt động (Audit Logs)." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") || 50), 200);

  const rows = await query(
    `SELECT a.id, a.actor_id, a.action, a.target_type, a.target_id, a.description, a.created_at,
            s.full_name AS actor_name, s.email AS actor_email, UPPER(s.role) AS actor_role
     FROM audit_logs a
     LEFT JOIN staff_accounts s ON s.actor_id = a.actor_id
     ORDER BY a.created_at DESC
     LIMIT $1`,
    [limit]
  );

  return NextResponse.json({
    auditLogs: rows.map(r => ({
      id: r.id,
      actorId: r.actor_id,
      actorName: r.actor_name || "Hệ thống",
      actorEmail: r.actor_email || "system@sangtay.vn",
      actorRole: r.actor_role || "ADMIN",
      action: r.action,
      targetType: r.target_type,
      targetId: r.target_id,
      description: r.description,
      createdAt: r.created_at?.toISOString() || "",
    })),
  });
}
