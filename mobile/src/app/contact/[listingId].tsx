import { useCallback, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useSession } from "../../providers/Session";
import { chatApi } from "../../api/chat-client";
import { validChatId } from "../../api/chat";
import { message } from "../../api/client";
import { Button, Empty, Notice } from "../../components/UI";
import { useTheme } from "../../theme";

export default function Contact() {
  const { colors, ui } = useTheme();
  const { listingId = "" } = useLocalSearchParams<{ listingId: string }>();
  const { user, ready } = useSession();
  const [attempt, setAttempt] = useState(0);
  if (!ready) return <ActivityIndicator color={colors.green} />;
  if (!user) return <View style={ui.content}><Empty title="Đăng nhập để liên hệ" detail="Sau khi đăng nhập, app sẽ mở cuộc trò chuyện với người bán món đồ này." action="Đăng nhập" onPress={() => router.push("/login")} /></View>;
  if (!validChatId(listingId)) return <View style={ui.content}><Empty title="Không tìm thấy món đồ" detail="Chọn một tin khác trong Khám phá để liên hệ người bán." action="Về Khám phá" onPress={() => router.replace("/")} /></View>;
  return <ContactSeller key={`${user.pgUserId || user.id}:${listingId}:${attempt}`} listingId={listingId} onRetry={() => setAttempt(n => n + 1)} />;
}
function ContactSeller({ listingId, onRetry }: { listingId: string; onRetry: () => void }) {
  const { colors, ui } = useTheme();
  const [error, setError] = useState("");
  useFocusEffect(useCallback(() => {
    let active = true;
    void chatApi.contact(listingId).then(result => {
      if (!validChatId(result.id)) throw Error("Không mở được cuộc trò chuyện.");
      if (active) router.replace({ pathname: "/chat/[id]", params: { id: result.id } });
    }).catch(e => { if (active) setError(message(e)); });
    return () => { active = false; };
  }, [listingId]));
  return <View style={ui.content}>
    <Text style={ui.heading}>{error ? "Chưa mở được cuộc trò chuyện" : "Đang kết nối với người bán…"}</Text>
    {error ? <><Notice text={error} /><Button title="Thử lại" onPress={onRetry} /></> : <ActivityIndicator color={colors.green} />}
  </View>;
}
