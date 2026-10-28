import { useCallback, useState } from "react";
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
import { router, useFocusEffect } from "expo-router";
import { selectProducts } from "../../api/catalog";
import { categories } from "../../api/types";
import { useCatalogue, useAccountMarket } from "../../providers/Market";
import { OfflineBanner } from "../../components/OfflineBanner";
import { LastUpdated } from "../../components/LastUpdated";
import { ProductCard } from "../../components/ProductCard";
import { SchoolPicker } from "../../components/SchoolPicker";
import { Button, Empty, Notice } from "../../components/UI";
import { colors, ui } from "../../theme";
export default function Explore() {
  const { products, ready, busy, error, offline, stale, savedAt, refresh } = useCatalogue();
  const { cart } = useAccountMarket();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Tất cả"), [school, setSchool] = useState(""), [sort, setSort] = useState("featured");
  const [visibleLimit, setVisibleLimit] = useState(12);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  // Derived on every render; neither filtered products nor totals are state.
  const filtered = selectProducts(products, { search: query, category, school, sort });
  const items = filtered.slice(0, visibleLimit), total = filtered.length, more = visibleLimit < total;
  const load = refresh;
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
                accessibilityLabel={`Mở giỏ hàng, ${cart.length} món`}
                onPress={() => router.push("/cart")}
                style={{
                  padding: 10,
                  borderRadius: 16,
                  backgroundColor: colors.sage,
                }}
              >
                <Ionicons
                  name="cart-outline"
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
                  onChangeText={text => { setQuery(text); setVisibleLimit(12); }}
                  onSubmitEditing={() => setVisibleLimit(12)}
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
                  onPress={() => setVisibleLimit(12)}
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
            <View style={{ marginHorizontal: 20 }}><OfflineBanner /></View>
            <View style={{ marginHorizontal: 20 }}><LastUpdated value={savedAt} busy={busy} /></View>
            <SchoolPicker value={school} onChange={value => { setSchool(value); setVisibleLimit(12); }} />
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
                  onPress={() => { setCategory(c); setVisibleLimit(12); }}
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
              <View style={{ flex: 1 }}>
                <Text style={ui.heading}>
                  {query ? `Kết quả “${query}”` : "Khám phá món hay"}
                </Text>
                <Text style={ui.small} numberOfLines={2}>
                  {busy
                    ? "Đang tìm món đồ…"
                    : `${total} món đồ · ${school || "Tất cả trường"}`}
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
            {!!error && (
              <View style={{ paddingHorizontal: 20 }}>
                <Notice text={error} />
                <Button title="Thử lại" soft onPress={() => void load()} />
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          ready && !busy ? (
            <View style={{ marginHorizontal: 20 }}>
              <Empty
                title={products.length ? "Chưa tìm thấy món phù hợp" : offline || stale ? "Chưa có catalogue lưu trên máy" : "Chưa có món đồ"}
                detail={products.length ? "Thử tên món đồ khác, đổi trường hoặc chọn Tất cả." : "Kết nối Internet rồi bấm Thử lại hoặc kéo xuống để tải catalogue. Các chức năng khác vẫn có thể truy cập."}
                action={school ? "Xem tất cả trường" : undefined}
                onPress={() => setSchool("")}
              />
            </View>
          ) : busy || !ready ? (
            <ActivityIndicator color={colors.green} />
          ) : undefined
        }
        ListFooterComponent={
          more && !busy ? (
            <View style={{ marginHorizontal: 20 }}>
              <Button
                title="Xem thêm món đồ"
                soft
                onPress={() => setVisibleLimit(n => n + 12)}
              />
            </View>
          ) : undefined
        }
      />
    </SafeAreaView>
  );
}
