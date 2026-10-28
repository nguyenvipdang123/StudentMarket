import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { API_URL, message, post } from "../api/client";
import { educationEmail, passwordError, profileError, registrationError, validAuthEmail, validOtp, type Registration } from "../api/auth-policy";
import { finishGoogleProfile, registerAccount } from "../api/native-auth";
import { readGoogleSecret } from "../api/auth-secrets";
import { compressPhoto } from "../api/photos";
import type { CompressedPhoto } from "../api/photos-policy";
import { useSession } from "../providers/Session";
import { useTheme } from "../theme";
import { SchoolPicker } from "./SchoolPicker";
import { Button, Field, Notice } from "./UI";
import { useBotChallenge } from "./BotChallenge";
export type NativeAuthMode = "register" | "verify" | "forgot" | "google-profile";
const initial: Registration = { fullName: "", email: "", studentId: "", university: "", password: "", confirmPassword: "" };
export function NativeAuthForm({ mode }: { mode: NativeAuthMode }) {
  const { ui } = useTheme();
  const { completeSignIn } = useSession();
  const [form, setForm] = useState(initial), [card, setCard] = useState<CompressedPhoto | null>(null);
  const [stage, setStage] = useState<"form" | "code" | "done">(mode === "verify" ? "code" : "form");
  const [code, setCode] = useState(""), [error, setError] = useState(""), [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false), [cooldown, setCooldown] = useState(0), [lastAction, setLastAction] = useState<"submit" | "resend" | "photo">("submit");
  const [profileReady, setProfileReady] = useState(mode !== "google-profile");
  const lock = useRef(false), mounted = useRef(true);
  const sessionResult = useRef<string | null>(null);
  const bot = useBotChallenge();
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { if (!cooldown) return; const timer = setInterval(() => setCooldown(n => Math.max(0, n - 1)), 1000); return () => clearInterval(timer); }, [cooldown]);
  async function loadProfile() {
    try {
      const profile = await readGoogleSecret(API_URL, "profile");
      if (!profile) throw Error("Phiên Google đã hết hạn. Hãy đăng nhập Google lại.");
      if (mounted.current) { setError(""); setForm(old => ({ ...old, email: profile.email, fullName: profile.fullName })); setProfileReady(true); }
    } catch (e) { if (mounted.current) setError(message(e)); }
  }
  useEffect(() => {
    if (mode !== "google-profile") return;
    let active = true;
    void readGoogleSecret(API_URL, "profile").then(profile => {
      if (!active) return;
      if (!profile) { setError("Phiên Google đã hết hạn. Hãy đăng nhập Google lại."); return; }
      setForm(old => ({ ...old, email: profile.email, fullName: profile.fullName })); setProfileReady(true);
    }).catch(e => { if (active) setError(message(e)); });
    return () => { active = false; };
  }, [mode]);
  function change(key: keyof Registration, value: string) { if (!lock.current) { setForm(old => ({ ...old, [key]: value })); setError(""); } }
  async function perform(action: "submit" | "resend" | "photo") {
    if (lock.current) return;
    setLastAction(action); setError("");
    if (action !== "photo" && !sessionResult.current) {
      const invalid = mode === "google-profile" ? profileError(form) : !validAuthEmail(form.email) ? "Nhập đúng địa chỉ email." :
        mode === "register" && stage === "form" ? registrationError(form, !!card) :
        action !== "resend" && stage === "code" ? (!validOtp(code) ? "Mã OTP phải gồm đúng 6 chữ số." : mode === "forgot" ? passwordError(form.password, form.confirmPassword) : "") : "";
      if (invalid) { setError(invalid); return; }
    }
    lock.current = true; setBusy(true);
    try {
      if (sessionResult.current) {
        await completeSignIn();
        if (mounted.current) { setCode(""); setForm(initial); setStage("done"); setInfo(sessionResult.current); }
        return;
      }
      if (action === "photo") {
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1, selectionLimit: 1 });
        if (!result.canceled && mounted.current) { const image = await compressPhoto(result.assets[0]); if (mounted.current) setCard(image); }
      } else if (mode === "google-profile") {
        await finishGoogleProfile(form);
        sessionResult.current = "Đã hoàn tất tài khoản Google và đăng nhập trên app.";
        await completeSignIn();
        if (mounted.current) { setForm(initial); setStage("done"); setInfo("Đã hoàn tất tài khoản Google và đăng nhập trên app."); }
      } else if (mode === "register" && stage === "form") {
        const token = await bot.token("register");
        if (!mounted.current) return;
        const result = await registerAccount({ ...form, email: form.email.trim().toLowerCase(), studentId: form.studentId.trim().toUpperCase() }, card, token);
        if (mounted.current) { setForm(old => ({ ...old, password: "", confirmPassword: "" })); setCard(null); setStage("code"); setInfo(result.message); setCooldown(60); }
      } else if (action === "resend" || mode === "forgot" && stage === "form") {
        if (cooldown > 0) throw Error(`Vui lòng chờ ${cooldown} giây trước khi gửi lại mã.`);
        const reset = mode === "forgot";
        const token = await bot.token(reset ? "reset_password" : "resend_verification");
        if (!mounted.current) return;
        const result = await post<{ message: string }>(reset ? "/api/auth/forgot-password" : "/api/auth/resend-verification", { email: form.email.trim().toLowerCase(), turnstileToken: token });
        if (mounted.current) { setStage("code"); setInfo(result.message); setCooldown(60); setCode(""); }
      } else if (mode === "forgot") {
        const result = await post<{ message: string }>("/api/auth/reset-password", { email: form.email.trim().toLowerCase(), code: code.trim(), newPassword: form.password, confirmPassword: form.confirmPassword });
        if (mounted.current) { setForm(initial); setCode(""); setStage("done"); setInfo(result.message); }
      } else {
        const result = await post<{ message: string; user?: unknown }>("/api/auth/verify", { email: form.email.trim().toLowerCase(), code: code.trim() });
        if (result.user) { sessionResult.current = result.message; await completeSignIn(); }
        if (mounted.current) { setCode(""); setStage("done"); setInfo(result.message); }
      }
    } catch (e) { if (mounted.current) setError(message(e)); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }
  const title = mode === "register" ? "Tạo tài khoản sinh viên" : mode === "forgot" ? "Đặt lại mật khẩu" : mode === "verify" ? "Xác minh email" : "Hoàn tất hồ sơ Google";
  return <KeyboardAvoidingView style={ui.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
    {bot.challenge}
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={ui.content}>
      <Text style={ui.eyebrow}>Tài khoản SangTay</Text><Text style={ui.title}>{title}</Text>
      {stage === "done" ? <View style={ui.panel}>
        <Text style={ui.heading}>Đã hoàn tất</Text><Text style={ui.body}>{info}</Text>
        <Button title={mode === "forgot" ? "Đăng nhập bằng mật khẩu mới" : "Về Tài khoản"} onPress={() => router.replace(mode === "forgot" ? "/login" : "/(tabs)/account")} />
      </View> : !profileReady ? <View style={ui.panel}>
        <Notice text={error} />{!error && <Text style={ui.body}>Đang khôi phục hồ sơ Google…</Text>}
        <Button title="Thử tải hồ sơ lại" onPress={() => void loadProfile()} />
        <Button title="Đăng nhập Google lại" soft onPress={() => router.replace("/auth/google")} />
      </View> : <>
        {!!info && <Text style={ui.body} accessibilityLiveRegion="polite">{info}</Text>}
        <View style={ui.panel}>
          <Field label="Email" value={form.email} onChangeText={value => change("email", value)} editable={!busy && mode !== "google-profile" && !(mode === "register" && stage === "code")} autoCapitalize="none" autoComplete="email" keyboardType="email-address" maxLength={254} />
          {(mode === "register" && stage === "form" || mode === "google-profile") && <>
            <Field label="Họ và tên" value={form.fullName} onChangeText={v => change("fullName", v)} editable={!busy} maxLength={100} />
            <Field label="Mã sinh viên" value={form.studentId} onChangeText={v => change("studentId", v)} editable={!busy} maxLength={30} autoCapitalize="characters" />
            <Text style={ui.label}>Trường đại học *</Text>
            <View pointerEvents={busy ? "none" : "auto"}><SchoolPicker value={form.university} onChange={v => change("university", v)} /></View>
          </>}
          {mode === "register" && stage === "form" && <>
            <Text style={ui.small}>{educationEmail(form.email) ? "Email trường: xác minh OTP sẽ tự duyệt tài khoản." : "Email ngoài miền trường: cần ảnh thẻ sinh viên, xác minh OTP rồi chờ Admin duyệt."}</Text>
            {card && <Image source={card.uri} accessibilityLabel="Ảnh thẻ sinh viên đã chọn" style={{ width: "100%", height: 180, borderRadius: 12 }} contentFit="contain" />}
            <Button title={card ? "Chọn lại ảnh thẻ sinh viên" : "Chọn ảnh thẻ sinh viên"} soft disabled={busy} onPress={() => void perform("photo")} />
            {card && <Button title="Bỏ ảnh thẻ sinh viên" soft disabled={busy} onPress={() => setCard(null)} />}
          </>}
          {stage === "code" && <>
            <Text style={ui.small}>Nhập mã 6 số trong email. Mã có hiệu lực 10 phút, chỉ dùng một lần. Kiểm tra cả thư rác.</Text>
            <Field label="Mã OTP 6 số" value={code} onChangeText={v => { setCode(v); setError(""); }} editable={!busy} keyboardType="number-pad" maxLength={6} autoComplete="one-time-code" />
          </>}
          {(mode === "register" && stage === "form" || mode === "forgot" && stage === "code") && <>
            <Field label={mode === "forgot" ? "Mật khẩu mới" : "Mật khẩu đăng ký"} value={form.password} onChangeText={v => change("password", v)} editable={!busy} secureTextEntry autoCapitalize="none" autoComplete="new-password" maxLength={128} />
            <Field label="Xác nhận mật khẩu" value={form.confirmPassword} onChangeText={v => change("confirmPassword", v)} editable={!busy} secureTextEntry autoCapitalize="none" maxLength={128} />
            <Text style={ui.small}>Mật khẩu có 8–128 ký tự, gồm chữ và số. Không lưu mật khẩu/OTP trên thiết bị.</Text>
          </>}
          <Notice text={error} />
          {!!error && <Button title="Thử lại" soft disabled={busy} onPress={() => void perform(lastAction)} />}
          <Button title={mode === "google-profile" ? "Hoàn tất và đăng nhập" : stage === "code" ? mode === "forgot" ? "Đặt mật khẩu mới" : "Xác minh OTP" : mode === "forgot" ? "Gửi mã đặt lại mật khẩu" : "Đăng ký và gửi OTP"} loading={busy} onPress={() => void perform("submit")} />
          {stage === "code" && <Button title={cooldown ? `Gửi lại mã sau ${cooldown}s` : "Gửi lại mã OTP"} soft disabled={busy || cooldown > 0} onPress={() => void perform("resend")} />}
          {mode === "forgot" && stage === "code" && <Button title="Đổi email nhận mã" soft disabled={busy} onPress={() => { setStage("form"); setCode(""); setForm(old => ({ ...old, password: "", confirmPassword: "" })); setInfo(""); setError(""); }} />}
        </View>
        <Button title="Về đăng nhập" soft disabled={busy} onPress={() => router.replace("/login")} />
      </>}
    </ScrollView>
  </KeyboardAvoidingView>;
}
