import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, Platform, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { API_URL } from "../api/client";
import { authConfig, type BotAction } from "../api/native-auth";
import { useTheme } from "../theme";
import { Button, Notice } from "./UI";

export function useBotChallenge() {
  const [action, setAction] = useState<BotAction | null>(null);
  const resolve = useRef<((token: string) => void) | null>(null);
  const reject = useRef<((error: Error) => void) | null>(null);
  useEffect(() => () => { reject.current?.(Error("Đã đóng màn hình xác minh.")); }, []);
  function finish(token: string | null) {
    if (token) resolve.current?.(token); else reject.current?.(Error("Đã hủy xác minh chống bot."));
    resolve.current = null; reject.current = null; setAction(null);
  }
  async function token(next: BotAction) {
    const config = await authConfig();
    if (!config.turnstileEnabled) return "";
    if (Platform.OS === "web") throw Error("Xác minh này dùng trên Expo Go Android/iOS.");
    return new Promise<string>((yes, no) => { resolve.current = yes; reject.current = no; setAction(next); });
  }
  return { token, challenge: action ? <BotChallenge key={action} action={action} onFinish={finish} /> : null };
}
function BotChallenge({ action, onFinish }: { action: BotAction; onFinish: (token: string | null) => void }) {
  const { colors, ui } = useTheme();
  const insets = useSafeAreaInsets();
  const [error, setError] = useState(""), [attempt, setAttempt] = useState(0), [loaded, setLoaded] = useState(false);
  const source = `${API_URL}/api/auth/mobile/challenge?action=${action}`;
  return <Modal visible animationType="slide" onRequestClose={() => onFinish(null)}>
    <View style={[ui.screen, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16, paddingHorizontal: 20, gap: 12 }]}>
      <Text style={ui.heading}>Xác minh chống bot</Text>
      {!loaded && <ActivityIndicator accessibilityLabel="Đang tải xác minh chống bot" color={colors.green} />}
      <Notice text={error} />
      <WebView key={attempt} source={{ uri: source }} style={{ flex: 1 }} javaScriptEnabled domStorageEnabled sharedCookiesEnabled={false}
        accessibilityLabel="Xác minh Cloudflare Turnstile"
        onLoadEnd={() => setLoaded(true)}
        onError={() => { setLoaded(true); setError("Không tải được xác minh. Kiểm tra kết nối và thử lại."); }}
        onHttpError={() => { setLoaded(true); setError("Máy chủ chưa sẵn sàng xác minh. Hãy thử lại."); }}
        onShouldStartLoadWithRequest={req => {
          if (["about:blank", "about:srcdoc"].includes(req.url)) return true;
          try { const url = new URL(req.url); return url.origin === API_URL || url.origin === "https://challenges.cloudflare.com"; } catch { return false; }
        }}
        onMessage={event => {
          if (event.nativeEvent.url !== source) return;
          try { const data = JSON.parse(event.nativeEvent.data); if (typeof data.token === "string" && data.token.length > 0 && data.token.length <= 2048) onFinish(data.token);
            else setError("Xác minh chưa thành công hoặc đã hết hạn. Hãy thử lại."); } catch { setError("Chưa nhận được kết quả xác minh hợp lệ."); }
        }} />
      <Button title="Tải lại xác minh" soft onPress={() => { setAttempt(n => n + 1); setLoaded(false); setError(""); }} />
      <Button title="Hủy xác minh" soft onPress={() => onFinish(null)} />
    </View>
  </Modal>;
}
