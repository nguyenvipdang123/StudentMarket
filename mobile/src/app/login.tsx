import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { message, expiredSessionMessage } from "../api/client";
import { useSession } from "../providers/Session";
import { Button, Field, Notice } from "../components/UI";
import { useTheme } from "../theme";
import { SessionNotice } from "../components/SessionNotice";
export default function Login() {
  const { colors, ui } = useTheme();
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
        <SessionNotice />
        <Text style={ui.body}>
          Đăng nhập, tạo tài khoản hoặc xác minh email ngay trên điện thoại.
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
          {!!error && <Button title="Thử đăng nhập lại" soft disabled={busy || !ready} onPress={() => void submit()} />}
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
            title="Quên mật khẩu"
            soft
            disabled={busy}
            onPress={() => router.push("/auth/forgot")}
          />
        </View>
        <Text style={[ui.small, { color: colors.green }]}>
          Phiên đăng nhập được lưu an toàn trên thiết bị. Không lưu mật khẩu.
        </Text>
        <Button
          title="Đăng ký tài khoản"
          soft
          disabled={busy}
          onPress={() => router.push("/auth/register")}
        />
        <Button title="Xác minh email / Gửi lại OTP" soft disabled={busy} onPress={() => router.push("/auth/verify")} />
        <Button title="Tiếp tục với Google trường" soft disabled={busy} onPress={() => router.push("/auth/google")} />
        <Text style={ui.small}>
          OTP và mật khẩu chỉ dùng cho yêu cầu hiện tại. Google xác thực qua cửa sổ bảo mật rồi tiếp tục trong app.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
