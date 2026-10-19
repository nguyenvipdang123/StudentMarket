import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { error, getAccountBySession, getDb, publicAccount, sameOrigin } from "@/lib/auth";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest) {
  if (!sameOrigin(request)) return error("Yêu cầu không hợp lệ.", 403);

  const account = await getAccountBySession(request);
  if (!account || account.status !== "verified") return error("Vui lòng đăng nhập để cập nhật thông tin.", 401);

  let body: { fullName?: string; university?: string };
  try {
    body = await request.json();
  } catch {
    return error("Dữ liệu không hợp lệ.");
  }

  const fullName = String(body.fullName || "").trim().replace(/\s+/g, " ");
  const university = String(body.university || "").trim();

  if (fullName.length < 2 || fullName.length > 100) {
    return error("Họ và tên cần từ 2 đến 100 ký tự.");
  }
  if (university.length < 2 || university.length > 120) {
    return error("Vui lòng chọn hoặc nhập trường đại học hợp lệ.");
  }

  const db = getDb();
  try {
    await db.prepare("UPDATE auth_identities SET full_name = ?, university = ? WHERE id = ?")
      .run(fullName, university, account.id);

    const updated = await db.prepare("SELECT * FROM auth_identities WHERE id = ?").get(account.id) as typeof account;
    return NextResponse.json({
      message: "Cập nhật thông tin thành công!",
      user: publicAccount(updated),
    });
  } catch (exception) {
    console.error("Update profile failed:", exception);
    return error("Không thể cập nhật thông tin lúc này. Vui lòng thử lại sau.", 500);
  }
}
