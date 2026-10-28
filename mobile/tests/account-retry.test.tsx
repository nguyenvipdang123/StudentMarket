import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Alert, Linking } from "react-native";
import Account from "../src/app/(tabs)/account";
import { ThemeProvider } from "../src/theme";
import { useSession } from "../src/providers/Session";
import type { User } from "../src/api/types";
jest.mock("../src/providers/Session", () => ({ useSession: jest.fn() }));
const actor: User = { id: 1, pgUserId: "buyer", role: "student", status: "Active", fullName: "Sinh viên thử", email: "demo@example.invalid", university: "DNTU" };
function session(user: User | null = null) {
  const value = { user, ready: true, error: "", expired: false, expiryId: 0, refresh: jest.fn(async () => {}), completeSignIn: jest.fn(async () => {}), signIn: jest.fn(async () => {}), signOut: jest.fn(async () => {}) };
  jest.mocked(useSession).mockReturnValue(value);
  return value;
}
afterEach(() => { jest.restoreAllMocks(); });

test("support retry reopens the same URL and never refreshes the signed-in session", async () => {
  const value = session();
  const open = jest.spyOn(Linking, "openURL").mockRejectedValueOnce(Error("No browser")).mockResolvedValueOnce(undefined);
  await render(<ThemeProvider><Account /></ThemeProvider>);
  await fireEvent.press(screen.getByRole("button", { name: "Trung tâm hỗ trợ trên website ↗" }));
  await screen.findByText("Chưa mở được trang hỗ trợ. Bấm Thử lại để mở lại trang.");
  await fireEvent.press(screen.getByRole("button", { name: "Thử lại" }));
  expect(open).toHaveBeenCalledTimes(2);
  expect(open.mock.calls[1][0]).toBe(open.mock.calls[0][0]);
  expect(value.refresh).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: "Thử lại" })).not.toBeOnTheScreen();
});

test("logout errors retry logout rather than opening support or refreshing the session", async () => {
  const value = session(actor);
  value.signOut.mockRejectedValueOnce(Error("Chưa đăng xuất được")).mockResolvedValueOnce(undefined);
  const open = jest.spyOn(Linking, "openURL");
  const confirm = jest.spyOn(Alert, "alert");
  await render(<ThemeProvider><Account /></ThemeProvider>);
  await fireEvent.press(screen.getByRole("button", { name: "Đăng xuất" }));
  const action = confirm.mock.calls[0][2]?.find(button => button.text === "Đăng xuất");
  await act(async () => { action?.onPress?.(); });
  await screen.findByText("Chưa đăng xuất được");
  await fireEvent.press(screen.getByRole("button", { name: "Thử lại" }));
  expect(value.signOut).toHaveBeenCalledTimes(2);
  expect(value.refresh).not.toHaveBeenCalled();
  expect(open).not.toHaveBeenCalled();
});

test("a completed local logout with a remote warning offers dismissal, not a retry against another account", async () => {
  const value = session(actor);
  value.signOut.mockRejectedValueOnce(Error("Đã đăng xuất trên thiết bị. Chưa xác nhận được thu hồi phiên ở máy chủ vì mất kết nối."));
  const confirm = jest.spyOn(Alert, "alert");
  const result = await render(<ThemeProvider><Account /></ThemeProvider>);
  await fireEvent.press(screen.getByRole("button", { name: "Đăng xuất" }));
  await act(async () => { confirm.mock.calls[0][2]?.find(button => button.text === "Đăng xuất")?.onPress?.(); });
  jest.mocked(useSession).mockReturnValue({ ...value, user: null });
  await result.rerender(<ThemeProvider><Account /></ThemeProvider>);
  expect(screen.queryByRole("button", { name: "Thử lại" })).not.toBeOnTheScreen();
  jest.mocked(useSession).mockReturnValue({ ...value, user: { ...actor, id: 2, pgUserId: "another-account" } });
  await result.rerender(<ThemeProvider><Account /></ThemeProvider>);
  expect(screen.queryByRole("button", { name: "Thử lại" })).not.toBeOnTheScreen();
  expect(screen.queryByRole("button", { name: "Đóng thông báo" })).not.toBeOnTheScreen();
  jest.mocked(useSession).mockReturnValue({ ...value, user: null });
  await result.rerender(<ThemeProvider><Account /></ThemeProvider>);
  await fireEvent.press(screen.getByRole("button", { name: "Đóng thông báo" }));
  expect(value.signOut).toHaveBeenCalledTimes(1);
  expect(value.refresh).not.toHaveBeenCalled();
});
