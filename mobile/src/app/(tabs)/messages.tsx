import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useSession } from "../../providers/Session";
import { API_URL, ApiError, message } from "../../api/client";
import { chatApi } from "../../api/chat-client";
import { chatPeer, chatPreview, type ChatInbox } from "../../api/chat";
import { mediaUrl } from "../../api/policy";
import { useChatPolling } from "../../hooks/useChatPolling";
import { Button, Empty, Notice } from "../../components/UI";
import { useTheme } from "../../theme";
import { ScreenState } from "../../components/ScreenState";

export default function Messages() {
  const { colors, ui } = useTheme();
  const { user, ready } = useSession();
  return <SafeAreaView style={ui.screen} edges={["top"]}>
    {!ready ? <ActivityIndicator color={colors.green} /> : !user ? (
      <View style={ui.content}><Text style={ui.title}>Tin nhắn</Text><Empty title="Đăng nhập để nhắn tin" detail="Trao đổi trực tiếp với người mua và người bán ngay trên app." action="Đăng nhập" onPress={() => router.push("/login")} /></View>
    ) : <Inbox key={user.pgUserId || user.id} />}
  </SafeAreaView>;
}
function Inbox() {
  const { colors, ui } = useTheme();
  const [data, setData] = useState<ChatInbox | null>(null);
  const [busy, setBusy] = useState(true), [error, setError] = useState("");
  const load = useCallback(async (isCurrent: () => boolean) => {
    try {
      const result = await chatApi.inbox();
      if (isCurrent()) { setData(result); setError(""); }
    } catch (e) {
      if (isCurrent()) {
        setError(message(e));
        if (e instanceof ApiError && [401, 403, 404].includes(e.status)) { setData(null); return false; }
      }
    } finally { if (isCurrent()) setBusy(false); }
  }, []);
  const refresh = useChatPolling(load, 15000);
  const conversations = data?.conversations.filter(c => chatPeer(c, data.pgUserId)) || [];
  return <FlatList
    data={conversations}
    keyExtractor={item => item.id}
    contentContainerStyle={[ui.content, { flexGrow: 1 }]}
    refreshControl={<RefreshControl refreshing={busy} onRefresh={() => { setBusy(true); refresh(); }} tintColor={colors.green} />}
    ListHeaderComponent={<View style={{ gap: 10, marginBottom: 18 }}><Text style={ui.eyebrow}>Nhắn một câu, thêm kết nối</Text><Text style={ui.title}>Tin nhắn</Text><Text style={ui.small}>Mua bán và trao đổi ngay trên SangTay.</Text><Notice text={error} />{!!error && <Button title="Thử lại" soft onPress={() => { setBusy(true); refresh(); }} />}</View>}
    renderItem={({ item }) => {
      const peer = chatPeer(item, data!.pgUserId)!;
      return <Pressable accessibilityRole="button" accessibilityLabel={`Trò chuyện với ${peer.name} về ${item.listingTitle}${item.unreadCount ? `, ${item.unreadCount} tin chưa đọc` : ""}`} onPress={() => router.push({ pathname: "/chat/[id]", params: { id: item.id } })} style={[ui.panel, ui.row, { marginBottom: 12 }]}>
        <Image source={mediaUrl(item.listingImage, API_URL)} style={{ width: 62, height: 68, borderRadius: 14, backgroundColor: colors.sage }} contentFit="cover" />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[ui.body, { fontFamily: "Bold" }]} numberOfLines={1}>{peer.name}</Text>
          <Text style={[ui.small, { color: colors.green }]} numberOfLines={1}>{item.listingTitle}</Text>
          <Text style={ui.small} numberOfLines={2}>{chatPreview(item.lastMessage)}</Text>
          <Text style={[ui.small, { fontSize: 10 }]}>{peer.buying ? "Bạn đang mua" : "Bạn đang bán"}</Text>
        </View>
        {!!item.unreadCount && <View style={[ui.badge, { backgroundColor: colors.green }]}><Text style={[ui.badgeText, { color: colors.onAccent }]}>{item.unreadCount > 99 ? "99+" : item.unreadCount}</Text></View>}
      </Pressable>;
    }}
    ListEmptyComponent={busy ? <ScreenState loading onRetry={() => refresh()} /> : !error ? <Empty title="Chưa có cuộc trò chuyện" detail="Mở một món đồ rồi bấm Nhắn tin người bán để bắt đầu." action="Khám phá món đồ" onPress={() => router.push("/")} /> : undefined}
  />;
}
