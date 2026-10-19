import type { Account } from "@/lib/auth";
/**
 * GET /api/admin/staff — List all staff accounts (Admin only)
 * POST /api/admin/staff — Create a new Staff account (Admin only)
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-pg";
import { getDb, hashPassword, requireAdmin } from "@/lib/auth";
import { logAudit, getIdentityActorId } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { response } = await requireAdmin(request);
  if (response) return response;

  const db = getDb();
  // Fetch staff accounts from PostgreSQL.
  const staffRows = await db.prepare(
    `SELECT id, full_name, email, student_id, university, status, role, created_at, verified_at 
     FROM auth_identities 
     WHERE role = 'staff' 
     ORDER BY created_at DESC`
  ).all() as (Account & {created_at:number})[];

  return NextResponse.json({
    staff: staffRows.map(s => ({
      id: s.id,
      fullName: s.full_name,
      email: s.email,
      username: s.student_id,
      studentId: s.student_id,
      university: s.university,
      role: s.role.toUpperCase(),
      status: s.status,
      createdAt: s.created_at,
    })),
  });
}

export async function POST(request: NextRequest) {
  const { response } = await requireAdmin(request);
  if (response) return response;

  const { user } = await requireAuth(request);

  const body = await request.json();
  const fullName = String(body.fullName || "").trim();
  const username = String(body.username || body.studentId || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "").trim();
  const confirmPassword = String(body.confirmPassword || "").trim();

  if (!fullName || !username || !email || !password) {
    return NextResponse.json(
      { error: "Vui lòng nhập đầy đủ thông tin: Họ tên, Username, Email và Mật khẩu." },
      { status: 400 }
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Mật khẩu nhân viên phải có ít nhất 8 ký tự." },
      { status: 400 }
    );
  }

  if (confirmPassword && password !== confirmPassword) {
    return NextResponse.json(
      { error: "Mật khẩu xác nhận không khớp." },
      { status: 400 }
    );
  }

  const db = getDb();
  const existing = await db.prepare("SELECT id FROM auth_identities WHERE LOWER(email) = LOWER(?) OR LOWER(student_id) = LOWER(?)").get(email, username);
  if (existing) {
    return NextResponse.json(
      { error: "Email hoặc Username đã tồn tại trong hệ thống." },
      { status: 409 }
    );
  }

  const passwordHash = await hashPassword(password);
  const now = Date.now();

  const insertStmt = await db.prepare(`
    INSERT INTO auth_identities (full_name, email, student_id, university, password_hash, status, role, created_at, verified_at)
    VALUES (?, ?, ?, ?, ?, 'verified', 'staff', ?, ?)
  `);

  const result = await insertStmt.run(
    fullName,
    email,
    username,
    "Ban Quản Trị SangTay",
    passwordHash,
    now,
    now
  );

  const staffId = Number(result.lastInsertRowid);

  const pgStaffId = await getIdentityActorId(staffId, "staff");

  // Record Audit Log
  if (user?.pgUserId) {
    await logAudit({
      actorId: user.pgUserId,
      action: "CREATE_STAFF",
      targetType: "STAFF",
      targetId: String(staffId),
      description: `Tạo tài khoản nhân viên mới: ${fullName} (${email}, username: ${username})`,
    });
  }

  return NextResponse.json({
    success: true,
    message: "Tạo tài khoản nhân viên thành công!",
    staff: {
      id: staffId,
      pgUserId: pgStaffId,
      fullName,
      email,
      username,
      role: "STAFF",
      status: "verified",
      createdAt: now,
    },
  }, { status: 201 });
}
