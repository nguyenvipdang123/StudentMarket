import { ActivityIndicator, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSession } from "../../providers/Session";
import { validChatId } from "../../api/chat";
import { ChatRoom } from "../../components/ChatRoom";
import { Empty, Notice } from "../../components/UI";
import { colors, ui } from "../../theme";

export default function Chat() {
  const { id = "" } = useLocalSearchParams<{ id: string }>();
  const { user, ready } = useSession();
  if (!ready) return <ActivityIndicator color={colors.green} />;
  if (!user) return <View style={ui.content}><Empty title="Đăng nhập để xem tin nhắn" detail="Cuộc trò chuyện chỉ dành cho hai bên mua bán." action="Đăng nhập" onPress={() => router.push("/login")} /></View>;
  if (!validChatId(id)) return <View style={ui.content}><Notice text="Cuộc trò chuyện không hợp lệ." /></View>;
  return <ChatRoom key={`${user.pgUserId || user.id}:${id}`} id={id} />;
}
