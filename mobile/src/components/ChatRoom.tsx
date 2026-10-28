import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, RefreshControl, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Stack, router } from "expo-router";
import { useHeaderHeight } from "expo-router/react-navigation";
import { API_URL, ApiError, message, privateChatImageSource } from "../api/client";
import { chatApi } from "../api/chat-client";
import { chatImagePath, chatMessageBody, chatPeer, mergeChatMessages, validChatId, type ChatHistory, type ChatMessage } from "../api/chat";
import { mediaUrl } from "../api/policy";
import { useChatPolling } from "../hooks/useChatPolling";
import { Button, Notice } from "../components/UI";
import { colors, ui } from "../theme";

export function ChatRoom({ id, api = chatApi }: { id: string; api?: Pick<typeof chatApi, "history" | "send"> }) {
  const headerHeight = useHeaderHeight();
  const [data, setData] = useState<ChatHistory | null>(null);
  const [busy, setBusy] = useState(true), [error, setError] = useState(""), [sendError, setSendError] = useState("");
  const [draft, setDraft] = useState(""), [sending, setSending] = useState(false);
  const list = useRef<FlatList<ChatMessage>>(null), nearBottom = useRef(true), pending = useRef(false), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const load = useCallback(async (isCurrent: () => boolean) => {
    try {
      const result = await api.history(id);
      if (result.conversation.id !== id || !chatPeer(result.conversation, result.pgUserId)) throw new ApiError("Không có quyền truy cập cuộc trò chuyện.", 403);
      if (isCurrent()) {
        setData(old => ({ ...result, messages: mergeChatMessages(old?.messages || [], result.messages, id) }));
        setError("");
      }
    } catch (e) {
      if (isCurrent()) {
        setError(message(e));
        if (e instanceof ApiError && [401, 403, 404].includes(e.status)) { setData(null); return false; }
      }
    } finally { if (isCurrent()) setBusy(false); }
  }, [id, api]);
  const refresh = useChatPolling(load, 5000);
  async function send() {
    if (pending.current || !data) return;
    let content: string;
    try { content = chatMessageBody(draft).content; } catch (e) { setSendError(message(e)); return; }
    pending.current = true; setSending(true); setSendError("");
    try {
      const result = await api.send(id, content);
      if (!mounted.current) return;
      nearBottom.current = true;
      setData(old => old ? { ...old, messages: mergeChatMessages(old.messages, [result.message], id) } : old);
      setDraft("");
      refresh();
    } catch (e) {
      if (mounted.current) setSendError(`${message(e)} Bản nháp vẫn được giữ; kiểm tra lịch sử trước khi gửi lại.`);
    } finally { pending.current = false; if (mounted.current) setSending(false); }
  }
  const peer = data ? chatPeer(data.conversation, data.pgUserId) : null;
  if (!data) return <View style={ui.content}>{busy ? <ActivityIndicator color={colors.green} /> : <><Notice text={error} /><Button title="Thử lại" onPress={() => { setBusy(true); refresh(); }} /></>}</View>;
  const conversation = data.conversation;
  return <KeyboardAvoidingView style={ui.screen} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={headerHeight}>
    <Stack.Screen options={{ title: peer?.name || "Trò chuyện" }} />
    <Pressable accessibilityRole="button" accessibilityLabel={`Xem món đồ ${conversation.listingTitle}`} disabled={!validChatId(conversation.listingId || "")} onPress={() => router.push({ pathname: "/listing/[id]", params: { id: conversation.listingId } })} style={[ui.row, { padding: 14, borderBottomWidth: 1, borderColor: colors.line, backgroundColor: colors.paper }]}>
      <Image source={mediaUrl(conversation.listingImage, API_URL)} style={{ width: 48, height: 48, borderRadius: 10, backgroundColor: colors.sage }} />
      <View style={{ flex: 1 }}><Text style={[ui.body, { fontFamily: "Semi" }]} numberOfLines={1}>{conversation.listingTitle}</Text><Text style={ui.small} numberOfLines={1}>{peer?.school}</Text>{conversation.listingStatus === "Sold" && <Text style={ui.small}>Món đồ đã được sang tay</Text>}</View>
      <Ionicons name="chevron-forward" size={18} color={colors.green} />
    </Pressable>
    <Text style={[ui.small, { paddingHorizontal: 16, paddingVertical: 8, fontSize: 10 }]}>Không chia sẻ OTP hoặc chuyển cọc khi chưa xác minh. Tin nhắn tự cập nhật khi mở màn hình.</Text>
    {!!error && <View style={{ paddingHorizontal: 12 }}><Notice text={error} /></View>}
    <FlatList
      ref={list}
      data={data.messages}
      keyExtractor={item => item.id}
      contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1, justifyContent: "flex-end" }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      refreshControl={<RefreshControl refreshing={busy} onRefresh={() => { setBusy(true); refresh(); }} tintColor={colors.green} />}
      onScroll={event => { const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent; nearBottom.current = contentSize.height - layoutMeasurement.height - contentOffset.y < 100; }}
      scrollEventThrottle={100}
      onContentSizeChange={() => { if (nearBottom.current) list.current?.scrollToEnd({ animated: false }); }}
      onLayout={() => { if (nearBottom.current) list.current?.scrollToEnd({ animated: false }); }}
      renderItem={({ item }) => <MessageBubble item={item} actorId={data.pgUserId} conversationId={id} />}
      ListEmptyComponent={<Text style={[ui.body, { textAlign: "center", paddingVertical: 24 }]}>Gửi lời chào và hỏi thêm về món đồ để bắt đầu.</Text>}
    />
    <SafeAreaView edges={["bottom"]} style={{ backgroundColor: colors.paper, borderTopWidth: 1, borderColor: colors.line, padding: 12, gap: 8 }}>
      <Notice text={sendError} />
      <View style={[ui.row, { alignItems: "flex-end" }]}>
        <TextInput accessibilityLabel="Nội dung tin nhắn" placeholder="Nhắn người bán…" placeholderTextColor={colors.muted} value={draft} onChangeText={setDraft} editable={!sending} multiline maxLength={5000} style={[ui.input, { flex: 1, maxHeight: 120, minHeight: 48 }]} />
        <Pressable accessibilityRole="button" accessibilityLabel="Gửi tin nhắn" accessibilityState={{ disabled: sending || !draft.trim(), busy: sending }} disabled={sending || !draft.trim()} onPress={() => void send()} style={{ backgroundColor: colors.green, borderRadius: 15, width: 50, height: 50, justifyContent: "center", alignItems: "center", opacity: sending || !draft.trim() ? 0.5 : 1 }}>
          {sending ? <ActivityIndicator color="white" /> : <Ionicons name="send-outline" size={23} color="white" />}
        </Pressable>
      </View>
      {draft.length > 4500 && <Text style={ui.small}>{draft.length}/5.000 ký tự</Text>}
    </SafeAreaView>
  </KeyboardAvoidingView>;
}
function MessageBubble({ item, actorId, conversationId }: { item: ChatMessage; actorId: string; conversationId: string }) {
  const mine = item.senderId === actorId;
  const path = chatImagePath(item.content, conversationId);
  const [imageError, setImageError] = useState(false);
  const source = path ? privateChatImageSource(item.content, conversationId) : undefined;
  const date = new Date(item.sentAt);
  return <View style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "85%", gap: 4 }}>
    <View style={{ borderRadius: 18, padding: 12, backgroundColor: mine ? colors.green : colors.sage }}>
      {source && !imageError ? <Image source={source} cachePolicy="none" recyclingKey={`${actorId}:${item.id}`} accessibilityLabel="Ảnh đính kèm trong cuộc trò chuyện" contentFit="contain" style={{ width: 210, maxWidth: "100%", height: 170, borderRadius: 10 }} onError={() => setImageError(true)} /> : path ? <Pressable accessibilityRole="button" accessibilityLabel="Tải lại ảnh đính kèm" onPress={() => setImageError(false)}><Text style={[ui.body, { color: mine ? "white" : colors.ink }]}>Ảnh chưa tải được. Chạm để thử lại.</Text></Pressable> : <Text selectable style={[ui.body, { color: mine ? "white" : colors.ink }]}>{item.content}</Text>}
    </View>
    <Text style={[ui.small, { fontSize: 10, textAlign: mine ? "right" : "left" }]}>{Number.isNaN(date.getTime()) ? "" : date.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}{mine ? item.isRead ? " · Đã xem" : " · Đã gửi" : ""}</Text>
  </View>;
}
