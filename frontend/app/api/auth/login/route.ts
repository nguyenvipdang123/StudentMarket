import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { digest, error, getAccountByEmail, getDb, publicAccount, sameOrigin, setSession, verifyPassword } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return error("Yêu cầu không hợp lệ.", 403);
  let body: { email?: string; password?: string };
  try { body = await request.json(); } catch { return error("Dữ liệu đăng nhập không hợp lệ."); }
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!email || !password || password.length > 128) return error("Vui lòng nhập email và mật khẩu.");

  const db = getDb();
  const attemptKey = digest(email);
  const attempt = await db.prepare("SELECT failures, blocked_until FROM login_attempts WHERE attempt_key = ?")
    .get(attemptKey) as { failures: number; blocked_until: number } | undefined;
  if (attempt && attempt.blocked_until > Date.now()) return error("Đăng nhập tạm khóa do thử quá nhiều lần. Vui lòng thử lại sau 15 phút.", 429);

  const account = await getAccountByEmail(email);
  const valid = account?.password_hash ? await verifyPassword(password, account.password_hash) : false;
  if (!account || !valid) {
    const failures = (attempt?.blocked_until && attempt.blocked_until < Date.now() ? 0 : attempt?.failures || 0) + 1;
    await db.prepare(`INSERT INTO login_attempts (attempt_key, failures, blocked_until) VALUES (?, ?, ?)
      ON CONFLICT(attempt_key) DO UPDATE SET failures = excluded.failures, blocked_until = excluded.blocked_until`)
      .run(attemptKey, failures, failures >= 5 ? Date.now() + 15 * 60_000 : 0);
    return error("Email hoặc mật khẩu không đúng.", 401);
  }
  await db.prepare("DELETE FROM login_attempts WHERE attempt_key = ?").run(attemptKey);
  if (account.status === "locked") return error("Tài khoản đã bị khóa.", 403);
  if (account.status === "pending_email") return error("Tài khoản chưa xác minh email. Hãy kiểm tra hộp thư hoặc gửi lại liên kết xác minh.", 403);
  if (account.status === "pending_review") return error("Ảnh thẻ sinh viên đang chờ xét duyệt.", 403);

  const response = NextResponse.json({ user: publicAccount(account) });
  await setSession(response, account.id);
  return response;
}
