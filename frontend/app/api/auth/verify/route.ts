import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { appOrigin, digest, error, isEducationEmail, isValidEmail, publicAccount, sameOrigin, setSession } from "@/lib/auth";
import { transaction } from "@/lib/db";
import { allowEmailRequest, consumeEmailCode, lockAccount } from "@/lib/email-codes";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return error("Yêu cầu không hợp lệ.", 403);
  let email: string, code: string;
  try { const body = await request.json(); email = String(body.email || "").trim().toLowerCase(); code = String(body.code || "").trim(); }
  catch { return error("Dữ liệu không hợp lệ."); }
  if (!isValidEmail(email) || !/^\d{6}$/.test(code)) return error("Nhập email và mã xác thực gồm 6 chữ số.");
  try {
    if (!await allowEmailRequest(`verify-code:${digest(email)}`, 20, 900000)) return error("Đã thử quá nhiều lần. Vui lòng thử lại sau 15 phút.", 429);
    const result = await consumeEmailCode(email, code, "register");
    if (!result.ok) return error(result.message, result.status);
    const verified = result.account.status === "verified";
    const response = NextResponse.json({ status: result.account.status, ...(verified ? { user: publicAccount(result.account) } : {}),
      message: verified ? "Email đã xác thực. Tài khoản sinh viên đã được duyệt." : "Email đã xác thực. Ảnh thẻ sinh viên đang chờ Admin xét duyệt." });
    if (verified) await setSession(response, result.account.id);
    return response;
  } catch { return error("Không thể xác thực lúc này. Vui lòng thử lại sau.", 503); }
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") || "";
  const redirect = new URL("/", appOrigin(request));
  if (token.length < 32 || token.length > 100) {
    redirect.searchParams.set("authError", "verification");
    return NextResponse.redirect(redirect);
  }
  // Legacy links were issued only for educational addresses. New registrations use POST codes.
  const accountId = await transaction(async client => {
    const first = (await client.query("SELECT account_id FROM email_verifications WHERE token_hash=$1", [digest(token)])).rows[0];
    if (!first) return null;
    await lockAccount(client, Number(first.account_id));
    const verification = (await client.query(`SELECT e.account_id,a.email FROM email_verifications e JOIN auth_identities a ON a.id=e.account_id
      WHERE e.token_hash=$1 AND e.expires_at>$2 AND a.status='pending_email' FOR UPDATE OF e`, [digest(token), Date.now()])).rows[0];
    if (!verification || !isEducationEmail(verification.email)) return null;
    await client.query("UPDATE auth_identities SET status='verified',verified_at=$1 WHERE id=$2 AND status='pending_email'", [Date.now(), verification.account_id]);
    await client.query("DELETE FROM email_verifications WHERE account_id=$1", [verification.account_id]);
    await client.query("UPDATE account_email_codes SET expires_at=0,code_hash='' WHERE account_id=$1 AND purpose='register'", [verification.account_id]);
    await client.query(`INSERT INTO audit_logs(id,actor_id,action,target_type,target_id,description,created_at)
      VALUES(gen_random_uuid(),NULL,'AUTO_VERIFY_EDU_ACCOUNT','ACCOUNT',$1,$2,NOW())`, [String(verification.account_id), "Tự động duyệt tài khoản sau khi xác minh email trường bằng liên kết cũ."]);
    return Number(verification.account_id);
  });
  if (!accountId) {
    redirect.searchParams.set("authError", "verification");
    return NextResponse.redirect(redirect);
  }
  redirect.searchParams.set("verified", "1");
  const response = NextResponse.redirect(redirect);
  await setSession(response, accountId);
  return response;
}
