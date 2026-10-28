import { useEffect, useRef, useState } from "react";
import { AppState, ScrollView, Text, View } from "react-native";
import * as Crypto from "expo-crypto";
import * as WebBrowser from "expo-web-browser";
import { router } from "expo-router";
import { API_URL, message, post } from "../../api/client";
import { authConfig, claimGoogle } from "../../api/native-auth";
import { readGoogleSecret, removeGoogleSecret, saveGoogleSecret } from "../../api/auth-secrets";
import { googleErrorMessage } from "../../api/auth-policy";
import { useSession } from "../../providers/Session";
import { useTheme } from "../../theme";
import { Button, Notice } from "../../components/UI";

export default function GoogleLogin() {
  const { ui } = useTheme();
  const { completeSignIn } = useSession();
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [info, setInfo] = useState("");
  const [hasFlow, setHasFlow] = useState(false), [authenticated, setAuthenticated] = useState(false);
  const lock = useRef(false), mounted = useRef(true), checking = useRef(false);
  const needsIdentity = useRef(false);
  const checkRef = useRef<() => Promise<void>>(async () => {});
  async function check() {
    if (lock.current || checking.current) return;
    checking.current = true; setBusy(true); setError("");
    try {
      if (needsIdentity.current) {
        await completeSignIn();
        if (mounted.current) { setAuthenticated(true); setHasFlow(false); setInfo("Đã đăng nhập Google trên app."); }
        return;
      }
      const profile = await readGoogleSecret(API_URL, "profile");
      if (!mounted.current) return;
      if (profile) { router.replace("/auth/google-profile"); return; }
      const flow = await readGoogleSecret(API_URL, "flow");
      if (!mounted.current) return;
      if (!flow) { setHasFlow(false); setInfo("Chọn Tiếp tục với Google trường để bắt đầu."); return; }
      setHasFlow(true);
      const result = await claimGoogle();
      if (!mounted.current) return;
      if (result.status === "onboarding") { router.replace("/auth/google-profile"); return; }
      if (result.status === "authenticated") {
        needsIdentity.current = true;
        await completeSignIn();
        if (mounted.current) { setAuthenticated(true); setHasFlow(false); setInfo("Đã đăng nhập Google trên app."); }
      } else setInfo("Chưa nhận được xác nhận từ Google. Hoàn tất trong cửa sổ Google, đóng cửa sổ rồi bấm Kiểm tra kết quả.");
    } catch (e) {
      if (mounted.current) { const reason = message(e); setError(["school_google", "account_status", "email_exists", "google"].includes(reason) ? googleErrorMessage(reason) : reason); }
    } finally { checking.current = false; if (mounted.current) setBusy(false); }
  }
  useEffect(() => { checkRef.current = check; });
  useEffect(() => {
    mounted.current = true;
    void checkRef.current();
    const listener = AppState.addEventListener("change", state => { if (state === "active") void checkRef.current(); });
    return () => { mounted.current = false; listener.remove(); };
  }, []);
  async function start() {
    if (lock.current || checking.current) return;
    lock.current = true; setBusy(true); setError("");
    let opened = false;
    try {
      const config = await authConfig();
      if (!config.googleEnabled) throw Error("Google chưa được cấu hình trên máy chủ.");
      const verifier = Array.from(await Crypto.getRandomBytesAsync(32), byte => byte.toString(16).padStart(2, "0")).join("");
      const challenge = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier);
      if (!mounted.current) return;
      const flow = await post<{ flowId: string; authorizationUrl: string; expiresAt: number }>("/api/auth/mobile/google/start", { challenge });
      if (!mounted.current) return;
      const url = new URL(flow.authorizationUrl);
      if (url.origin !== API_URL || url.pathname !== "/api/auth/mobile/google/authorize" || !/^[A-Za-z0-9_-]{43}$/.test(flow.flowId)) throw Error("Đường dẫn xác thực Google không hợp lệ.");
      await removeGoogleSecret(API_URL, "profile");
      await saveGoogleSecret(API_URL, "flow", { flowId: flow.flowId, verifier, expiresAt: flow.expiresAt });
      if (!mounted.current) return;
      setHasFlow(true); setInfo("Hoàn tất Google rồi đóng cửa sổ để quay lại app. Phiên chờ có hiệu lực 10 phút.");
      opened = true;
      await WebBrowser.openBrowserAsync(url.href, { showTitle: true });
    } catch (e) { if (mounted.current) setError(message(e)); }
    finally { lock.current = false; if (mounted.current) { setBusy(false); if (opened) void checkRef.current(); } }
  }
  return <ScrollView style={ui.screen} contentContainerStyle={ui.content}>
    <Text style={ui.eyebrow}>Tài khoản sinh viên</Text><Text style={ui.title}>Google trường</Text>
    <View style={ui.panel}>
      <Text style={ui.body}>Chỉ chấp nhận Google Workspace của trường thuộc miền .edu hoặc .edu.vn. Google mở cửa sổ xác thực bảo mật; sau đó quay lại app để hoàn tất hồ sơ và lưu phiên.</Text>
      {!!info && <Text style={ui.body} accessibilityLiveRegion="polite">{info}</Text>}
      <Notice text={error} />
      {authenticated ? <Button title="Về Tài khoản" onPress={() => router.replace("/(tabs)/account")} /> : <>
        <Button title={hasFlow ? "Bắt đầu lại với Google" : "Tiếp tục với Google trường"} loading={busy} onPress={() => void start()} />
        {hasFlow && <Button title="Kiểm tra kết quả Google" soft disabled={busy} onPress={() => void check()} />}
        {hasFlow && <Button title="Hủy phiên Google đang chờ" soft disabled={busy} onPress={() => { void Promise.all([removeGoogleSecret(API_URL, "flow"), removeGoogleSecret(API_URL, "profile")]).then(() => { setHasFlow(false); setInfo("Đã hủy phiên Google trên thiết bị."); }).catch(e => setError(message(e))); }} />}
        <Button title="Về đăng nhập" soft disabled={busy} onPress={() => router.replace("/login")} />
      </>}
    </View>
  </ScrollView>;
}
