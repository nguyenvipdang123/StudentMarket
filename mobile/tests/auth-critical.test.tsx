import { render, screen, userEvent } from "@testing-library/react-native";
import { Text, View } from "react-native";
import * as SecureStore from "expo-secure-store";
import Login from "../src/app/login";
import { SessionProvider, useSession } from "../src/providers/Session";
import { ThemeProvider } from "../src/theme";
import { Button } from "../src/components/UI";
import { clearSession } from "../src/api/client";
import { queryClient } from "../src/api/query-cache";
const cookie = "sangtay_session=" + "a".repeat(64);
const actor = { id: 1, pgUserId: "11111111-1111-4111-8111-111111111111", fullName: "Sinh viên kiểm thử", email: "fixture@example.invalid", university: "DNTU", role: "student", status: "Active" };
function AuthFlow() {
  const { user, ready, signOut } = useSession();
  if (!ready) return <Text>Đang khôi phục phiên</Text>;
  return user ? <View><Text>{`Đã đăng nhập: ${user.fullName}`}</Text><Button title="Đăng xuất kiểm thử" onPress={() => { void signOut(); }} /></View> : <Login />;
}
test("critical path: failed login retries, saves session in SecureStore, survives remount, then fully signs out", async () => {
  await clearSession();
  const originalFetch = global.fetch;
  let rejected = false, loggedIn = false;
  const seenCookies: (string | null)[] = [];
  global.fetch = jest.fn(async (url, options) => {
    const path = String(url);
    if (path.endsWith("/api/auth/login")) {
      if (!rejected) { rejected = true; return new Response(JSON.stringify({ error: "Mật khẩu chưa đúng" }), { status: 401 }); }
      loggedIn = true;
      return new Response(JSON.stringify({ user: actor }), { status: 200, headers: { "set-cookie": cookie + "; HttpOnly; Secure; Path=/" } });
    }
    if (path.endsWith("/api/auth/me")) {
      seenCookies.push(new Headers(options?.headers).get("Cookie"));
      return new Response(JSON.stringify({ user: loggedIn ? actor : null }), { status: 200 });
    }
    if (path.endsWith("/api/auth/logout")) { loggedIn = false; return new Response(JSON.stringify({ success: true }), { status: 200 }); }
    throw Error("Unexpected network request in fixture");
  });
  try {
    const user = userEvent.setup();
    const first = await render(<ThemeProvider><SessionProvider><AuthFlow /></SessionProvider></ThemeProvider>);
    await screen.findByRole("button", { name: "Đăng nhập" });
    await user.type(screen.getByLabelText("Email đã đăng ký"), actor.email);
    await user.type(screen.getByLabelText("Mật khẩu"), "fixture-password");
    await user.press(screen.getByRole("button", { name: "Đăng nhập" }));
    await screen.findByText("Mật khẩu chưa đúng");
    await user.press(screen.getByRole("button", { name: "Thử đăng nhập lại" }));
    await screen.findByText(`Đã đăng nhập: ${actor.fullName}`);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(expect.any(String), cookie, expect.any(Object));
    expect(seenCookies).toContain(cookie);
    await first.unmount();
    await render(<ThemeProvider><SessionProvider><AuthFlow /></SessionProvider></ThemeProvider>);
    await screen.findByText(`Đã đăng nhập: ${actor.fullName}`);
    await user.press(screen.getByRole("button", { name: "Đăng xuất kiểm thử" }));
    await screen.findByRole("button", { name: "Đăng nhập" });
    expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
    expect(loggedIn).toBe(false);
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  } finally { global.fetch = originalFetch; await clearSession(); queryClient.clear(); }
}, 20000);
