import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSession } from "../../providers/Session";
import { API_URL, message } from "../../api/client";
import { Button, Chips, Notice } from "../../components/UI";
import { useTheme } from "../../theme";
import appConfig from "../../../app.json";
import { SessionNotice } from "../../components/SessionNotice";
export default function Account() {
  const { colors, ui, mode, setMode } = useTheme();
  const { user, ready, signOut, refresh } = useSession();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function logout() {
    setBusy(true);
    try {
      await signOut();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <SafeAreaView style={ui.screen} edges={["top"]}>
      <ScrollView contentContainerStyle={ui.content}>
        <Text style={ui.eyebrow}>Góc nhỏ của bạn</Text>
        <Text style={ui.title}>Tài khoản</Text>
        <SessionNotice />
        <View style={ui.panel}>
          <Text style={ui.heading}>Giao diện</Text>
          <Chips values={["Theo thiết bị", "Sáng", "Tối"]} value={mode === "system" ? "Theo thiết bị" : mode === "light" ? "Sáng" : "Tối"} onChange={value => setMode(value === "Sáng" ? "light" : value === "Tối" ? "dark" : "system")} />
        </View>
        {!ready ? (
          <ActivityIndicator color={colors.green} />
        ) : user ? (
          <View style={ui.panel}>
            <View style={ui.row}>
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 20,
                  backgroundColor: colors.sage,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Text style={[ui.heading, { fontSize: 24 }]}>
                  {user.fullName.charAt(0)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={ui.heading}>{user.fullName}</Text>
                <Text style={ui.small}>{user.email}</Text>
              </View>
            </View>
            <Text style={ui.body}>{user.university}</Text>
            <View style={ui.badge}>
              <Text style={ui.badgeText}>
                {user.role === "student"
                  ? "Sinh viên đã xác minh"
                  : user.role === "admin"
                    ? "Quản trị viên"
                    : "Nhân viên"}
              </Text>
            </View>
          </View>
        ) : (
          <View style={[ui.panel, { gap: 16 }]}>
            <Ionicons
              name="person-circle-outline"
              size={50}
              color={colors.green}
            />
            <Text style={ui.heading}>Sang tay, thêm kết nối.</Text>
            <Text style={ui.body}>
              Đăng nhập để lưu món yêu thích, đăng tin và quản lý các món đồ của
              bạn.
            </Text>
            <Button title="Đăng nhập" onPress={() => router.push("/login")} />
          </View>
        )}
        <View style={ui.panel}>
          <Button title="Giỏ hàng" soft onPress={() => router.push("/cart")} />
          <Button
            title="Tin của tôi"
            soft
            onPress={() => router.push("/my-listings")}
          />
          <Button
            title="Món đồ đã lưu"
            soft
            onPress={() => router.push("/saved")}
          />
          <Button
            title="Trung tâm hỗ trợ trên website ↗"
            soft
            onPress={() => { void Linking.openURL(API_URL + "/support").catch(() => setError("Chưa mở được trang hỗ trợ. Bấm lại nút để thử.")); }}
          />
          <Button
            title="Tin nhắn"
            soft
            onPress={() => router.push("/messages")}
          />
        </View>
        <Notice text={error} />
        {!!error && <Button title="Thử lại" onPress={() => { setError(""); void refresh(); }} />}
        {user && (
          <Button
            title="Đăng xuất"
            loading={busy}
            soft
            onPress={() =>
              Alert.alert("Đăng xuất?", "Kết thúc phiên trên thiết bị này.", [
                { text: "Ở lại", style: "cancel" },
                { text: "Đăng xuất", onPress: () => void logout() },
              ])
            }
          />
        )}
        <Text style={[ui.small, { textAlign: "center" }]}>
          SangTay Mobile · Phiên bản {appConfig.expo.version}{"\n"}Trao đồ cũ, gửi niềm vui.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
