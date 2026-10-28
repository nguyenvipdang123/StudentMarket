import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSession } from "../providers/Session";
import { useAccountMarket, useCatalogue } from "../providers/Market";
import type { Product } from "../api/types";
import { message } from "../api/client";
import { useTheme } from "../theme";
import { selectSaved } from "../state/selectors";
export function FavoriteButton({ item, compact = false }: { item: Product; compact?: boolean }) {
  const { colors, ui } = useTheme();
  const { user } = useSession(), { selected: saved, busy, ready, store } = useAccountMarket(selectSaved(item.id)), { offline } = useCatalogue();
  const [error, setError] = useState("");
  return <View style={compact ? { position: "absolute", top: 7, right: 7, alignItems: "flex-end", maxWidth: "90%" } : undefined}>
    <Pressable accessibilityRole="button" accessibilityLabel={`${saved ? "Bỏ lưu" : "Lưu"} ${item.title}`} accessibilityState={{ selected: saved, disabled: busy || !ready }} disabled={busy || !ready} onPress={event => {
      event.stopPropagation();
      if (!user) { router.push("/login"); return; }
      setError(""); void store.toggle(item, offline).catch(e => setError(message(e)));
    }} style={[ui.row, { minWidth: 44, minHeight: 44, padding: 10, borderRadius: 24, backgroundColor: colors.paper, opacity: busy ? 0.6 : 1 }]}>
      <Ionicons name={saved ? "heart" : "heart-outline"} color={colors.green} size={21} />
      {!compact && <Text style={ui.small}>{saved ? "Đã lưu" : "Lưu"}</Text>}
    </Pressable>
    {!!error && <Text accessibilityRole="alert" style={[ui.small, { color: colors.error, backgroundColor: colors.paper, padding: 5 }]}>{error}</Text>}
  </View>;
}
