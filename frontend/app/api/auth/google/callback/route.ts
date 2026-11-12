import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { appOrigin, digest, getDb, isEducationEmail, oauthCookie, pendingGoogleCookie, randomToken, setSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { isEducationDomain } from "@/lib/education-email";
import { finishMobileGoogle, validMobileCallback } from "@/lib/mobile-google";

export const runtime = "nodejs";

const googleKeys = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

function finish(request: NextRequest, parameter: string, value: string) {
  const url = new URL("/", appOrigin(request));
  url.searchParams.set(parameter, value);
  const response = NextResponse.redirect(url);
  response.cookies.set(oauthCookie, "", { path: "/", maxAge: 0 });
  return response;
}

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const stored = request.cookies.get(oauthCookie)?.value;
  if (!state || !stored) return finish(request, "authError", "google");

  let flow: { state: string; nonce: string; verifier: string; mobileFlow?: string };
  try { flow = JSON.parse(Buffer.from(stored, "base64url").toString("utf8")); }
  catch { return finish(request, "authError", "google"); }
  if (flow.state !== state || !flow.nonce || !flow.verifier) return finish(request, "authError", "google");
  if (flow.mobileFlow && !await validMobileCallback(flow.mobileFlow, state)) return finish(request, "authError", "google");
  const fail = (reason: string) => flow.mobileFlow ? finishMobileGoogle(flow.mobileFlow, state, { status: "error", error: reason }) : finish(request, "authError", reason);
  const signIn = async (accountId: number) => {
    if (flow.mobileFlow) return finishMobileGoogle(flow.mobileFlow, state, { status: "authorized", accountId });
    const response = finish(request, "google", "success");
    await setSession(response, accountId);
    return response;
  };
  if (!clientId || !clientSecret || !code) return fail("google");

  try {
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${appOrigin(request)}/api/auth/google/callback`;
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code", code_verifier: flow.verifier }),
      cache: "no-store", signal: AbortSignal.timeout(15000),
    });
    if (!tokenResponse.ok) return fail("google");
    const tokens = await tokenResponse.json() as { id_token?: string };
    if (!tokens.id_token) return fail("google");
    const { payload } = await jwtVerify(tokens.id_token, googleKeys, {
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience: clientId,
      algorithms: ["RS256"],
    });
    const email = String(payload.email || "").toLowerCase();
    const hostedDomain = String(payload.hd || "").toLowerCase();
    if (payload.nonce !== flow.nonce || payload.email_verified !== true || !payload.sub ||
      !isEducationEmail(email) || !isEducationDomain(hostedDomain) || email.split("@")[1] !== hostedDomain) {
      return fail("school_google");
    }
    const db = getDb();
    const [account] = await query<{ id: number; status: string; role: string }>(
      "SELECT id, status, role FROM auth_identities WHERE google_sub = $1", [payload.sub],
    );
    if (account) {
      if (account.role !== "student" || account.status !== "verified") return fail("account_status");
      return await signIn(account.id);
    }
    const [existing] = await query<{ id: number; status: string; role: string }>(
      "SELECT id, status, role FROM auth_identities WHERE LOWER(email) = $1", [email],
    );
    if (existing) {
      if (existing.role !== "student") return fail("email_exists");
      if (existing.status !== "verified") return fail("account_status");

      // Google has verified the exact school mailbox above. Bind its stable subject once.
      const [linked] = await query<{ id: number }>(
        `UPDATE users SET google_sub = $3, updated_at = NOW()
         WHERE auth_id = $1 AND LOWER(email) = $2 AND auth_status = 'verified'
           AND (google_sub IS NULL OR google_sub = $3)
         RETURNING auth_id AS id`,
        [existing.id, email, payload.sub],
      );
      if (!linked) return fail("email_exists");
      return await signIn(linked.id);
    }
    if (flow.mobileFlow) return finishMobileGoogle(flow.mobileFlow, state, { status: "onboarding", sub: payload.sub, email, fullName: String(payload.name || "").trim() });
    const pendingToken = randomToken();
    await db.prepare("INSERT INTO google_onboarding (token_hash, google_sub, full_name, email, expires_at) VALUES (?, ?, ?, ?, ?)")
      .run(digest(pendingToken), payload.sub, String(payload.name || "").trim(), email, Date.now() + 10 * 60_000);
    const response = finish(request, "auth", "google-complete");
    response.cookies.set(pendingGoogleCookie, pendingToken, {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 600,
    });
    return response;
  } catch {
    console.error("Google authentication failed.");
    return fail("google");
  }
}
