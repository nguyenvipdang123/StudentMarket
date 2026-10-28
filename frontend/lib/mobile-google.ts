import { NextResponse } from "next/server";
import { digest, oauthCookie } from "./auth";
import { query } from "./db";

export type MobileGoogleOutcome = { status: "error"; error: string } | { status: "authorized"; accountId: number } |
  { status: "onboarding"; sub: string; email: string; fullName: string };
export async function validMobileCallback(id: string, state: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(id)) return false;
  const rows = await query("SELECT 1 FROM mobile_google_flows WHERE id_hash=$1 AND oauth_state=$2 AND expires_at>$3 AND outcome IS NULL AND claimed_at IS NULL", [digest(id), state, Date.now()]);
  return rows.length === 1;
}
export async function finishMobileGoogle(id: string, state: string, outcome: MobileGoogleOutcome) {
  const rows = await query("UPDATE mobile_google_flows SET outcome=$1::jsonb WHERE id_hash=$2 AND oauth_state=$3 AND expires_at>$4 AND outcome IS NULL AND claimed_at IS NULL RETURNING id_hash", [JSON.stringify(outcome), digest(id), state, Date.now()]);
  const success = rows.length === 1 && outcome.status !== "error";
  // No credentials, account names, email addresses or arbitrary redirect URLs in this bridge.
  const html = `<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SangTay</title><body><main><h1>${success ? "Google đã xác thực" : "Chưa hoàn tất đăng nhập"}</h1><p>Đóng cửa sổ này hoặc bấm Quay lại để trở về ứng dụng SangTay. App sẽ kiểm tra kết quả và tiếp tục đăng nhập.</p></main></body></html>`;
  const response = new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY", "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'" } });
  response.cookies.set(oauthCookie, "", { path: "/", maxAge: 0 });
  return response;
}
