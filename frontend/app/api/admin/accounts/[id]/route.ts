import { transaction } from "@/lib/db";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { error, getDb, requireAdmin, sameOrigin } from "@/lib/auth";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest, context: RouteContext<"/api/admin/accounts/[id]">) {
  if (!sameOrigin(request)) return error("Yêu cầu không hợp lệ.", 403);
  const { response } = await requireAdmin(request);
  if (response) return response;
  const { id } = await context.params;
  if (!/^[1-9]\d*$/.test(id)) return error("Tài khoản không hợp lệ.");
  let body: { action?: string };
  try { body = await request.json(); } catch { return error("Dữ liệu không hợp lệ."); }
  if (body.action !== "approve" && body.action !== "lock") return error("Thao tác không hợp lệ.");
  const db = getDb();
  const target = await db.prepare("SELECT id, status, card_path FROM auth_identities WHERE id = ? AND role = 'student'")
    .get(Number(id)) as { id: number; status: string; card_path: string | null } | undefined;
  if (!target) return error("Không tìm thấy tài khoản sinh viên.", 404);
  if (body.action === "approve") {
    if (target.status !== "pending_review" || !target.card_path) return error("Chỉ duyệt tài khoản đang chờ kiểm tra ảnh thẻ.", 409);
    await db.prepare("UPDATE auth_identities SET status = 'verified', verified_at = ? WHERE id = ?")
      .run(Date.now(), target.id);
  } else {
    if (target.status === "locked") return error("Tài khoản đã bị khóa.", 409);
    await transaction(async client => {
      await client.query("UPDATE auth_identities SET status = 'locked' WHERE id = $1", [target.id]);
      await client.query("DELETE FROM sessions WHERE account_id = $1", [target.id]);
    });
  }
  return NextResponse.json({ ok: true });
}
