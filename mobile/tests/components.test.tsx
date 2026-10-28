import { render, screen, userEvent } from "@testing-library/react-native";
import { Text } from "react-native";
import { ThemeProvider } from "../src/theme";
import { Button } from "../src/components/UI";
import { ScreenState } from "../src/components/ScreenState";
import { palettes } from "../src/tokens";

test("button exposes label/disabled state, a usable target and dark-theme contrast tokens", async () => {
  const press = jest.fn(), user = userEvent.setup();
  const result = await render(<ThemeProvider initialMode="dark"><Button title="Tiếp tục" onPress={press} disabled /></ThemeProvider>);
  expect(screen.getByRole("button", { name: "Tiếp tục" })).toBeDisabled();
  await user.press(screen.getByRole("button", { name: "Tiếp tục" }));
  expect(press).not.toHaveBeenCalled();
  await result.rerender(<ThemeProvider initialMode="dark"><Button title="Tiếp tục" onPress={press} /></ThemeProvider>);
  expect(screen.getByRole("button", { name: "Tiếp tục" })).toHaveStyle({ minWidth: 44, minHeight: 50, backgroundColor: palettes.dark.green });
  await user.press(screen.getByRole("button", { name: "Tiếp tục" }));
  expect(press).toHaveBeenCalledTimes(1);
});
test("screen handles loading, error with a real retry, empty and content", async () => {
  const retry = jest.fn(), user = userEvent.setup();
  const result = await render(<ThemeProvider><ScreenState loading onRetry={retry} /></ThemeProvider>);
  expect(screen.getByRole("progressbar", { name: "Đang tải dữ liệu" })).toBeOnTheScreen();
  await result.rerender(<ThemeProvider><ScreenState error="Mất kết nối" onRetry={retry} /></ThemeProvider>);
  expect(screen.getByRole("alert")).toHaveTextContent("Mất kết nối");
  await user.press(screen.getByRole("button", { name: "Thử lại" }));
  expect(retry).toHaveBeenCalledTimes(1);
  await result.rerender(<ThemeProvider><ScreenState empty emptyTitle="Chưa có món đồ" onRetry={retry} /></ThemeProvider>);
  expect(screen.getByText("Chưa có món đồ")).toBeOnTheScreen();
  await result.rerender(<ThemeProvider><ScreenState onRetry={retry}><Text>Đã tải món đồ</Text></ScreenState></ThemeProvider>);
  expect(screen.getByText("Đã tải món đồ")).toBeOnTheScreen();
  expect(screen.queryByRole("button", { name: "Thử lại" })).not.toBeOnTheScreen();
});
