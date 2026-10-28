import { useCallback } from "react";
import { FlatList, RefreshControl, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSession } from "../providers/Session";
import { useAccountMarket, useCatalogue } from "../providers/Market";
import { ProductCard } from "./ProductCard";
import { OfflineBanner } from "./OfflineBanner";
import { Button, Empty, Notice } from "./UI";
import { useTheme } from "../theme";
import { LastUpdated } from "./LastUpdated";
import { PriceAlertSettings } from "./PriceAlertSettings";
import { selectFavorites } from "../state/selectors";
import { ScreenState } from "./ScreenState";
export function SavedProducts() {
  const { colors, ui } = useTheme();
  const { user, ready: sessionReady } = useSession(), { selected: favorites, ready, busy, error, lastUpdatedAt, store } = useAccountMarket(selectFavorites), { offline } = useCatalogue();
  useFocusEffect(useCallback(() => { void store.refresh(offline); }, [store, offline]));
  if (!sessionReady || !ready) return <ScreenState loading onRetry={() => void store.refresh(offline)} />;
  if (!user) return <View style={ui.content}><Empty title="Đăng nhập để xem Đã lưu" detail="Những món yêu thích được lưu riêng theo tài khoản của bạn." action="Đăng nhập" onPress={() => router.push("/login")} /></View>;
  return <FlatList data={favorites} numColumns={2} keyExtractor={p => p.id} renderItem={({ item }) => <ProductCard item={item} />} columnWrapperStyle={{ gap: 12, paddingHorizontal: 20, marginBottom: 14 }} contentContainerStyle={{ paddingBottom: 25 }} refreshControl={<RefreshControl refreshing={busy} onRefresh={() => void store.refresh(offline)} tintColor={colors.green} />} ListHeaderComponent={<View style={ui.content}><Text style={ui.title}>Đã lưu</Text><Text style={ui.small}>{favorites.length} món · Đồng bộ ngay với trái tim ở Khám phá và Chi tiết</Text><LastUpdated value={lastUpdatedAt} busy={busy} /><PriceAlertSettings /><OfflineBanner /><Notice text={error} />{!!error && <Button title="Đồng bộ lại" onPress={() => void store.refresh(offline)} />}</View>} ListEmptyComponent={<View style={{ marginHorizontal: 20 }}><Empty title="Chưa lưu món đồ nào" detail="Bấm trái tim ở Khám phá hoặc trong Chi tiết để lưu món yêu thích." action="Khám phá món đồ" onPress={() => router.push("/")} /></View>} />;
}
