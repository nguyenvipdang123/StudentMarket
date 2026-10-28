import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
const actions = ["register", "reset_password", "resend_verification"];
export async function GET(request: NextRequest) {
  const action = request.nextUrl.searchParams.get("action") || "";
  const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || "";
  if (!actions.includes(action) || !/^[a-zA-Z0-9_-]{1,100}$/.test(sitekey)) return new NextResponse("Xác minh chống bot chưa sẵn sàng.", { status: 503 });
  const nonce = randomBytes(16).toString("base64url");
  const html = `<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Xác minh SangTay</title><body><p>Hoàn tất xác minh để tiếp tục trong app.</p><div id="challenge"></div><script nonce="${nonce}">function send(data){if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify(data))}window.onTurnstileLoad=function(){turnstile.render('#challenge',{sitekey:${JSON.stringify(sitekey)},action:${JSON.stringify(action)},callback:function(token){send({token:token})},'error-callback':function(){send({error:'Xác minh chưa thành công. Hãy thử lại.'})},'expired-callback':function(){send({error:'Xác minh đã hết hạn. Hãy thử lại.'})}})}</script><script nonce="${nonce}" src="https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad&amp;render=explicit" defer></script></body></html>`;
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; connect-src https://challenges.cloudflare.com; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'` } });
}
