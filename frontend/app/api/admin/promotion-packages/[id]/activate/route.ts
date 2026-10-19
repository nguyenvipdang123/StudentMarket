/**
 * PATCH /api/admin/promotion-packages/[id]/activate — Activate a promotion package
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
    return NextResponse.json({ error: "Chỉ quản trị viên mới có quyền kích hoạt gói đẩy tin." }, { status: 403 });
  }

  const { id } = await params;
  const rows = await query(
    `UPDATE promotion_packages SET is_active = TRUE, updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING *`,
    [Number(id)]
  );

  if (rows.length === 0) {
    return NextResponse.json({ error: "Không tìm thấy gói đẩy tin." }, { status: 404 });
  }

  await logAudit({
    actorId: user!.pgUserId,
    action: "ACTIVATE_PROMOTION_PACKAGE",
    targetType: "PROMOTION_PACKAGE",
    targetId: String(id),
    description: `Kích hoạt gói đẩy tin: ${rows[0].name}`,
  });

  return NextResponse.json({
    success: true,
    message: `Đã kích hoạt gói "${rows[0].name}".`,
    package: { id: rows[0].id, isActive: true },
  });
}
