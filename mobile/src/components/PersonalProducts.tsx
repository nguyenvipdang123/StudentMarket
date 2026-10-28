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
export function PersonalProducts({ saved = false }: { saved?: boolean }) {
  const { user, ready } = useSession();
  const [items, setItems] = useState<Product[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
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
    void request<{
      listings?: Product[];
      favorites?: (Product & { productId: string })[];
    }>(saved ? "/api/favorites" : "/api/my-listings")
      .then((result) => {
        if (run === generation.current)
          setItems(
            saved
              ? (result.favorites || []).map((p) => ({
                  ...p,
                  id: p.productId,
                  description: p.description || "",
                }))
              : result.listings || [],
          );
      })
      .catch((e) => {
        if (run === generation.current) setError(message(e));
      })
      .finally(() => {
        if (run === generation.current) setBusy(false);
      });
  }, [saved, user]);
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
            {saved
              ? "Giữ lại những món bạn thích"
              : "Mỗi món đồ, một hành trình"}
          </Text>
          <Text style={ui.title}>{saved ? "Đã lưu" : "Tin của tôi"}</Text>
          <Text style={ui.small}>
            {items.length} món đồ · Kéo xuống để cập nhật
          </Text>
          <Notice text={error} />
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
              title={saved ? "Chưa lưu món đồ nào" : "Chưa có tin đăng"}
              detail={
                saved
                  ? "Mở chi tiết một món đồ rồi bấm Lưu để xem lại tại đây."
                  : "Đăng món đồ đầu tiên của bạn để tìm một người chủ mới."
              }
            />
          </View>
        ) : undefined
      }
    />
  );
}
