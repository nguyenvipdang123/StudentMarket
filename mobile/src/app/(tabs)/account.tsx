import { useRef, useState } from "react";
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
type Action = "support" | "logout";
type ActionError = { action: Action; message: string; actor?: string | number };
export default function Account() {
  const { colors, ui, mode, setMode } = useTheme();
  const { user, ready, signOut } = useSession();
  const [failure, setFailure] = useState<ActionError | null>(null),
    [busy, setBusy] = useState<Action | null>(null);
  const pending = useRef(false);
  const actor = user?.pgUserId || user?.id;
  // A previous account's logout failure must never sign out a newly logged-in account.
  const error = failure?.action === "logout" && user && failure.actor !== actor ? null : failure;
  async function run(action: Action) {
    if (pending.current) return;
    pending.current = true; setBusy(action); setFailure(null);
    try {
      if (action === "support") await Linking.openURL(API_URL + "/support");
      else await signOut();
    } catch (e) {
      setFailure({ action, actor, message: action === "support" ? "Chưa mở được trang hỗ trợ. Bấm Thử lại để mở lại trang." : message(e) });
    } finally {
      pending.current = false; setBusy(null);
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
            <Button title="Đăng ký tài khoản" soft onPress={() => router.push("/auth/register")} />
            <Button title="Xác minh email / OTP" soft onPress={() => router.push("/auth/verify")} />
            <Button title="Tiếp tục với Google trường" soft onPress={() => router.push("/auth/google")} />
            <Button title="Quên mật khẩu" soft onPress={() => router.push("/auth/forgot")} />
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
            loading={busy === "support"}
            disabled={busy !== null}
            onPress={() => { void run("support"); }}
          />
          <Button
            title="Tin nhắn"
            soft
            onPress={() => router.push("/messages")}
          />
        </View>
        <Notice text={error?.message || ""} />
        {error && (error.action === "support" || user) && <Button title="Thử lại" loading={busy !== null} onPress={() => { void run(error.action); }} />}
        {error?.action === "logout" && !user && <Button title="Đóng thông báo" soft onPress={() => setFailure(null)} />}
        {user && (
          <Button
            title="Đăng xuất"
            loading={busy === "logout"}
            disabled={busy !== null}
            soft
            onPress={() =>
              Alert.alert("Đăng xuất?", "Kết thúc phiên trên thiết bị này.", [
                { text: "Ở lại", style: "cancel" },
                { text: "Đăng xuất", onPress: () => void run("logout") },
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
