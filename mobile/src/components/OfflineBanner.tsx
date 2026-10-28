import { Text, View } from "react-native";
import { useCatalogue } from "../providers/Market";
import { colors, ui } from "../theme";
export function OfflineBanner() {
  const { offline, stale, savedAt } = useCatalogue();
  if (!offline && !stale) return null;
  return <View accessibilityRole="alert" style={{ backgroundColor: colors.sage, padding: 12, borderRadius: 12, gap: 4 }}>
    <Text style={[ui.body, { fontFamily: "Bold" }]}>{offline ? "Bạn đang offline" : "Đang xem catalogue đã lưu"}</Text>
    <Text style={ui.small}>{savedAt ? `Bản tải thành công gần nhất: ${new Date(savedAt).toLocaleString("vi-VN")}. Giá và tình trạng cần kiểm tra lại khi có mạng.` : "Chưa có catalogue lưu trên máy. Kết nối Internet và bấm Thử lại để tải lần đầu."}</Text>
  </View>;
}
