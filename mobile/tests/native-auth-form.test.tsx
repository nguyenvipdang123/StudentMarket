import { fireEvent, render, screen } from "@testing-library/react-native";
import { NativeAuthForm } from "../src/components/NativeAuthForm";
import { ThemeProvider } from "../src/theme";
import { post } from "../src/api/client";
import { registerAccount } from "../src/api/native-auth";
import { router } from "expo-router";
import Login from "../src/app/login";
const mockComplete = jest.fn(async () => {});
jest.mock("../src/providers/Session", () => ({ useSession: () => ({ ready: true, completeSignIn: mockComplete }) }));
jest.mock("../src/api/client", () => ({ API_URL: "https://sangtay.shop", post: jest.fn(), message: (e: Error) => e.message }));
jest.mock("../src/api/native-auth", () => ({ registerAccount: jest.fn(), finishGoogleProfile: jest.fn() }));
jest.mock("../src/api/photos", () => ({ compressPhoto: jest.fn() }));
jest.mock("expo-image-picker", () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock("expo-image", () => ({ Image: "Image" }));
const mockBotToken = jest.fn(async () => "verified-bot-token");
jest.mock("../src/components/BotChallenge", () => ({ useBotChallenge: () => ({ token: mockBotToken, challenge: null }) }));
jest.mock("../src/components/SchoolPicker", () => ({ SchoolPicker: ({ onChange }: { onChange: (v: string) => void }) => {
  const { Button } = jest.requireActual<typeof import("../src/components/UI")>("../src/components/UI"); return <Button title="Chọn DNTU" onPress={() => onChange("DNTU")} />;
} }));
beforeEach(() => { mockComplete.mockReset(); mockComplete.mockResolvedValue(undefined); mockBotToken.mockClear(); jest.mocked(post).mockReset(); jest.mocked(registerAccount).mockReset(); });
const mount = (mode: "register" | "verify" | "forgot") => render(<ThemeProvider><NativeAuthForm mode={mode} /></ThemeProvider>);

test("native registration preserves fields on server error, retries, clears passwords, verifies OTP and establishes the app session", async () => {
  jest.mocked(registerAccount).mockRejectedValueOnce(Error("SMTP tạm lỗi")).mockResolvedValueOnce({ message: "Đã gửi OTP", resendAfter: 60 });
  jest.mocked(post).mockRejectedValueOnce(Error("Mã không đúng")).mockResolvedValueOnce({ user: { id: 1 }, message: "Tài khoản đã được duyệt" });
  await mount("register");
  for (const [label, value] of [["Email", "new@school.edu.vn"], ["Họ và tên", "Sinh viên thử"], ["Mã sinh viên", "SV123"], ["Mật khẩu đăng ký", "TestPass123"], ["Xác nhận mật khẩu", "TestPass123"]]) await fireEvent.changeText(screen.getByLabelText(label), value);
  await fireEvent.press(screen.getByRole("button", { name: "Chọn DNTU" }));
  await fireEvent.press(screen.getByRole("button", { name: "Đăng ký và gửi OTP" }));
  await screen.findByText("SMTP tạm lỗi");
  expect(screen.getByLabelText("Họ và tên")).toHaveDisplayValue("Sinh viên thử");
  await fireEvent.press(screen.getByRole("button", { name: "Thử lại" }));
  await screen.findByLabelText("Mã OTP 6 số");
  expect(screen.queryByLabelText("Mật khẩu đăng ký")).not.toBeOnTheScreen();
  expect(screen.getByRole("button", { name: /Gửi lại mã sau/ })).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText("Mã OTP 6 số"), "012345");
  await fireEvent.press(screen.getByRole("button", { name: "Xác minh OTP" }));
  await screen.findByText("Mã không đúng");
  expect(screen.getByLabelText("Mã OTP 6 số")).toHaveDisplayValue("012345");
  await fireEvent.press(screen.getByRole("button", { name: "Thử lại" }));
  await screen.findByText("Đã hoàn tất");
  expect(mockComplete).toHaveBeenCalledTimes(1); expect(mockBotToken).toHaveBeenCalledWith("register");
  expect(post).toHaveBeenLastCalledWith("/api/auth/verify", { email: "new@school.edu.vn", code: "012345" });
});

test("forgot password sends OTP, validates the new password locally, retries without changing the request and returns to native login", async () => {
  jest.mocked(post).mockResolvedValueOnce({ message: "Nếu tài khoản hợp lệ, mã đã được gửi" }).mockRejectedValueOnce(Error("Mã hết hạn")).mockResolvedValueOnce({ message: "Đã đổi mật khẩu" });
  await mount("forgot");
  await fireEvent.changeText(screen.getByLabelText("Email"), "existing@example.invalid");
  await fireEvent.press(screen.getByRole("button", { name: "Gửi mã đặt lại mật khẩu" }));
  await screen.findByLabelText("Mã OTP 6 số");
  await fireEvent.changeText(screen.getByLabelText("Mã OTP 6 số"), "123456");
  await fireEvent.changeText(screen.getByLabelText("Mật khẩu mới"), "NewPassword123");
  await fireEvent.changeText(screen.getByLabelText("Xác nhận mật khẩu"), "wrong");
  await fireEvent.press(screen.getByRole("button", { name: "Đặt mật khẩu mới" }));
  await screen.findByText("Xác nhận mật khẩu không khớp."); expect(post).toHaveBeenCalledTimes(1);
  await fireEvent.changeText(screen.getByLabelText("Xác nhận mật khẩu"), "NewPassword123");
  await fireEvent.press(screen.getByRole("button", { name: "Đặt mật khẩu mới" }));
  await screen.findByText("Mã hết hạn"); await fireEvent.press(screen.getByRole("button", { name: "Thử lại" }));
  await screen.findByText("Đã đổi mật khẩu");
  expect(jest.mocked(post).mock.calls[1]).toEqual(jest.mocked(post).mock.calls[2]);
  expect(mockBotToken).toHaveBeenCalledWith("reset_password"); expect(mockComplete).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole("button", { name: "Đăng nhập bằng mật khẩu mới" }));
  expect(router.replace).toHaveBeenCalledWith("/login");
});

test("personal-email verification keeps pending-review status and never signs in before Admin approval", async () => {
  jest.mocked(post).mockResolvedValueOnce({ message: "Mã mới đã gửi" }).mockResolvedValueOnce({ status: "pending_review", message: "Ảnh thẻ đang chờ Admin duyệt" });
  await mount("verify"); await fireEvent.changeText(screen.getByLabelText("Email"), "student@gmail.com");
  await fireEvent.press(screen.getByRole("button", { name: "Gửi lại mã OTP" }));
  expect(mockBotToken).toHaveBeenCalledWith("resend_verification");
  await fireEvent.changeText(screen.getByLabelText("Mã OTP 6 số"), "123456");
  await fireEvent.press(screen.getByRole("button", { name: "Xác minh OTP" }));
  await screen.findByText("Ảnh thẻ đang chờ Admin duyệt"); expect(mockComplete).not.toHaveBeenCalled();
});

test("login routes registration, verification, Google and password reset inside the app", async () => {
  await render(<ThemeProvider><Login /></ThemeProvider>);
  for (const [name, route] of [["Đăng ký tài khoản", "/auth/register"], ["Quên mật khẩu", "/auth/forgot"], ["Xác minh email / Gửi lại OTP", "/auth/verify"], ["Tiếp tục với Google trường", "/auth/google"]]) {
    await fireEvent.press(screen.getByRole("button", { name })); expect(router.push).toHaveBeenLastCalledWith(route);
  }
});

test("identity check failure after successful OTP retries the saved session, never consumes the OTP twice", async () => {
  jest.mocked(post).mockResolvedValue({ user: { id: 1 }, message: "Đã xác minh" });
  mockComplete.mockRejectedValueOnce(Error("Mất mạng khi xác nhận phiên")).mockResolvedValueOnce(undefined);
  await mount("verify"); await fireEvent.changeText(screen.getByLabelText("Email"), "new@school.edu.vn");
  await fireEvent.changeText(screen.getByLabelText("Mã OTP 6 số"), "123456");
  await fireEvent.press(screen.getByRole("button", { name: "Xác minh OTP" }));
  await screen.findByText("Mất mạng khi xác nhận phiên");
  await fireEvent.press(screen.getByRole("button", { name: "Thử lại" }));
  await screen.findByText("Đã xác minh");
  expect(post).toHaveBeenCalledTimes(1); expect(mockComplete).toHaveBeenCalledTimes(2);
});
