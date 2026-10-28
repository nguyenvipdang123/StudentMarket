import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { error, pendingGoogleCookie, publicAccount, sameOrigin, setSession } from "@/lib/auth";
import { completeGoogleProfile, GoogleProfileError } from "@/lib/google-profile";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return error("Yêu cầu không hợp lệ.", 403);
  const token = request.cookies.get(pendingGoogleCookie)?.value;
  if (!token) return error("Phiên Google đã hết hạn. Vui lòng thử lại.", 401);
  let body: { fullName?: string; studentId?: string; university?: string };
  try { body = await request.json(); } catch { return error("Dữ liệu không hợp lệ."); }
  try {
    const account = await completeGoogleProfile(token, body);
    const response = NextResponse.json({ user: publicAccount(account) });
    await setSession(response, account.id);
    response.cookies.set(pendingGoogleCookie, "", { path: "/", maxAge: 0 });
    return response;
  } catch (exception) {
    if (exception instanceof GoogleProfileError) return error(exception.message, exception.status);
    throw exception;
  }
}
