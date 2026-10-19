import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { digest, error, getDb, isUniqueError, pendingGoogleCookie, publicAccount, sameOrigin, setSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return error("Yêu cầu không hợp lệ.", 403);
  const token = request.cookies.get(pendingGoogleCookie)?.value;
  if (!token) return error("Phiên Google đã hết hạn. Vui lòng thử lại.", 401);
  let body: { fullName?: string; studentId?: string; university?: string };
  try { body = await request.json(); } catch { return error("Dữ liệu không hợp lệ."); }
  const fullName = String(body.fullName || "").trim().replace(/\s+/g, " ");
  const studentId = String(body.studentId || "").trim().toUpperCase();
  const university = String(body.university || "").trim();
  if (fullName.length < 2 || fullName.length > 100) return error("Họ và tên cần từ 2 đến 100 ký tự.");
  if (!/^[A-Z0-9][A-Z0-9._-]{2,29}$/.test(studentId)) return error("Mã sinh viên không hợp lệ.");
  if (university.length < 2 || university.length > 120) return error("Vui lòng chọn trường đại học.");
  const db = getDb();
  const pending = await db.prepare("SELECT * FROM google_onboarding WHERE token_hash = ? AND expires_at > ?")
    .get(digest(token), Date.now()) as { google_sub: string; email: string } | undefined;
  if (!pending) return error("Phiên Google đã hết hạn. Vui lòng thử lại.", 401);
  try {
    const result = await db.prepare(`
      INSERT INTO auth_identities (full_name, email, student_id, university, google_sub, status, created_at, verified_at)
      VALUES (?, ?, ?, ?, ?, 'verified', ?, ?)
    `).run(fullName, pending.email, studentId, university, pending.google_sub, Date.now(), Date.now());
    await db.prepare("DELETE FROM google_onboarding WHERE token_hash = ?").run(digest(token));
    const account = await db.prepare("SELECT * FROM auth_identities WHERE id = ?").get(Number(result.lastInsertRowid));
    const response = NextResponse.json({ user: publicAccount(account as Parameters<typeof publicAccount>[0]) });
    await setSession(response, Number(result.lastInsertRowid));
    response.cookies.set(pendingGoogleCookie, "", { path: "/", maxAge: 0 });
    return response;
  } catch (exception) {
    if (isUniqueError(exception)) return error("Email hoặc mã sinh viên đã được đăng ký.", 409);
    throw exception;
  }
}
