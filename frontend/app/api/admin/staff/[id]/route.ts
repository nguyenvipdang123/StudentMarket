import type { Account } from "@/lib/auth";
/**
 * GET, PATCH, DELETE /api/admin/staff/[id] — Manage specific staff account (Admin only)
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-pg";
import { getDb, hashPassword, requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { response } = await requireAdmin(request);
  if (response) return response;

  const { id } = await params;
  const db = getDb();
  const staff = await db.prepare(
    "SELECT id, full_name, email, student_id, university, status, role, created_at FROM auth_identities WHERE id = ? AND role = 'staff'"
  ).get(Number(id)) as (Account & {created_at:number}) | undefined;

  if (!staff) {
    return NextResponse.json({ error: "Không tìm thấy nhân viên." }, { status: 404 });
  }

  return NextResponse.json({
    staff: {
      id: staff.id,
      fullName: staff.full_name,
      email: staff.email,
      username: staff.student_id,
      role: "STAFF",
      status: staff.status,
      createdAt: staff.created_at,
    },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { response } = await requireAdmin(request);
  if (response) return response;

  const { user } = await requireAuth(request);
  const { id } = await params;
  const body = await request.json();

  const db = getDb();
  const staff = await db.prepare(
    "SELECT id, full_name, email, student_id, status FROM auth_identities WHERE id = ? AND role = 'staff'"
  ).get(Number(id)) as (Account & {created_at:number}) | undefined;

  if (!staff) {
    return NextResponse.json({ error: "Không tìm thấy nhân viên." }, { status: 404 });
  }

  const newFullName = body.fullName !== undefined ? String(body.fullName).trim() : staff.full_name;
  const newPassword = body.password ? String(body.password).trim() : null;

  if (newPassword && newPassword.length < 8) {
    return NextResponse.json({ error: "Mật khẩu mới phải có ít nhất 8 ký tự." }, { status: 400 });
  }

  if (newPassword) {
    const hash = await hashPassword(newPassword);
    await db.prepare("DELETE FROM sessions WHERE account_id = ?").run(staff.id);
    await db.prepare("UPDATE auth_identities SET full_name = ?, password_hash = ? WHERE id = ?").run(
      newFullName,
      hash,
      staff.id
    );
  } else {
    await db.prepare("UPDATE auth_identities SET full_name = ? WHERE id = ?").run(newFullName, staff.id);
  }

  if (user?.pgUserId) {
    await logAudit({
      actorId: user.pgUserId,
      action: "UPDATE_STAFF",
      targetType: "STAFF",
      targetId: String(staff.id),
      description: `Cập nhật thông tin nhân viên: ${staff.full_name} -> ${newFullName}`,
    });
  }

  return NextResponse.json({
    success: true,
    message: "Cập nhật thông tin nhân viên thành công!",
    staff: {
      id: staff.id,
      fullName: newFullName,
      email: staff.email,
      username: staff.student_id,
      role: "STAFF",
      status: staff.status,
    },
  });
}
