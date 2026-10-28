import * as SecureStore from "expo-secure-store";
import { apiOrigin, sessionCookie } from "./policy";
import { createSessionState } from "./session-state";
import type { User } from "./types";

export const API_URL = apiOrigin(
  process.env.EXPO_PUBLIC_API_URL || "https://sangtay.shop",
);
// Keep production, local HTTP and different development ports in separate stores.
const storeKey = `sangtay.session.${API_URL.replace(/[^a-z0-9.-]/gi, "_")}`;
const sessions = createSessionState({
  read: () => SecureStore.getItemAsync(storeKey),
  write: (cookie) =>
    SecureStore.setItemAsync(storeKey, cookie, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    }),
  remove: () => SecureStore.deleteItemAsync(storeKey),
});
export const expiredSessionMessage =
  "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
export const onSessionExpired = sessions.subscribe;
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function restoreSession() {
  return sessions.restore();
}
export async function clearSession() {
  await sessions.clear();
}
export async function request<T>(
  path: string,
  options: RequestInit = {},
  timeout = 20000,
): Promise<T> {
  if (!path.startsWith("/api/")) throw Error("Đường dẫn API không hợp lệ.");
  const headers = new Headers(options.headers);
  const session = sessions.snapshot();
  const endpoint = path.split("?")[0];
  const canExpireSession =
    endpoint !== "/api/auth/login" && endpoint !== "/api/auth/logout";
  headers.set("Accept", "application/json");
  if (session.cookie) headers.set("Cookie", session.cookie);
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(API_URL + path, {
      ...options,
      headers,
      credentials: "omit",
      redirect: "error",
      signal: controller.signal,
    });
    if (response.status === 401 && canExpireSession) {
      const expired = await sessions.expire(session);
      if (!expired && sessions.snapshot().cookie) {
        throw new ApiError(
          "Phiên đăng nhập đã thay đổi. Vui lòng thử lại.",
          409,
        );
      }
      throw new ApiError(expiredSessionMessage, 401);
    }
    if (
      canExpireSession &&
      (session.cookie || endpoint === "/api/auth/me") &&
      !sessions.matches(session)
    ) {
      throw new ApiError("Phiên đăng nhập đã thay đổi. Vui lòng thử lại.", 409);
    }
    let data: Record<string, unknown>;
    try {
      data = await response.json();
    } catch {
      throw new ApiError(
        "Máy chủ chưa trả dữ liệu hợp lệ. Vui lòng thử lại.",
        response.status,
      );
    }
    if (!response.ok)
      throw new ApiError(
        typeof data.error === "string"
          ? data.error
          : "Không thể xử lý yêu cầu.",
        response.status,
      );
    // The identity endpoint reports an invalid session as 200 { user: null }.
    if (endpoint === "/api/auth/me" && session.cookie && data.user === null) {
      await sessions.expire(session);
      throw new ApiError(expiredSessionMessage, 401);
    }
    if (path === "/api/auth/login") {
      const next = sessionCookie(response.headers.get("set-cookie"));
      if (!next)
        throw new ApiError(
          "Không nhận được phiên đăng nhập. Vui lòng thử lại.",
          503,
        );
      await sessions.save(next);
    }
    return data as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      controller.signal.aborted
        ? "Kết nối quá lâu. Bạn thử lại nhé."
        : "Không kết nối được SangTay. Kiểm tra mạng rồi thử lại.",
      0,
    );
  } finally {
    clearTimeout(timer);
  }
}
export function post<T>(path: string, data: unknown) {
  return request<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}
export async function login(email: string, password: string) {
  const result = await post<{ user: User }>("/api/auth/login", {
    email,
    password,
  });
  // Verify the saved native cookie works before showing a signed-in interface.
  const identity = await request<{ user: User | null }>("/api/auth/me");
  if (!identity.user) {
    await clearSession();
    throw new ApiError("Không thể xác nhận phiên đăng nhập.", 401);
  }
  return { ...result.user, ...identity.user };
}
export const message = (error: unknown) =>
  error instanceof Error ? error.message : "Có lỗi xảy ra. Bạn thử lại nhé.";
