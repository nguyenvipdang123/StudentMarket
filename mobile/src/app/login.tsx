import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
  Linking,
} from "react-native";
import { router } from "expo-router";
import { API_URL, message, expiredSessionMessage } from "../api/client";
import { useSession } from "../providers/Session";
import { Button, Field, Notice } from "../components/UI";
import { ui, colors } from "../theme";
export default function Login() {
  const { signIn, ready, expired } = useSession();
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit() {
    if (busy || !ready) return;
    if (!email.trim() || !password) {
      setError("Nhập email và mật khẩu của bạn.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await signIn(email.trim(), password);
      setPassword("");
      router.back();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function openWebsite(mode: "register" | "forgot") {
    setError("");
    try {
      await Linking.openURL(`${API_URL}/explore?auth=${mode}`);
    } catch {
      setError("Không mở được trình duyệt. Bạn thử lại nhé.");
    }
  }
  return (
    <KeyboardAvoidingView
      style={ui.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[ui.content, { paddingTop: 35 }]}
      >
        <Text style={ui.eyebrow}>Cộng đồng sinh viên SangTay</Text>
        <Text style={ui.title}>Chào mừng trở lại.</Text>
        <Text style={ui.body}>
          Dùng tài khoản đã đăng ký trên website để lưu món đồ và đăng tin ngay
          trên điện thoại.
        </Text>
        <View style={ui.panel}>
          {expired && <Notice text={expiredSessionMessage} />}
          <Field
            label="Email đã đăng ký"
            editable={ready && !busy}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            maxLength={254}
          />
          <Field
            label="Mật khẩu"
            editable={ready && !busy}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
            maxLength={128}
            onSubmitEditing={() => void submit()}
          />
          <Notice text={error} />
          {!ready && (
            <Text style={ui.small}>Đang khôi phục phiên đăng nhập…</Text>
          )}
          <Button
            title="Đăng nhập"
            loading={busy}
            disabled={!ready}
            onPress={() => void submit()}
          />
          <Button
            title="Quên mật khẩu trên website ↗"
            soft
            disabled={busy}
            onPress={() => void openWebsite("forgot")}
          />
        </View>
        <Text style={[ui.small, { color: colors.green }]}>
          Phiên đăng nhập được lưu an toàn trên thiết bị. Không lưu mật khẩu.
        </Text>
        <Button
          title="Đăng ký tài khoản trên website ↗"
          soft
          disabled={busy}
          onPress={() => void openWebsite("register")}
        />
        <Text style={ui.small}>
          Đăng ký, khôi phục mật khẩu, xác minh email và Google hiện tiếp tục
          trên trình duyệt. Sau khi xác minh, quay lại app để đăng nhập bằng
          email và mật khẩu.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
