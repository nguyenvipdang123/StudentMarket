import { extname } from "node:path";
import type { NextRequest } from "next/server";
import { error, getDb, requireAdmin } from "@/lib/auth";
import { studentCardKey } from "@/lib/media-files";
import { readMedia, MediaStorageError } from "@/lib/media-storage";

export const runtime = "nodejs";

export async function GET(request: NextRequest, context: RouteContext<"/api/admin/accounts/[id]/card">) {
  const { response } = await requireAdmin(request);
  if (response) return response;
  const { id } = await context.params;
  if (!/^[1-9]\d*$/.test(id)) return error("Tài khoản không hợp lệ.");
  const row = await getDb().prepare("SELECT card_path FROM auth_identities WHERE id = ? AND role = 'student'")
    .get(Number(id)) as { card_path: string | null } | undefined;
  if (!row?.card_path) return error("Không có ảnh thẻ sinh viên.", 404);
  const key = studentCardKey(row.card_path);
  if (!key) return error("Đường dẫn ảnh không hợp lệ.", 403);
  const type = { ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" }[extname(key).toLowerCase()];
  if (!type) return error("Định dạng ảnh không hợp lệ.", 404);
  try {
    const bytes = await readMedia("cards", key);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": type,
        "Content-Disposition": `inline; filename="student-card${extname(key)}"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (exception) { return error("Không đọc được ảnh thẻ.", exception instanceof MediaStorageError ? exception.status : 503); }
}
