import { NextResponse, type NextRequest } from "next/server";
import { error, publicAccount, sameOrigin, setSession } from "@/lib/auth";
import { completeGoogleProfile, GoogleProfileError } from "@/lib/google-profile";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return error("Yêu cầu không hợp lệ.", 403);
  let body;
  try { body = await request.json(); } catch { return error("Dữ liệu không hợp lệ."); }
  try {
    const account = await completeGoogleProfile(String(body.pendingToken || ""), body);
    const response = NextResponse.json({ user: publicAccount(account) }, { headers: { "Cache-Control": "no-store" } });
    await setSession(response, account.id);
    return response;
  } catch (e) {
    return e instanceof GoogleProfileError ? error(e.message, e.status) : error("Chưa hoàn tất hồ sơ Google. Vui lòng thử lại.", 503);
  }
}
