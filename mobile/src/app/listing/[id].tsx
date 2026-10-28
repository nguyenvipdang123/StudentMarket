import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Image } from "expo-image";
import { FavoriteButton } from "../../components/FavoriteButton";
import { OfflineBanner } from "../../components/OfflineBanner";
import { useAccountMarket, useCatalogue } from "../../providers/Market";
import { availability } from "../../state/commerce";
import { SafeAreaView } from "react-native-safe-area-context";
import { API_URL, message, request } from "../../api/client";
import type { Product } from "../../api/types";
import { mediaUrl, priceLabel } from "../../api/policy";
import { useSession } from "../../providers/Session";
import { Button, Notice } from "../../components/UI";
import { colors, ui } from "../../theme";
import { listingView, listingStatus } from "../../state/listing-view";
import { LastUpdated } from "../../components/LastUpdated";
export default function Detail() {
  const { user } = useSession();
  return <DetailContent key={user?.pgUserId || user?.id || "guest"} />;
}
function DetailContent() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    { width } = useWindowDimensions(),
    { user } = useSession();
  const [fetchedItem, setItem] = useState<Product | null>(null),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0), [lastUpdatedAt, setLastUpdatedAt] = useState("");
  // Reset the displayed item while synchronizing a new route with the remote API.
  useEffect(() => {
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBusy(true);
    setError("");
    void request<{ product: Product }>(
      "/api/products/" + encodeURIComponent(id || ""),
    )
      .then((r) => {
        if (alive) { setItem(r.product); setLastUpdatedAt(new Date().toISOString()); }
      })
      .catch((e) => {
        if (alive) setError(message(e));
      })
      .finally(() => {
        if (alive) setBusy(false);
      });
    return () => {
      alive = false;
    };
  }, [id, retry]);
  const { products, offline } = useCatalogue();
  const { favorites, cart, store } = useAccountMarket();
  const cached = products.find(p => p.id === id) || favorites.find(p => p.id === id) || cart.find(p => p.id === id);
  const item = fetchedItem?.id === id ? fetchedItem : cached;
  const [adding, setAdding] = useState(false);
  async function addToCart() {
    if (!user) { router.push("/login"); return; }
    if (offline) { setError("Kết nối mạng để kiểm tra tình trạng món đồ trước khi thêm vào giỏ."); return; }
    setAdding(true); setError("");
    try {
      const result = await request<{ product: Product }>("/api/products/" + encodeURIComponent(id));
      await store.add(result.product); setItem(result.product);
      router.push("/cart");
    } catch (e) { setError(message(e)); } finally { setAdding(false); }
  }
  if (busy && !item)
    return (
      <View style={[ui.screen, { justifyContent: "center" }]}>
        <ActivityIndicator color={colors.green} />
      </View>
    );
  if (!item)
    return (
      <View style={ui.content}>
        <Notice text={error} />
        <Button title="Thử lại" onPress={() => setRetry((r) => r + 1)} />
      </View>
    );
  const images = item.images?.length ? item.images : [item.image];
  const own = listingView(item, user) === "seller";
  return (
    <View style={ui.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: 20 }} refreshControl={<RefreshControl refreshing={busy} onRefresh={() => setRetry(n => n + 1)} tintColor={colors.green} />}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
        >
          {images.map((image, i) => (
            <View key={image + i}>
              <Image
                source={mediaUrl(image, API_URL)}
                style={{
                  width,
                  height: width * 0.85,
                  backgroundColor: colors.sage,
                }}
                contentFit="cover"
                accessibilityLabel={`${item.title}, ảnh ${i + 1}`}
              />
              <Text
                style={[
                  ui.badgeText,
                  {
                    position: "absolute",
                    bottom: 14,
                    right: 16,
                    backgroundColor: colors.paper,
                    padding: 7,
                    borderRadius: 10,
                  },
                ]}
              >
                {i + 1} / {images.length}
              </Text>
            </View>
          ))}
        </ScrollView>
        <View style={ui.content}>
          <OfflineBanner />
          <LastUpdated value={fetchedItem?.id === id ? lastUpdatedAt : ""} busy={busy} />
          <View style={ui.badge}><Text style={ui.badgeText}>{own ? "Góc người bán · Tin của bạn" : "Góc người mua"}</Text></View>
          <View style={ui.between}>
            <View style={ui.badge}>
              <Text style={ui.badgeText}>{item.condition}</Text>
            </View>
            {!own && <FavoriteButton item={item} />}
          </View>
          <Text style={ui.title}>{item.title}</Text>
          <Text
            style={{ fontFamily: "Bold", fontSize: 28, color: colors.green }}
          >
            {priceLabel(item.price, item.description, item.freeGift)}
          </Text>
          <Text style={ui.small}>
            {item.school} · {item.location}
          </Text>
          <View style={ui.panel}>
            <Text style={ui.heading}>Một chút về món đồ</Text>
            <Text style={ui.body}>{item.description}</Text>
          </View>
          <View style={ui.panel}>
            <Text style={ui.eyebrow}>{own ? "Bạn là người đăng tin này" : "Người sang tay"}</Text>
            <Text style={ui.heading}>{item.seller}</Text>
            <Text style={ui.small}>{item.school}</Text>
          </View>
          {own && <View style={[ui.panel, { backgroundColor: colors.sage }]}>
            <Text style={ui.heading}>Hiệu quả & trạng thái tin</Text>
            <Text style={ui.body}>{listingStatus(item)}</Text>
            <Text style={ui.body}>{item.views ?? 0} lượt xem · {item.likes ?? 0} lượt lưu · {item.chats ?? 0} cuộc trò chuyện</Text>
            {!!item.rejectionReason && <Notice text={item.rejectionReason} />}
            <Text style={ui.small}>Bạn đang xem tin của mình. Người mua sẽ thấy các nút lưu, thêm giỏ và liên hệ.</Text>
          </View>}
          <View style={[ui.panel, { backgroundColor: colors.sage }]}>
            <Text style={ui.body}>
              Hẹn ở nơi công cộng, xem kỹ món đồ trước khi thanh toán. Không
              chia sẻ OTP hoặc chuyển cọc khi chưa xác minh.
            </Text>
          </View>
          <Notice text={error} />
          {!own && !!availability(item, user?.pgUserId) && <Notice text={availability(item, user?.pgUserId)} />}
        </View>
      </ScrollView>
      <SafeAreaView
        edges={["bottom"]}
        style={{
          backgroundColor: colors.paper,
          borderTopWidth: 1,
          borderColor: colors.line,
          padding: 14,
          gap: 8,
        }}
      >
        {own ? <Button title="Xem tin của tôi" onPress={() => router.push("/my-listings")} /> : <Button title={cart.some(p => p.id === id) ? "Xem giỏ hàng" : "Thêm vào giỏ · Số lượng 1"} loading={adding} disabled={!cart.some(p => p.id === id) && !!availability(item, user?.pgUserId)} onPress={() => cart.some(p => p.id === id) ? router.push("/cart") : void addToCart()} />}
        <Button
          soft
          title={
            own ? "Xem tin nhắn của tôi" : item.status !== "Active"
              ? "Món đồ đã được sang tay"
              : "Nhắn tin người bán"
          }
          disabled={!own && item.status !== "Active"}
          onPress={() =>
            own ? router.push("/messages") : router.push({ pathname: "/contact/[listingId]", params: { listingId: id } })
          }
        />
      </SafeAreaView>
    </View>
  );
}
