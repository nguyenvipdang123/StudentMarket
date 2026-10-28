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
import { catalogPriceRange, catalogSorts, selectProducts, type CatalogSort } from "../../api/catalog";
import { categories, conditions } from "../../api/types";
import { useCatalogue, useAccountMarket } from "../../providers/Market";
import { OfflineBanner } from "../../components/OfflineBanner";
import { LastUpdated } from "../../components/LastUpdated";
import { ProductCard } from "../../components/ProductCard";
import { SchoolPicker } from "../../components/SchoolPicker";
import { Button, Chips, Empty, Field, Notice } from "../../components/UI";
import { useTheme } from "../../theme";
export default function Explore() {
  const { colors, ui } = useTheme();
  const { products, ready, busy, error, offline, stale, savedAt, refresh } = useCatalogue();
  const { cart } = useAccountMarket();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Tất cả"), [school, setSchool] = useState("");
  const [sort, setSort] = useState<CatalogSort>("featured");
  const [condition, setCondition] = useState(""), [minPrice, setMinPrice] = useState(""), [maxPrice, setMaxPrice] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [visibleLimit, setVisibleLimit] = useState(12);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  // Derived on every render; neither filtered products nor totals are state.
  const filtered = selectProducts(products, { search: query, category, school, sort, condition, minPrice, maxPrice });
  const range = catalogPriceRange(minPrice, maxPrice);
  const sortLabel = catalogSorts.find(option => option.value === sort)!.label;
  const filterCount = Number(!!minPrice.trim() || !!maxPrice.trim()) + Number(!!condition) + Number(!!school) + Number(category !== "Tất cả");
  const items = filtered.slice(0, visibleLimit), total = filtered.length, more = visibleLimit < total;
  const load = refresh;
  function resetFilters() {
    setQuery(""); setCategory("Tất cả"); setSchool(""); setSort("featured");
    setCondition(""); setMinPrice(""); setMaxPrice(""); setVisibleLimit(12);
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
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
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
                sang<Text style={{ color: colors.brand }}>tay.</Text>
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Mở giỏ hàng, ${cart.length} món`}
                onPress={() => router.push("/cart")}
                style={{
                  padding: 10,
                  minHeight: 44,
                  minWidth: 44,
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
                  role="searchbox"
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
                  accessibilityRole="button"
                  accessibilityLabel="Tìm kiếm"
                  onPress={() => setVisibleLimit(12)}
                  style={{ padding: 14, minWidth: 44, minHeight: 44 }}
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
                  accessibilityLabel={c}
                  onPress={() => { setCategory(c); setVisibleLimit(12); }}
                  style={{
                    padding: 12,
                    minHeight: 44,
                    minWidth: 44,
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
                      color: c === category ? colors.onAccent : colors.green,
                    }}
                  >
                    {c}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <View style={{ marginHorizontal: 20, gap: 12 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Bộ lọc sản phẩm"
                accessibilityState={{ expanded: filtersOpen }}
                onPress={() => setFiltersOpen(open => !open)}
                style={[ui.between, { minHeight: 50, padding: 14, borderRadius: 15, backgroundColor: colors.sage }]}
              >
                <View style={ui.row}>
                  <Ionicons name="options-outline" size={20} color={colors.green} />
                  <Text style={ui.label}>Bộ lọc{filterCount ? ` · ${filterCount}` : ""}</Text>
                </View>
                <Ionicons name={filtersOpen ? "chevron-up" : "chevron-down"} size={18} color={colors.green} />
              </Pressable>
              {filtersOpen && <View style={ui.panel}>
                <Text style={ui.heading}>Khoảng giá (đ)</Text>
                <View style={[ui.row, { alignItems: "flex-start" }]}>
                  <View style={{ flex: 1 }}><Field label="Giá từ (đ)" value={minPrice} keyboardType="number-pad" placeholder="Không giới hạn" maxLength={16} onChangeText={value => { setMinPrice(value); setVisibleLimit(12); }} /></View>
                  <View style={{ flex: 1 }}><Field label="Giá đến (đ)" value={maxPrice} keyboardType="number-pad" placeholder="Không giới hạn" maxLength={16} onChangeText={value => { setMaxPrice(value); setVisibleLimit(12); }} /></View>
                </View>
                <Text style={ui.small}>Nhập số không có dấu phân cách, ví dụ 50000. Món tặng và trao đổi được tính là 0đ khi lọc giá.</Text>
                <Text style={ui.label}>Tình trạng món đồ</Text>
                <Chips values={["Mọi tình trạng", ...conditions]} value={condition || "Mọi tình trạng"} onChange={value => { setCondition(value === "Mọi tình trạng" ? "" : value); setVisibleLimit(12); }} />
                <Text style={ui.label}>Sắp xếp</Text>
                <Chips values={catalogSorts.map(option => option.label)} value={sortLabel} onChange={label => { setSort(catalogSorts.find(option => option.label === label)!.value); setVisibleLimit(12); }} />
                <Button title="Xóa bộ lọc" soft onPress={resetFilters} />
              </View>}
              <Notice text={range.error} />
              <Text style={ui.small}>
                {sortLabel}{condition ? ` · ${condition}` : ""}
                {!range.error && (range.min !== null || range.max !== null) ? ` · ${range.min === null ? "0" : range.min.toLocaleString("vi-VN")}đ – ${range.max === null ? "không giới hạn" : `${range.max.toLocaleString("vi-VN")}đ`}` : ""}
              </Text>
            </View>
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
                title={range.error ? "Kiểm tra khoảng giá" : products.length ? "Chưa tìm thấy món phù hợp" : offline || stale ? "Chưa có catalogue lưu trên máy" : "Chưa có món đồ"}
                detail={range.error ? "Chỉnh lại giá từ và giá đến trong Bộ lọc, hoặc xóa bộ lọc để xem lại món đồ." : products.length ? "Thử từ khóa khác hoặc bỏ bớt bộ lọc giá, tình trạng, trường và danh mục." : "Kết nối Internet rồi bấm Thử lại hoặc kéo xuống để tải catalogue. Các chức năng khác vẫn có thể truy cập."}
                action={products.length || filterCount || query ? "Xóa bộ lọc" : "Thử tải catalogue"}
                onPress={products.length || filterCount || query ? resetFilters : () => void load()}
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
