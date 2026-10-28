import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { request, message } from "../../api/client";
import { categories, type Catalog, type Product } from "../../api/types";
import { ProductCard } from "../../components/ProductCard";
import { Button, Empty, Notice } from "../../components/UI";
import { colors, ui } from "../../theme";
export default function Explore() {
  const [items, setItems] = useState<Product[]>([]),
    [query, setQuery] = useState(""),
    [search, setSearch] = useState(""),
    [category, setCategory] = useState("Tất cả"),
    [sort, setSort] = useState("featured");
  const [busy, setBusy] = useState(true),
    [error, setError] = useState(""),
    [page, setPage] = useState(1),
    [total, setTotal] = useState(0),
    [more, setMore] = useState(false);
  const generation = useRef(0),
    loadingMore = useRef(false);
  const load = useCallback(async () => {
    const run = ++generation.current;
    setBusy(true);
    setError("");
    loadingMore.current = false;
    try {
      const params = new URLSearchParams({
        q: search,
        category,
        sort,
        page: "1",
      });
      const result = await request<Catalog>("/api/products?" + params);
      if (run !== generation.current) return;
      setItems(result.products);
      setPage(result.pagination.page);
      setMore(result.pagination.hasNext);
      setTotal(result.pagination.total);
    } catch (e) {
      if (run === generation.current) {
        setItems([]);
        setError(message(e));
      }
    } finally {
      if (run === generation.current) setBusy(false);
    }
  }, [search, category, sort]);
  // A new catalogue request must immediately replace the previous loading state.
  useEffect(() => {
    const counter = generation;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    return () => {
      counter.current++;
    };
  }, [load]);
  async function next() {
    if (busy || !more || loadingMore.current) return;
    loadingMore.current = true;
    const run = generation.current;
    setError("");
    try {
      const result = await request<Catalog>(
        "/api/products?" +
          new URLSearchParams({
            q: search,
            category,
            sort,
            page: String(page + 1),
          }),
      );
      if (run === generation.current) {
        setItems((old) => [
          ...old,
          ...result.products.filter(
            (item) => !old.some((p) => p.id === item.id),
          ),
        ]);
        setPage(result.pagination.page);
        setMore(result.pagination.hasNext);
      }
    } catch (e) {
      if (run === generation.current) setError(message(e));
    } finally {
      loadingMore.current = false;
    }
  }
  return (
    <SafeAreaView style={ui.screen} edges={["top"]}>
      <FlatList
        data={items}
        numColumns={2}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ProductCard item={item} />}
        columnWrapperStyle={{
          gap: 12,
          paddingHorizontal: 20,
          marginBottom: 14,
        }}
        contentContainerStyle={{ paddingBottom: 25 }}
        refreshControl={
          <RefreshControl
            refreshing={busy}
            onRefresh={() => void load()}
            tintColor={colors.green}
          />
        }
        ListHeaderComponent={
          <View style={{ gap: 20, paddingBottom: 18 }}>
            <View
              style={[ui.between, { paddingHorizontal: 22, paddingTop: 12 }]}
            >
              <Text
                style={{ fontFamily: "Bold", fontSize: 25, color: colors.dark }}
              >
                sang<Text style={{ color: "#D5935B" }}>tay.</Text>
              </Text>
              <Pressable
                accessibilityLabel="Mở tài khoản"
                onPress={() => router.push("/account")}
                style={{
                  padding: 10,
                  borderRadius: 16,
                  backgroundColor: colors.sage,
                }}
              >
                <Ionicons
                  name="person-outline"
                  size={21}
                  color={colors.green}
                />
              </Pressable>
            </View>
            <View
              style={{
                marginHorizontal: 20,
                padding: 22,
                borderRadius: 26,
                backgroundColor: colors.sage,
                gap: 9,
              }}
            >
              <Text style={ui.eyebrow}>Cũ với bạn · Mới với ai đó</Text>
              <Text style={[ui.title, { fontSize: 35, lineHeight: 43 }]}>
                Đồ cũ còn tốt.{"\n"}Chủ mới thật vui.
              </Text>
              <Text style={ui.small}>
                Mua bán, trao đổi cùng sinh viên.{"\n"}Tiết kiệm hơn, kết nối
                gần hơn.
              </Text>
              <View
                style={[
                  ui.row,
                  {
                    backgroundColor: colors.paper,
                    borderRadius: 15,
                    paddingLeft: 12,
                    marginTop: 10,
                  },
                ]}
              >
                <Ionicons
                  name="search-outline"
                  size={20}
                  color={colors.green}
                />
                <TextInput
                  accessibilityLabel="Tìm kiếm món đồ"
                  placeholder="Bạn đang tìm món gì?"
                  placeholderTextColor={colors.muted}
                  value={query}
                  onChangeText={setQuery}
                  onSubmitEditing={() => setSearch(query.trim())}
                  returnKeyType="search"
                  style={{
                    flex: 1,
                    padding: 13,
                    fontFamily: "Regular",
                    color: colors.ink,
                  }}
                />
                <Pressable
                  accessibilityLabel="Tìm kiếm"
                  onPress={() => setSearch(query.trim())}
                  style={{ padding: 14 }}
                >
                  <Ionicons
                    name="arrow-forward"
                    size={20}
                    color={colors.green}
                  />
                </Pressable>
              </View>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
            >
              {categories.map((c) => (
                <Pressable
                  key={c}
                  accessibilityRole="button"
                  accessibilityState={{ selected: c === category }}
                  onPress={() => setCategory(c)}
                  style={{
                    padding: 12,
                    borderRadius: 13,
                    backgroundColor:
                      c === category ? colors.green : colors.paper,
                    borderWidth: 1,
                    borderColor: colors.line,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Semi",
                      fontSize: 12,
                      color: c === category ? "white" : colors.green,
                    }}
                  >
                    {c}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <View style={[ui.between, { paddingHorizontal: 20 }]}>
              <View>
                <Text style={ui.heading}>
                  {search ? `Kết quả “${search}”` : "Khám phá món hay"}
                </Text>
                <Text style={ui.small}>
                  {busy
                    ? "Đang tìm món đồ…"
                    : `${total} món đồ · Tất cả trường`}
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Đổi sắp xếp sản phẩm"
                onPress={() =>
                  setSort((s) =>
                    s === "featured"
                      ? "price-asc"
                      : s === "price-asc"
                        ? "newest"
                        : "featured",
                  )
                }
                style={{ padding: 10 }}
              >
                <Ionicons name="swap-vertical" size={18} color={colors.green} />
                <Text style={[ui.small, { fontSize: 10 }]}>
                  {sort === "featured"
                    ? "Nổi bật"
                    : sort === "price-asc"
                      ? "Giá tăng"
                      : "Mới nhất"}
                </Text>
              </Pressable>
            </View>
            {error && (
              <View style={{ paddingHorizontal: 20 }}>
                <Notice text={error} />
                <Button title="Thử lại" soft onPress={() => void load()} />
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          !busy && !error ? (
            <View style={{ marginHorizontal: 20 }}>
              <Empty
                title="Chưa tìm thấy món phù hợp"
                detail="Thử tên món đồ khác hoặc chọn Tất cả."
              />
            </View>
          ) : busy ? (
            <ActivityIndicator color={colors.green} />
          ) : undefined
        }
        ListFooterComponent={
          more && !busy ? (
            <View style={{ marginHorizontal: 20 }}>
              <Button
                title="Xem thêm món đồ"
                soft
                onPress={() => void next()}
              />
            </View>
          ) : undefined
        }
      />
    </SafeAreaView>
  );
}
