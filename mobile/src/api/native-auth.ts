import { API_URL, post, request, type ApiError } from "./client";
import { appendPhotos } from "./photos";
import type { CompressedPhoto } from "./photos-policy";
import type { Registration } from "./auth-policy";
import { readGoogleSecret, removeGoogleSecret, saveGoogleSecret } from "./auth-secrets";
export type BotAction = "register" | "reset_password" | "resend_verification";
export type AuthConfig = { version: 1; turnstileEnabled: boolean; googleEnabled: boolean };
export async function authConfig() {
  try {
    const config = await request<AuthConfig>("/api/auth/mobile/config");
    if (config.version !== 1 || typeof config.turnstileEnabled !== "boolean" || typeof config.googleEnabled !== "boolean") throw Error("Cấu hình xác thực chưa hợp lệ.");
    return config;
  } catch (e) {
    if ((e as ApiError).status === 404) throw Error("Máy chủ chưa cập nhật xác thực mobile. Cần triển khai bản mới lên Render.");
    throw e;
  }
}
export async function registerAccount(profile: Registration, card: CompressedPhoto | null, token: string) {
  const form = new FormData();
  Object.entries(profile).forEach(([key, value]) => form.append(key, value));
  form.append("turnstileToken", token);
  if (card) await appendPhotos(form, [card], "studentCard");
  return request<{ message: string; resendAfter: number }>("/api/auth/register", { method: "POST", body: form }, 60000);
}
export async function claimGoogle() {
  const flow = await readGoogleSecret(API_URL, "flow");
  if (!flow) throw Error("Phiên Google đã hết hạn. Hãy bắt đầu lại.");
  const result = await post<{ status: "pending" | "authenticated" | "onboarding"; pendingToken?: string; email?: string; fullName?: string }>("/api/auth/mobile/google/claim", { flowId: flow.flowId, verifier: flow.verifier });
  if (result.status === "onboarding") {
    if (!result.pendingToken || !result.email) throw Error("Chưa nhận được hồ sơ Google hợp lệ.");
    await saveGoogleSecret(API_URL, "profile", { pendingToken: result.pendingToken, email: result.email, fullName: result.fullName || "", expiresAt: Date.now() + 600000 });
  }
  if (result.status !== "pending") await removeGoogleSecret(API_URL, "flow").catch(() => {});
  return result;
}
export async function finishGoogleProfile(profile: Pick<Registration, "fullName" | "studentId" | "university">) {
  const pending = await readGoogleSecret(API_URL, "profile");
  if (!pending) throw Error("Phiên Google đã hết hạn. Hãy đăng nhập Google lại.");
  const result = await post("/api/auth/mobile/google/complete", { ...profile, pendingToken: pending.pendingToken });
  // The server consumed this credential. A local deletion error must not repeat account creation.
  await removeGoogleSecret(API_URL, "profile").catch(() => {}); return result;
}
