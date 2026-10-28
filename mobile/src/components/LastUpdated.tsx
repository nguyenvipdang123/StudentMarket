import { Text } from "react-native";
import { useTheme } from "../theme";
export function LastUpdated({ value, busy = false }: { value: string; busy?: boolean }) {
  const { ui } = useTheme();
  const date = new Date(value);
  const valid = value && !Number.isNaN(date.getTime());
  return <Text accessibilityLiveRegion="polite" style={ui.small}>{busy ? "Đang làm mới… · " : "Kéo xuống để làm mới · "}{valid ? `Cập nhật thành công: ${date.toLocaleString("vi-VN")}` : "Chưa cập nhật thành công"}</Text>;
}
