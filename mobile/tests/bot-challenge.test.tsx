import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { useState } from "react";
import { Text } from "react-native";
import { useBotChallenge } from "../src/components/BotChallenge";
import { Button } from "../src/components/UI";
import { ThemeProvider } from "../src/theme";
import { authConfig } from "../src/api/native-auth";
jest.mock("../src/api/native-auth", () => ({ authConfig: jest.fn() }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
type WebProps = { onMessage: (event: { nativeEvent: { url: string; data: string } }) => void };
let mockWeb: WebProps;
jest.mock("react-native-webview", () => ({ WebView: (props: WebProps) => { mockWeb = props; return null; } }));
function Fixture() {
  const bot = useBotChallenge(); const [result, setResult] = useState("");
  return <>{bot.challenge}<Button title="Gửi OTP kiểm thử" onPress={() => { void bot.token("reset_password").then(token => setResult(token || "disabled")).catch(e => setResult(e.message)); }} /><Text>{result}</Text></>;
}
test("Turnstile stays inside the app, accepts only the trusted page message, supports cancellation and fresh retry", async () => {
  jest.mocked(authConfig).mockResolvedValue({ version: 1, turnstileEnabled: true, googleEnabled: false });
  await render(<ThemeProvider><Fixture /></ThemeProvider>);
  await fireEvent.press(screen.getByRole("button", { name: "Gửi OTP kiểm thử" }));
  await screen.findByText("Xác minh chống bot");
  await act(async () => { mockWeb.onMessage({ nativeEvent: { url: "https://evil.invalid/", data: JSON.stringify({ token: "forged" }) } }); });
  expect(screen.queryByText("forged")).not.toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "Hủy xác minh" }));
  await screen.findByText("Đã hủy xác minh chống bot.");
  await fireEvent.press(screen.getByRole("button", { name: "Gửi OTP kiểm thử" }));
  await screen.findByText("Xác minh chống bot");
  await act(async () => { mockWeb.onMessage({ nativeEvent: { url: "https://sangtay.shop/api/auth/mobile/challenge?action=reset_password", data: JSON.stringify({ token: "valid-single-use-token" }) } }); });
  await screen.findByText("valid-single-use-token");
  expect(screen.queryByRole("button", { name: "Hủy xác minh" })).not.toBeOnTheScreen();
});
