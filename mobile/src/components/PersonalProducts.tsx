import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { useFocusEffect, router } from "expo-router";
import { useSession } from "../providers/Session";
import { request, message } from "../api/client";
import type { Product } from "../api/types";
import { Empty, Notice, Button } from "./UI";
import { ProductCard } from "./ProductCard";
import { ui, colors } from "../theme";
import { LastUpdated } from "./LastUpdated";
export function PersonalProducts() {
  const { user } = useSession();
  return <MyProducts key={user?.pgUserId || user?.id || "guest"} />;
}
function MyProducts() {
  const { user, ready } = useSession();
  const [items, setItems] = useState<Product[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""), [lastUpdatedAt, setLastUpdatedAt] = useState("");
  const generation = useRef(0);
  const load = useCallback(() => {
    const run = ++generation.current;
    if (!user) {
      setItems([]);
      setBusy(false);
      return;
    }
    setBusy(true);
    setError("");
    void request<{ listings: Product[] }>("/api/my-listings")
      .then((result) => {
        if (run === generation.current) {
          setItems(result.listings || []);
          setLastUpdatedAt(new Date().toISOString());
        }
      })
      .catch((e) => {
        if (run === generation.current) setError(message(e));
      })
      .finally(() => {
        if (run === generation.current) setBusy(false);
      });
  }, [user]);
  useFocusEffect(
    useCallback(() => {
      const counter = generation;
      setItems([]);
      load();
      return () => {
        counter.current++;
      };
    }, [load]),
  );
  if (!ready) return <ActivityIndicator color={colors.green} />;
  if (!user)
    return (
      <View style={ui.content}>
        <Empty
          title="Đăng nhập để xem"
          detail="Các món đồ được đồng bộ với tài khoản SangTay của bạn."
          action="Đăng nhập"
          onPress={() => router.push("/login")}
        />
      </View>
    );
  return (
    <FlatList
      data={items}
      numColumns={2}
      keyExtractor={(item) => item.id}
      columnWrapperStyle={{ gap: 12, paddingHorizontal: 20, marginBottom: 14 }}
      renderItem={({ item }) => <ProductCard item={item} />}
      contentContainerStyle={{ paddingBottom: 30 }}
      refreshControl={
        <RefreshControl
          refreshing={busy}
          onRefresh={() => {
            load();
          }}
          tintColor={colors.green}
        />
      }
      ListHeaderComponent={
        <View style={ui.content}>
          <Text style={ui.eyebrow}>
            Mỗi món đồ, một hành trình
          </Text>
          <Text style={ui.title}>Tin của tôi</Text>
          <Text style={ui.small}>
            {items.length} món đồ · Kéo xuống để cập nhật
          </Text>
          <Notice text={error} />
          <LastUpdated value={lastUpdatedAt} busy={busy} />
          {error && (
            <Button
              title="Thử lại"
              soft
              onPress={() => {
                load();
              }}
            />
          )}
        </View>
      }
      ListEmptyComponent={
        !busy && !error ? (
          <View style={{ marginHorizontal: 20 }}>
            <Empty
              title="Chưa có tin đăng"
              detail="Đăng món đồ đầu tiên của bạn để tìm một người chủ mới."
            />
          </View>
        ) : undefined
      }
    />
  );
}
