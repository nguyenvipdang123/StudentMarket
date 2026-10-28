import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { View } from "react-native";
import { useSession } from "../providers/Session";
import { ownedListingsApi } from "../api/owned-listings";
import { message } from "../api/client";
import { ownsListing, validListingId } from "../state/owned-listings";
import { Empty } from "./UI";
import { ScreenState } from "./ScreenState";
import { useTheme } from "../theme";
import { OwnedListingEditor } from "./OwnedListingEditor";
import { SoldListingForm } from "./SoldListingForm";
export function OwnedListingScreen({ id, mode }: { id: string; mode: "edit" | "sold" }) {
  const { user, ready } = useSession(), { ui } = useTheme();
  const query = useQuery({ queryKey: ["owned-listing", user?.pgUserId, id], enabled: ready && !!user && validListingId(id), queryFn: async () => {
    const item = await ownedListingsApi.get(id);
    if (!ownsListing(item, user?.pgUserId)) throw Error("Bạn không phải chủ tin này.");
    return item;
  }, retry: false, gcTime: 0 });
  if (!ready) return <ScreenState loading onRetry={() => { void query.refetch(); }} />;
  if (!user) return <View style={ui.content}><Empty title="Đăng nhập để quản lý tin" detail="Chỉ tài khoản sở hữu tin mới có thể thay đổi." action="Đăng nhập" onPress={() => router.push("/login")} /></View>;
  if (!validListingId(id)) return <View style={ui.content}><Empty title="Mã tin không hợp lệ" detail="Chọn lại tin trong danh sách của bạn." action="Tin của tôi" onPress={() => router.replace("/my-listings")} /></View>;
  if (query.isPending || query.error || !query.data) return <ScreenState loading={query.isPending} error={query.error ? message(query.error) : ""} empty={!query.data} onRetry={() => { void query.refetch(); }} />;
  const item = query.data;
  if (item.status === "Sold" || mode === "sold" && (item.status !== "Active" || item.moderationStatus !== "APPROVED")) return <View style={ui.content}><Empty title="Tin chưa thể thực hiện thao tác này" detail={item.status === "Sold" ? "Tin đã được đánh dấu bán. Bạn có thể xem lại trong Tin của tôi." : "Chỉ tin đang hiển thị và đã được duyệt mới có thể đánh dấu đã bán."} action="Tin của tôi" onPress={() => router.replace("/my-listings")} /></View>;
  return mode === "edit" ? <OwnedListingEditor key={`${user.pgUserId}:${id}`} item={item} /> : <SoldListingForm key={`${user.pgUserId}:${id}`} item={item} onReload={() => { void query.refetch(); }} />;
}
