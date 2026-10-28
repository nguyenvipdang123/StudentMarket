import { Stack, type ErrorBoundaryProps } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { ActivityIndicator, View } from "react-native";
import { SessionProvider } from "../providers/Session";
import { MarketProvider } from "../providers/Market";
import { SessionExpiryRedirect } from "../components/SessionExpiryRedirect";
import { ThemeProvider, useTheme } from "../theme";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../api/query-cache";
import { ScreenState } from "../components/ScreenState";
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return <ThemeProvider><ScreenState error="Màn hình gặp lỗi. Bạn có thể thử tải lại." onRetry={() => { void retry(); }} /></ThemeProvider>;
}
export default function Layout() {
  return <ThemeProvider><QueryClientProvider client={queryClient}><AppLayout /></QueryClientProvider></ThemeProvider>;
}
function AppLayout() {
  const { colors, scheme } = useTheme();
  const [fonts, error] = useFonts({
    Regular: require("../../assets/fonts/plus-jakarta-400.ttf"),
    Semi: require("../../assets/fonts/plus-jakarta-600.ttf"),
    Bold: require("../../assets/fonts/plus-jakarta-700.ttf"),
    Serif: require("../../assets/fonts/dm-serif-display.ttf"),
  });
  if (!fonts && !error)
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.cream,
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color={colors.green} />
      </View>
    );
  return (
    <SessionProvider>
      <MarketProvider>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.cream },
          headerTintColor: colors.green,
          headerTitleStyle: { fontFamily: "Bold", fontSize: 16 },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.cream },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="listing/[id]"
          options={{ title: "Chi tiết món đồ" }}
        />
        <Stack.Screen
          name="login"
          options={{ title: "Tài khoản SangTay", presentation: "modal" }}
        />
        <Stack.Screen name="my-listings" options={{ title: "Tin của tôi" }} />
        <Stack.Screen name="my-listings/[id]/edit" options={{ title: "Sửa tin" }} />
        <Stack.Screen name="my-listings/[id]/sold" options={{ title: "Đánh dấu đã bán", presentation: "modal" }} />
        <Stack.Screen name="contact/[listingId]" options={{ title: "Liên hệ người bán" }} />
        <Stack.Screen name="chat/[id]" options={{ title: "Trò chuyện" }} />
        <Stack.Screen name="cart" options={{ title: "Giỏ hàng" }} />
        <Stack.Screen name="checkout" options={{ title: "Tóm tắt thanh toán" }} />
        <Stack.Screen name="+not-found" options={{ title: "Không tìm thấy" }} />
      </Stack>
      <SessionExpiryRedirect />
      </MarketProvider>
    </SessionProvider>
  );
}
