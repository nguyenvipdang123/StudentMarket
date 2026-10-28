import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { API_URL } from "../api/client";
import { mediaUrl, priceLabel } from "../api/policy";
import type { Product } from "../api/types";
import { colors, ui } from "../theme";
export function ProductCard({ item }: { item: Product }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Xem ${item.title}`}
      onPress={() =>
        router.push({ pathname: "/listing/[id]", params: { id: item.id } })
      }
      style={({ pressed }) => ({
        flex: 1,
        minWidth: 0,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.line,
        overflow: "hidden",
        backgroundColor: pressed ? colors.sage : colors.paper,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Image
        source={mediaUrl(item.image, API_URL)}
        style={{
          width: "100%",
          aspectRatio: 1.12,
          backgroundColor: colors.sage,
        }}
        contentFit="cover"
        transition={150}
        accessibilityLabel={item.title}
      />
      <View style={{ padding: 11, gap: 7 }}>
        <Text numberOfLines={1} style={[ui.small, { fontSize: 10 }]}>
          {item.condition}
        </Text>
        <Text
          numberOfLines={2}
          style={{
            fontFamily: "Bold",
            fontSize: 13,
            lineHeight: 19,
            color: colors.dark,
            minHeight: 38,
          }}
        >
          {item.title}
        </Text>
        <Text style={{ fontFamily: "Bold", fontSize: 17, color: colors.green }}>
          {priceLabel(item.price, item.description, item.freeGift)}
        </Text>
        <View style={[ui.row, { gap: 4 }]}>
          <Ionicons name="location-outline" size={12} color={colors.muted} />
          <Text numberOfLines={1} style={[ui.small, { flex: 1, fontSize: 10 }]}>
            {item.school || item.location}
          </Text>
        </View>
        {item.moderationStatus && item.moderationStatus !== "APPROVED" && (
          <Text style={ui.badgeText}>
            {item.moderationStatus === "PENDING"
              ? "Chờ duyệt"
              : "Cần chỉnh sửa"}
          </Text>
        )}
      </View>
    </Pressable>
  );
}
