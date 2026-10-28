import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme";
export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.green,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.paper,
          borderTopColor: colors.line,
        },
        tabBarLabelStyle: { fontFamily: "Semi", fontSize: 10 },
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Khám phá",
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="grid-outline"
              color={typeof color === "string" ? color : colors.muted}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: "Đã lưu",
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="heart-outline"
              color={typeof color === "string" ? color : colors.muted}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="post"
        options={{
          title: "Đăng tin",
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="add-circle-outline"
              color={typeof color === "string" ? color : colors.muted}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{ title: "Tin nhắn", tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles-outline" color={typeof color === "string" ? color : colors.muted} size={size} /> }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Tài khoản",
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="person-outline"
              color={typeof color === "string" ? color : colors.muted}
              size={size}
            />
          ),
        }}
      />
    </Tabs>
  );
}
