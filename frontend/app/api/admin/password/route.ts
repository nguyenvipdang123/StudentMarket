import { unlink } from "node:fs/promises";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  adminCredentialPath, digest, error, getDb, hashPassword, requireAdmin,
  sameOrigin, sessionCookie, verifyPassword,
} from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return error("Yêu cầu không hợp lệ.", 403);
  const { account, response } = await requireAdmin(request);
  if (response || !account) return response;
  let body: { currentPassword?: string; newPassword?: string; confirmPassword?: string };
  try { body = await request.json(); } catch { return error("Dữ liệu không hợp lệ."); }
  const current = String(body.currentPassword || "");
  const next = String(body.newPassword || "");
  if (!account.password_hash || !await verifyPassword(current, account.password_hash)) return error("Mật khẩu hiện tại không đúng.", 403);
  if (next.length < 12 || next.length > 128 || !/[A-Za-z]/.test(next) || !/\d/.test(next)) return error("Mật khẩu mới cần 12–128 ký tự, gồm chữ và số.");
  if (next !== body.confirmPassword) return error("Xác nhận mật khẩu mới không khớp.");
  if (next === current) return error("Mật khẩu mới cần khác mật khẩu hiện tại.");
  const db = getDb();
  await db.prepare("UPDATE auth_identities SET password_hash = ? WHERE id = ?").run(await hashPassword(next), account.id);
  const currentToken = request.cookies.get(sessionCookie)?.value;
  await db.prepare("DELETE FROM sessions WHERE account_id = ? AND token_hash != ?")
    .run(account.id, currentToken ? digest(currentToken) : "");
  await unlink(adminCredentialPath).catch(() => undefined);
  return NextResponse.json({ message: "Đã đổi mật khẩu quản trị và đăng xuất các phiên khác." });
}
