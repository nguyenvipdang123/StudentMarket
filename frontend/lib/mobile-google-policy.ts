import { createHash, timingSafeEqual } from "node:crypto";
export function mobileChallenge(verifier: string) {
  if (!/^[a-f0-9]{64}$/.test(verifier)) return null;
  return createHash("sha256").update(verifier).digest("hex");
}
export function validMobileProof(verifier: unknown, challenge: string) {
  const actual = typeof verifier === "string" ? mobileChallenge(verifier) : null;
  return !!actual && /^[a-f0-9]{64}$/.test(challenge) && timingSafeEqual(Buffer.from(actual), Buffer.from(challenge));
}
export function googleAuthorizationUrl(clientId: string, redirectUri: string, flow: { state: string; nonce: string; verifier: string }) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: "code", scope: "openid email profile", state: flow.state, nonce: flow.nonce,
    code_challenge: createHash("sha256").update(flow.verifier).digest("base64url"), code_challenge_method: "S256", prompt: "select_account" }).toString();
  return url;
}
