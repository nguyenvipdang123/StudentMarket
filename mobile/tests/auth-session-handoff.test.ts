import * as SecureStore from "expo-secure-store";
import { authenticatedUser, clearSession, onSessionExpired, post, request } from "../src/api/client";
import { readGoogleSecret, removeGoogleSecret, saveGoogleSecret } from "../src/api/auth-secrets";
const actor = { id: 1, fullName: "Sinh viên", email: "student@school.edu.vn", role: "student", university: "DNTU", pgUserId: "seller", status: "verified" };
const cookie = "sangtay_session=" + "b".repeat(64);
test("OTP and Google handoffs save only session cookies in SecureStore, and bad OTP/expired Google do not expire a valid session", async () => {
  await clearSession(); const actual = global.fetch; const expired = jest.fn(); const unsubscribe = onSessionExpired(expired);
  global.fetch = jest.fn(async (input, options) => {
    const path = String(input);
    if (path.endsWith("/api/auth/me")) { expect(new Headers(options?.headers).get("Cookie")).toBe(cookie); return new Response(JSON.stringify({ user: actor })); }
    const body = JSON.parse(String(options?.body || "{}"));
    if (body.bad) return new Response(JSON.stringify({ error: "OTP/Google không hợp lệ" }), { status: 401 });
    return new Response(JSON.stringify({ user: actor, status: "authenticated" }), { headers: { "set-cookie": cookie + "; HttpOnly; Secure" } });
  });
  try {
    for (const endpoint of ["/api/auth/verify", "/api/auth/mobile/google/claim", "/api/auth/mobile/google/complete"]) {
      await post(endpoint, {}); expect(await authenticatedUser()).toEqual(actor);
      await expect(post(endpoint, { bad: true })).rejects.toMatchObject({ status: 401 });
      expect((await request<{ user: object }>("/api/auth/me")).user).toEqual(actor);
    }
    expect(expired).not.toHaveBeenCalled();
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(expect.any(String), cookie, expect.any(Object));
  } finally { global.fetch = actual; unsubscribe(); await clearSession(); }
});

test("Google secrets survive screen restart only in SecureStore, are isolated by API and expire", async () => {
  const origin = "https://fixture.invalid", flow = { flowId: "a".repeat(43), verifier: "b".repeat(64), expiresAt: Date.now() + 600000 };
  await saveGoogleSecret(origin, "flow", flow); expect(await readGoogleSecret(origin, "flow")).toEqual(flow);
  expect(await readGoogleSecret("https://other.invalid", "flow")).toBeNull();
  await saveGoogleSecret(origin, "profile", { pendingToken: "c".repeat(43), email: actor.email, fullName: actor.fullName, expiresAt: Date.now() - 1 });
  expect(await readGoogleSecret(origin, "profile")).toBeNull();
  await removeGoogleSecret(origin, "flow"); expect(await readGoogleSecret(origin, "flow")).toBeNull();
});
