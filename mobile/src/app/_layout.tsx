import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { ActivityIndicator, View } from "react-native";
import { SessionProvider } from "../providers/Session";
import { SessionExpiryRedirect } from "../components/SessionExpiryRedirect";
import { colors } from "../theme";
export default function Layout() {
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
      <StatusBar style="dark" />
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
      </Stack>
      <SessionExpiryRedirect />
    </SessionProvider>
  );
}
