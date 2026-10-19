import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { digest, error, hashPassword, isValidEmail, sameOrigin } from "@/lib/auth";
import { allowEmailRequest, consumeEmailCode } from "@/lib/email-codes";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return error("Yêu cầu không hợp lệ.", 403);
  let email: string, code: string, password: string, confirm: string;
  try {
    const body = await request.json(); email = String(body.email || "").trim().toLowerCase();
    code = String(body.code || "").trim(); password = String(body.newPassword || ""); confirm = String(body.confirmPassword || "");
  } catch { return error("Dữ liệu không hợp lệ."); }
  if (!isValidEmail(email) || !/^\d{6}$/.test(code)) return error("Nhập email và mã gồm 6 chữ số.");
  if (password.length < 8 || password.length > 128 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) return error("Mật khẩu mới cần 8–128 ký tự, có ít nhất một chữ và một số.");
  if (password !== confirm) return error("Mật khẩu mới và xác nhận không khớp.");
  try {
    if (!await allowEmailRequest(`reset-code:${digest(email)}`, 20, 900000)) return error("Đã thử quá nhiều lần. Vui lòng thử lại sau 15 phút.", 429);
    const result = await consumeEmailCode(email, code, "reset", await hashPassword(password));
    if (!result.ok) return error(result.message, result.status);
    return NextResponse.json({ message: "Đặt lại mật khẩu thành công. Các phiên cũ đã được đăng xuất; hãy đăng nhập bằng mật khẩu mới." });
  } catch { return error("Không thể đặt lại mật khẩu lúc này. Vui lòng thử lại sau.", 503); }
}
