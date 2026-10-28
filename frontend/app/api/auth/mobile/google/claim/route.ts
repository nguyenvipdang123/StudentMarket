import { NextResponse, type NextRequest } from "next/server";
import { digest, error, publicAccount, randomToken, sameOrigin, setSession, type Account } from "@/lib/auth";
import { transaction } from "@/lib/db";
import { validMobileProof } from "@/lib/mobile-google-policy";
import type { MobileGoogleOutcome } from "@/lib/mobile-google";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return error("Yêu cầu không hợp lệ.", 403);
  let flowId: string, verifier: unknown;
  try { const body = await request.json(); flowId = String(body.flowId || ""); verifier = body.verifier; } catch { return error("Dữ liệu không hợp lệ."); }
  if (!/^[A-Za-z0-9_-]{43}$/.test(flowId)) return error("Phiên Google không hợp lệ.");
  const result = await transaction(async client => {
    const [row] = (await client.query("SELECT * FROM mobile_google_flows WHERE id_hash=$1 FOR UPDATE", [digest(flowId)])).rows;
    if (!row || row.claimed_at || row.expires_at <= Date.now() || !validMobileProof(verifier, row.client_challenge)) return { error: "Phiên Google hết hạn hoặc mã xác thực ứng dụng không khớp.", status: 410 };
    const outcome = row.outcome as MobileGoogleOutcome | null;
    if (!outcome) return { pending: true };
    await client.query("UPDATE mobile_google_flows SET claimed_at=$1 WHERE id_hash=$2", [Date.now(), digest(flowId)]);
    if (outcome.status === "error") return { error: outcome.error, status: 403 };
    if (outcome.status === "authorized") {
      const account = (await client.query("SELECT * FROM auth_identities WHERE id=$1 AND status='verified'", [outcome.accountId])).rows[0] as Account | undefined;
      return account ? { account } : { error: "Tài khoản không còn hoạt động.", status: 403 };
    }
    const pendingToken = randomToken();
    await client.query("INSERT INTO google_onboarding(token_hash,google_sub,full_name,email,expires_at) VALUES($1,$2,$3,$4,$5)", [digest(pendingToken), outcome.sub, outcome.fullName, outcome.email, Date.now() + 600000]);
    return { pendingToken, email: outcome.email, fullName: outcome.fullName };
  });
  if (result.error) return error(result.error, result.status);
  const response = NextResponse.json(result.account ? { status: "authenticated", user: publicAccount(result.account) } : result.pending ? { status: "pending" } : { status: "onboarding", pendingToken: result.pendingToken, email: result.email, fullName: result.fullName }, { headers: { "Cache-Control": "no-store" } });
  if (result.account) await setSession(response, result.account.id);
  return response;
}
