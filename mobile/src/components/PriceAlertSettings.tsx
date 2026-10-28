import { Text, View } from "react-native";
import { usePriceAlerts } from "../providers/Market";
import { Button, Notice } from "./UI";
import { ui } from "../theme";
export function PriceAlertSettings() {
  const { enabled, ready, busy, error, supported, store } = usePriceAlerts();
  return <View style={ui.panel}>
    <Text style={ui.heading}>Báo khi món đã lưu đổi giá</Text>
    <Text style={ui.small}>{enabled ? "Đang bật" : "Đang tắt"} · App kiểm tra khi đang mở, quay lại hoặc kéo làm mới. Không theo dõi khi app đã đóng.</Text>
    {!supported && <Text style={ui.small}>Thông báo hệ thống cần Expo Go Android/iOS. Bản web chỉ hiển thị giá cập nhật.</Text>}
    <Button title={enabled ? "Tắt thông báo đổi giá" : "Bật thông báo đổi giá"} soft loading={busy} disabled={!ready || !supported} onPress={() => void store.setEnabled(!enabled)} />
    <Notice text={error} />
  </View>;
}
