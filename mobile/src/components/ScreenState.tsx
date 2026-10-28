import type { ReactNode } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Button, Empty, Notice } from "./UI";
import { useTheme } from "../theme";
export function ScreenState({ loading = false, error = "", empty = false, emptyTitle = "Chưa có dữ liệu", emptyDetail = "Kéo để cập nhật hoặc thử lại.", onRetry, children }: {
  loading?: boolean; error?: string; empty?: boolean; emptyTitle?: string; emptyDetail?: string; onRetry: () => void; children?: ReactNode;
}) {
  const { colors, ui } = useTheme();
  if (loading) return <View accessible style={ui.content} accessibilityRole="progressbar" accessibilityLabel="Đang tải dữ liệu"><ActivityIndicator color={colors.green} /><Text style={ui.body}>Đang tải dữ liệu…</Text></View>;
  if (error) return <View style={ui.content}><Notice text={error} /><Button title="Thử lại" onPress={onRetry} /></View>;
  if (empty) return <View style={ui.content}><Empty title={emptyTitle} detail={emptyDetail} action="Tải lại" onPress={onRetry} /></View>;
  return <>{children}</>;
}
