import { View } from "react-native";
import { useSession } from "../providers/Session";
import { useTheme } from "../theme";
import { Button, Notice } from "./UI";
export function SessionNotice() {
  const { error, refresh } = useSession(), { ui } = useTheme();
  if (!error) return null;
  return <View style={ui.panel}><Notice text={error} /><Button title="Thử khôi phục phiên" onPress={() => void refresh()} /></View>;
}
