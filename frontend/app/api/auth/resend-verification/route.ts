import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { digest, error, getAccountByEmail, isValidEmail, sameOrigin, smtpConfigured } from "@/lib/auth";
import { allowEmailRequest, EmailCodeError, issueEmailCode } from "@/lib/email-codes";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return error("Yêu cầu không hợp lệ.", 403);
  let body: { email?: string };
  try { body = await request.json(); } catch { return error("Dữ liệu không hợp lệ."); }
  const email = String(body.email || "").trim().toLowerCase();
  if (!isValidEmail(email)) return error("Vui lòng nhập đúng địa chỉ email.");
  if (!smtpConfigured()) return error("Hệ thống chưa cấu hình SMTP để gửi mã xác thực.", 503);
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  if (!await allowEmailRequest(`email-register:${digest(ip)}`, 20, 3600000)) return error("Đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau.", 429);
  const account = await getAccountByEmail(email);
  try {
    if (account?.status === "pending_email") await issueEmailCode(account.id, "register");
    return NextResponse.json({ message: "Nếu tài khoản đang chờ xác thực email, mã mới đã được gửi. Hãy kiểm tra hộp thư và mục thư rác.", expiresIn: 600, resendAfter: 60 });
  } catch (exception) {
    if (exception instanceof EmailCodeError) return error(exception.message, exception.status);
    console.error("Verification code delivery failed.");
    return error("Không gửi được mã lúc này. Vui lòng thử lại sau.", 503);
  }
}
