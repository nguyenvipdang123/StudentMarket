import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { digest, error, getAccountByEmail, isValidEmail, sameOrigin, smtpConfigured } from "@/lib/auth";
import { allowEmailRequest, EmailCodeError, issueEmailCode } from "@/lib/email-codes";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return error("Yêu cầu không hợp lệ.", 403);
  let email: string;
  try { email = String((await request.json()).email || "").trim().toLowerCase(); }
  catch { return error("Dữ liệu không hợp lệ."); }
  if (!isValidEmail(email)) return error("Vui lòng nhập đúng địa chỉ email.");
  if (!smtpConfigured()) return error("Hệ thống chưa cấu hình SMTP để gửi mã.", 503);
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
    const emailAllowed = await allowEmailRequest(`reset-email:${digest(email)}`, 5, 3600000);
    const ipAllowed = await allowEmailRequest(`reset-ip:${digest(ip)}`, 20, 3600000);
    if (!emailAllowed || !ipAllowed) return error("Đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau một giờ.", 429);
    const account = await getAccountByEmail(email);
    if (account?.status === "verified") {
      try { await issueEmailCode(account.id, "reset"); }
      catch (exception) { if (!(exception instanceof EmailCodeError)) throw exception; }
    }
    return NextResponse.json({ message: "Nếu email thuộc tài khoản đang hoạt động, mã đặt lại mật khẩu đã được gửi. Hãy kiểm tra hộp thư và thư rác.", expiresIn: 600, resendAfter: 60 });
  } catch {
    console.error("Password reset code delivery failed.");
    return error("Không thể gửi mã lúc này. Vui lòng thử lại sau.", 503);
  }
}
