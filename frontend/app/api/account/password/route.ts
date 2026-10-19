import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { error, getAccountBySession, hashPassword, sameOrigin, verifyPassword, setSession } from "@/lib/auth";
import { transaction } from "@/lib/db";
import { allowEmailRequest, lockAccount } from "@/lib/email-codes";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return error("Yêu cầu không hợp lệ.", 403);

  const account = await getAccountBySession(request);
  if (!account) return error("Vui lòng đăng nhập để đổi mật khẩu.", 401);

  let body: { currentPassword?: string; newPassword?: string; confirmPassword?: string };
  try {
    body = await request.json();
  } catch {
    return error("Dữ liệu không hợp lệ.");
  }

  const currentPassword = String(body.currentPassword || "");
  const newPassword = String(body.newPassword || "");
  const confirmPassword = String(body.confirmPassword || "");

  if (!currentPassword || currentPassword.length > 128 || !newPassword || !confirmPassword) {
    return error("Vui lòng điền đầy đủ các trường mật khẩu.");
  }

  if (newPassword.length < 8 || newPassword.length > 128 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
    return error("Mật khẩu mới cần từ 8 đến 128 ký tự, có ít nhất một chữ cái và một chữ số.");
  }

  if (newPassword !== confirmPassword) {
    return error("Mật khẩu mới và xác nhận mật khẩu không khớp.");
  }

  if (newPassword === currentPassword) {
    return error("Mật khẩu mới không được trùng với mật khẩu hiện tại.");
  }

  // Xác thực mật khẩu cũ
  if (!await allowEmailRequest(`change-password:${account.id}`, 10, 900000)) return error("Đã thử quá nhiều lần. Vui lòng thử lại sau 15 phút.", 429);
  const validCurrent = account.password_hash ? await verifyPassword(currentPassword, account.password_hash) : false;
  if (!validCurrent) {
    return error("Mật khẩu hiện tại không chính xác.", 401);
  }

  try {
    const newHash = await hashPassword(newPassword);
    await transaction(async client => {
      await lockAccount(client, account.id);
      const changed = await client.query("UPDATE auth_identities SET password_hash = $1 WHERE id = $2 AND status='verified' AND password_hash=$3 RETURNING id", [newHash, account.id, account.password_hash]);
      if (!changed.rowCount) throw new Error("Account changed");
      await client.query("DELETE FROM sessions WHERE account_id = $1", [account.id]);
      await client.query("UPDATE account_email_codes SET expires_at=0,code_hash='' WHERE account_id=$1 AND purpose='reset'", [account.id]);
    });

    const response = NextResponse.json({
      message: "Đổi mật khẩu thành công! Hãy ghi nhớ mật khẩu mới của bạn.",
    });
    await setSession(response, account.id);
    return response;
  } catch (exception) {
    console.error("Change password failed:", exception);
    return error("Không thể đổi mật khẩu lúc này. Vui lòng thử lại sau.", 500);
  }
}
