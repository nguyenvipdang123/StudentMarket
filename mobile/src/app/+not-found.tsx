import { router } from "expo-router";
import { View } from "react-native";
import { Empty } from "../components/UI";
import { useTheme } from "../theme";
export default function NotFound() {
  const { ui } = useTheme();
  return <View style={[ui.screen, ui.content]}><Empty title="Không tìm thấy màn hình" detail="Đường dẫn không tồn tại hoặc đã thay đổi. Bạn có thể quay lại Khám phá." action="Về Khám phá" onPress={() => router.replace("/")} /></View>;
}
