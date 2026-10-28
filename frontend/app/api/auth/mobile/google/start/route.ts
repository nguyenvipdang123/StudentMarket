import { NextResponse, type NextRequest } from "next/server";
import { appOrigin, digest, error, randomToken, sameOrigin } from "@/lib/auth";
import { query } from "@/lib/db";
import { allowEmailRequest } from "@/lib/email-codes";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return error("Yêu cầu không hợp lệ.", 403);
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) return error("Google chưa được cấu hình trên máy chủ.", 503);
  let challenge: unknown;
  try { challenge = (await request.json()).challenge; } catch { return error("Dữ liệu không hợp lệ."); }
  if (typeof challenge !== "string" || !/^[a-f0-9]{64}$/.test(challenge)) return error("Mã xác thực ứng dụng không hợp lệ.");
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  if (!await allowEmailRequest(`mobile-google:${digest(ip)}`, 30, 3600000)) return error("Đã đăng nhập Google quá nhiều lần. Hãy thử lại sau.", 429);
  const flowId = randomToken(), now = Date.now();
  await query("DELETE FROM mobile_google_flows WHERE expires_at<=$1", [now]);
  await query("INSERT INTO mobile_google_flows(id_hash,client_challenge,oauth_state,oauth_nonce,oauth_verifier,expires_at) VALUES($1,$2,$3,$4,$5,$6)", [digest(flowId), challenge, randomToken(), randomToken(), randomToken(), now + 600000]);
  return NextResponse.json({ flowId, authorizationUrl: `${appOrigin(request)}/api/auth/mobile/google/authorize?flow=${flowId}`, expiresAt: now + 600000 }, { headers: { "Cache-Control": "no-store" } });
}
