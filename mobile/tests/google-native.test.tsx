import { fireEvent, render, screen } from "@testing-library/react-native";
import GoogleLogin from "../src/app/auth/google";
import { ThemeProvider } from "../src/theme";
import { API_URL, post } from "../src/api/client";
import { authConfig, claimGoogle } from "../src/api/native-auth";
import { readGoogleSecret, removeGoogleSecret, saveGoogleSecret } from "../src/api/auth-secrets";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
const mockComplete = jest.fn(async () => {});
jest.mock("../src/providers/Session", () => ({ useSession: () => ({ completeSignIn: mockComplete }) }));
jest.mock("../src/api/client", () => ({ API_URL: "https://sangtay.shop", post: jest.fn(), message: (e: Error) => e.message }));
jest.mock("../src/api/native-auth", () => ({ authConfig: jest.fn(), claimGoogle: jest.fn() }));
jest.mock("expo-crypto", () => ({ getRandomBytesAsync: jest.fn(async () => new Uint8Array(32).fill(12)), digestStringAsync: jest.fn(async () => "a".repeat(64)), CryptoDigestAlgorithm: { SHA256: "SHA256" } }));
jest.mock("expo-web-browser", () => ({ openBrowserAsync: jest.fn(async () => ({ type: "opened" })) }));
beforeEach(async () => {
  jest.mocked(post).mockReset(); jest.mocked(claimGoogle).mockReset(); jest.mocked(authConfig).mockReset(); mockComplete.mockReset(); mockComplete.mockResolvedValue(undefined);
  await removeGoogleSecret(API_URL, "flow"); await removeGoogleSecret(API_URL, "profile");
  jest.mocked(authConfig).mockResolvedValue({ version: 1, googleEnabled: true, turnstileEnabled: false });
});
test("Google starts a browser handoff with a SecureStore-only verifier, and returns to native onboarding", async () => {
  const id = "a".repeat(43), url = `${API_URL}/api/auth/mobile/google/authorize?flow=${id}`;
  jest.mocked(post).mockResolvedValue({ flowId: id, authorizationUrl: url, expiresAt: Date.now() + 600000 });
  jest.mocked(claimGoogle).mockResolvedValue({ status: "onboarding" });
  await render(<ThemeProvider><GoogleLogin /></ThemeProvider>);
  await screen.findByRole("button", { name: "Tiếp tục với Google trường", disabled: false });
  await fireEvent.press(screen.getByRole("button", { name: "Tiếp tục với Google trường" }));
  await screen.findByRole("button", { name: "Bắt đầu lại với Google", disabled: false });
  expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(url, expect.any(Object));
  expect(post).toHaveBeenCalledWith("/api/auth/mobile/google/start", { challenge: "a".repeat(64) });
  const stored = await readGoogleSecret(API_URL, "flow");
  expect(stored?.verifier).toBe("0c".repeat(32)); expect(url).not.toContain(stored!.verifier);
  expect(router.replace).toHaveBeenCalledWith("/auth/google-profile");
});
test("Google resumes a saved handoff after remount and signs into the app", async () => {
  await saveGoogleSecret(API_URL, "flow", { flowId: "b".repeat(43), verifier: "c".repeat(64), expiresAt: Date.now() + 600000 });
  jest.mocked(claimGoogle).mockResolvedValue({ status: "authenticated" });
  await render(<ThemeProvider><GoogleLogin /></ThemeProvider>);
  await screen.findByText("Đã đăng nhập Google trên app."); expect(mockComplete).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button", { name: "Về Tài khoản" })).toBeOnTheScreen();
});
test("start failure keeps its actionable error and rejects an authorization URL outside the configured API", async () => {
  jest.mocked(post).mockResolvedValue({ flowId: "a".repeat(43), authorizationUrl: "https://evil.invalid/login", expiresAt: Date.now() + 600000 });
  await render(<ThemeProvider><GoogleLogin /></ThemeProvider>);
  await screen.findByRole("button", { name: "Tiếp tục với Google trường", disabled: false });
  await fireEvent.press(screen.getByRole("button", { name: "Tiếp tục với Google trường" }));
  await screen.findByText("Đường dẫn xác thực Google không hợp lệ.");
  expect(await readGoogleSecret(API_URL, "flow")).toBeNull();
});

test("identity verification retry after a successful handoff does not reclaim the consumed Google flow", async () => {
  await saveGoogleSecret(API_URL, "flow", { flowId: "b".repeat(43), verifier: "c".repeat(64), expiresAt: Date.now() + 600000 });
  jest.mocked(claimGoogle).mockResolvedValue({ status: "authenticated" });
  mockComplete.mockRejectedValueOnce(Error("Mất mạng khi xác nhận phiên")).mockResolvedValueOnce(undefined);
  await render(<ThemeProvider><GoogleLogin /></ThemeProvider>);
  await screen.findByText("Mất mạng khi xác nhận phiên");
  await fireEvent.press(screen.getByRole("button", { name: "Kiểm tra kết quả Google" }));
  await screen.findByText("Đã đăng nhập Google trên app.");
  expect(claimGoogle).toHaveBeenCalledTimes(1); expect(mockComplete).toHaveBeenCalledTimes(2);
});
