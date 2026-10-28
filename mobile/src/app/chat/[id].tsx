import { ActivityIndicator, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSession } from "../../providers/Session";
import { validChatId } from "../../api/chat";
import { ChatRoom } from "../../components/ChatRoom";
import { Empty } from "../../components/UI";
import { useTheme } from "../../theme";

export default function Chat() {
  const { colors, ui } = useTheme();
  const { id = "" } = useLocalSearchParams<{ id: string }>();
  const { user, ready } = useSession();
  if (!ready) return <ActivityIndicator color={colors.green} />;
  if (!user) return <View style={ui.content}><Empty title="Đăng nhập để xem tin nhắn" detail="Cuộc trò chuyện chỉ dành cho hai bên mua bán." action="Đăng nhập" onPress={() => router.push("/login")} /></View>;
  if (!validChatId(id)) return <View style={ui.content}><Empty title="Cuộc trò chuyện không hợp lệ" detail="Mở một cuộc trò chuyện trong Tin nhắn để thử lại." action="Về Tin nhắn" onPress={() => router.replace("/messages")} /></View>;
  return <ChatRoom key={`${user.pgUserId || user.id}:${id}`} id={id} />;
}
