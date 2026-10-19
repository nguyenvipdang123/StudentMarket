import type { Account } from "@/lib/auth";
/**
 * PATCH /api/admin/staff/[id]/unlock — Unlock a staff account (Admin only)
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-pg";
import { getDb, requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { response } = await requireAdmin(request);
  if (response) return response;

  const { user } = await requireAuth(request);
  const { id } = await params;
  const db = getDb();

  const staff = await db.prepare(
    "SELECT id, full_name, email, student_id, status FROM auth_identities WHERE id = ? AND role = 'staff'"
  ).get(Number(id)) as (Account & {created_at:number}) | undefined;

  if (!staff) {
    return NextResponse.json({ error: "Không tìm thấy nhân viên." }, { status: 404 });
  }

  // Unlock account
  await db.prepare("UPDATE auth_identities SET status = 'verified' WHERE id = ?").run(staff.id);

  if (user?.pgUserId) {
    await logAudit({
      actorId: user.pgUserId,
      action: "UNLOCK_STAFF",
      targetType: "STAFF",
      targetId: String(staff.id),
      description: `Mở khóa tài khoản nhân viên: ${staff.full_name} (${staff.email})`,
    });
  }

  return NextResponse.json({
    success: true,
    message: `Đã mở khóa tài khoản nhân viên ${staff.full_name}.`,
    staff: { id: staff.id, status: "verified" },
  });
}
