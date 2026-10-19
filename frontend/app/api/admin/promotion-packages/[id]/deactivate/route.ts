/**
 * PATCH /api/admin/promotion-packages/[id]/deactivate — Deactivate (hide) a promotion package without hard deleting
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-pg";
import { query, logAudit } from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, errorResponse } = await requireAuth(request);
  if (errorResponse) return errorResponse;

  if (user!.role !== "admin") {
    return NextResponse.json({ error: "Chỉ quản trị viên mới có quyền ẩn gói đẩy tin." }, { status: 403 });
  }

  const { id } = await params;
  const rows = await query(
    `UPDATE promotion_packages SET is_active = FALSE, updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING *`,
    [Number(id)]
  );

  if (rows.length === 0) {
    return NextResponse.json({ error: "Không tìm thấy gói đẩy tin." }, { status: 404 });
  }

  await logAudit({
    actorId: user!.pgUserId,
    action: "DEACTIVATE_PROMOTION_PACKAGE",
    targetType: "PROMOTION_PACKAGE",
    targetId: String(id),
    description: `Ẩn gói đẩy tin: ${rows[0].name}`,
  });

  return NextResponse.json({
    success: true,
    message: `Đã ẩn gói "${rows[0].name}".`,
    package: { id: rows[0].id, isActive: false },
  });
}
