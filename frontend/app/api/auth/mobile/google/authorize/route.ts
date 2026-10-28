import { NextResponse, type NextRequest } from "next/server";
import { appOrigin, digest, error, oauthCookie } from "@/lib/auth";
import { query } from "@/lib/db";
import { googleAuthorizationUrl } from "@/lib/mobile-google-policy";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("flow") || "";
  if (!/^[A-Za-z0-9_-]{43}$/.test(id)) return error("Phiên Google không hợp lệ.");
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId || !process.env.GOOGLE_CLIENT_SECRET) return error("Google chưa được cấu hình.", 503);
  const [flow] = await query("SELECT oauth_state,oauth_nonce,oauth_verifier FROM mobile_google_flows WHERE id_hash=$1 AND expires_at>$2 AND outcome IS NULL AND claimed_at IS NULL", [digest(id), Date.now()]);
  if (!flow) return error("Phiên Google đã hết hạn. Hãy bắt đầu lại trong app.", 410);
  const data = { state: flow.oauth_state, nonce: flow.oauth_nonce, verifier: flow.oauth_verifier, mobileFlow: id };
  const response = NextResponse.redirect(googleAuthorizationUrl(clientId, process.env.GOOGLE_REDIRECT_URI || `${appOrigin(request)}/api/auth/google/callback`, data));
  response.cookies.set(oauthCookie, Buffer.from(JSON.stringify(data)).toString("base64url"), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 600 });
  response.headers.set("Cache-Control", "no-store"); response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
