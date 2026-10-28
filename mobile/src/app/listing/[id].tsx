import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { API_URL, message, post, request } from "../../api/client";
import type { Product } from "../../api/types";
import { mediaUrl, priceLabel } from "../../api/policy";
import { useSession } from "../../providers/Session";
import { Button, Notice } from "../../components/UI";
import { colors, ui } from "../../theme";
export default function Detail() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    { width } = useWindowDimensions(),
    { user } = useSession();
  const [item, setItem] = useState<Product | null>(null),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false),
    [saving, setSaving] = useState(false),
    [retry, setRetry] = useState(0);
  // Reset the displayed item while synchronizing a new route with the remote API.
  useEffect(() => {
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBusy(true);
    setItem(null);
    setError("");
    void request<{ product: Product }>(
      "/api/products/" + encodeURIComponent(id || ""),
    )
      .then((r) => {
        if (alive) setItem(r.product);
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
  // Saved status belongs to both the current account and listing, never the old one.
  useEffect(() => {
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaved(false);
    if (user)
      void request<{ favorites: { productId: string }[] }>("/api/favorites")
        .then((r) => {
          if (alive) setSaved(r.favorites.some((p) => p.productId === id));
        })
        .catch(() => {});
    return () => {
      alive = false;
    };
  }, [user, id]);
  async function toggle() {
    if (!user) {
      router.push("/login");
      return;
    }
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const r = await post<{ isSaved: boolean }>("/api/favorites", {
        productId: id,
      });
      setSaved(r.isSaved);
    } catch (e) {
      setError(message(e));
    } finally {
      setSaving(false);
    }
  }
  if (busy)
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
  const own = Boolean(user?.pgUserId && user.pgUserId === item.sellerId);
  return (
    <View style={ui.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
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
          <View style={ui.between}>
            <View style={ui.badge}>
              <Text style={ui.badgeText}>{item.condition}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={saved ? "Bỏ lưu món đồ" : "Lưu món đồ"}
              accessibilityState={{ selected: saved, disabled: saving }}
              disabled={saving}
              onPress={() => void toggle()}
              style={ui.row}
            >
              <Ionicons
                name={saved ? "heart" : "heart-outline"}
                size={24}
                color={colors.green}
              />
              <Text style={ui.small}>{saved ? "Đã lưu" : "Lưu"}</Text>
            </Pressable>
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
            <Text style={ui.eyebrow}>Người sang tay</Text>
            <Text style={ui.heading}>{item.seller}</Text>
            <Text style={ui.small}>{item.school}</Text>
          </View>
          <View style={[ui.panel, { backgroundColor: colors.sage }]}>
            <Text style={ui.body}>
              Hẹn ở nơi công cộng, xem kỹ món đồ trước khi thanh toán. Không
              chia sẻ OTP hoặc chuyển cọc khi chưa xác minh.
            </Text>
          </View>
          <Notice text={error} />
        </View>
      </ScrollView>
      <SafeAreaView
        edges={["bottom"]}
        style={{
          backgroundColor: colors.paper,
          borderTopWidth: 1,
          borderColor: colors.line,
          padding: 14,
        }}
      >
        <Button
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
