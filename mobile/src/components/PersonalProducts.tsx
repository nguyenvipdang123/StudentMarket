import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, FlatList, RefreshControl, Text, View } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect, router } from "expo-router";
import { useSession } from "../providers/Session";
import { API_URL, message } from "../api/client";
import type { Product } from "../api/types";
import { mediaUrl, priceLabel } from "../api/policy";
import { ownedListingsApi } from "../api/owned-listings";
import { useCatalogue } from "../providers/Market";
import { useOwnedListingChange } from "../hooks/useOwnedListingChange";
import { listingStatus } from "../state/listing-view";
import { Empty, Notice, Button, Chips } from "./UI";
import { useTheme } from "../theme";
import { LastUpdated } from "./LastUpdated";
import { ScreenState } from "./ScreenState";
type Api = Pick<typeof ownedListingsApi, "list" | "visibility" | "remove">;
type Action = "hide" | "show" | "delete";
export function PersonalProducts({ api = ownedListingsApi }: { api?: Api }) {
  const { user } = useSession();
  return <MyProducts key={user?.pgUserId || user?.id || "guest"} api={api} />;
}
function MyProducts({ api }: { api: Api }) {
  const { colors, ui } = useTheme(), { user, ready } = useSession(), { offline } = useCatalogue();
  const changed = useOwnedListingChange();
  const [items, setItems] = useState<Product[]>([]), [busy, setBusy] = useState(true), [error, setError] = useState(""), [feedback, setFeedback] = useState(""), [lastUpdatedAt, setLastUpdatedAt] = useState("");
  const [filter, setFilter] = useState("Tất cả"), [acting, setActing] = useState<string | null>(null);
  const generation = useRef(0), mounted = useRef(true), pending = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const load = useCallback(async () => {
    if (!user || !mounted.current) { setBusy(false); return; }
    const run = ++generation.current;
    setBusy(true); setError("");
    try {
      const result = await api.list();
      if (mounted.current && run === generation.current) { setItems(result.listings || []); setLastUpdatedAt(new Date().toISOString()); }
    } catch (e) { if (mounted.current && run === generation.current) setError(message(e)); }
    finally { if (mounted.current && run === generation.current) setBusy(false); }
  }, [api, user]);
  useFocusEffect(useCallback(() => { void load(); return () => { generation.current++; }; }, [load]));
  async function act(item: Product, action: Action) {
    if (!mounted.current || pending.current) return;
    if (offline) { setError("Bạn đang offline. Kết nối mạng để quản lý tin."); return; }
    pending.current = true; setActing(item.id); setError(""); setFeedback("");
    try {
      const result = action === "delete" ? await api.remove(item.id, item.status) : await api.visibility(item.id, action === "hide" ? "Hidden" : "Active", item.status);
      if (!mounted.current) return;
      if (!result.success) throw Error(result.message || "Chưa lưu được thay đổi. Bạn thử lại nhé.");
      setItems(old => action === "delete" ? old.filter(product => product.id !== item.id) : old.map(product => product.id === item.id ? { ...product, status: action === "hide" ? "Hidden" : "Active", moderationStatus: result.moderationStatus || product.moderationStatus } : product));
      setFeedback(result.message);
      await changed(item.id);
      if (mounted.current) await load();
    } catch (e) { if (mounted.current) setError(message(e)); }
    finally { pending.current = false; if (mounted.current) setActing(null); }
  }
  function confirm(item: Product, action: Action) {
    const title = action === "delete" ? "Xóa tin?" : action === "hide" ? "Ẩn tin?" : "Hiện lại tin?";
    const detail = action === "delete" ? "Tin sẽ rời danh sách của bạn và trang công khai. Lịch sử tin nhắn, giao dịch vẫn được giữ." : action === "hide" ? "Người khác sẽ không thấy tin trên trang công khai." : "Tin sẽ được duyệt lại trước khi hiển thị công khai.";
    Alert.alert(title, `${item.title}\n\n${detail}`, [{ text: "Hủy", style: "cancel" }, { text: action === "delete" ? "Xóa tin" : "Xác nhận", style: action === "delete" ? "destructive" : "default", onPress: () => { void act(item, action); } }]);
  }
  if (!ready) return <ScreenState loading onRetry={() => void load()} />;
  if (!user) return <View style={ui.content}><Empty title="Đăng nhập để xem tin của bạn" detail="Dùng tài khoản sở hữu tin để quản lý." action="Đăng nhập" onPress={() => router.push("/login")} /></View>;
  const visible = items.filter(item => filter === "Tất cả" || listingStatus(item) === filter);
  return <FlatList data={visible} keyExtractor={item => item.id} contentContainerStyle={ui.content}
    refreshControl={<RefreshControl refreshing={busy} onRefresh={() => { if (!pending.current) void load(); }} tintColor={colors.green} />}
    ListHeaderComponent={<View style={{ gap: 12 }}><Text style={ui.eyebrow}>Chăm chút món đồ của bạn</Text><Text style={ui.title}>Tin của tôi</Text><Text style={ui.small}>{items.length} tin · Sửa nội dung sẽ gửi duyệt lại</Text><LastUpdated value={lastUpdatedAt} busy={busy} />
      <Chips values={["Tất cả", "Đang hiển thị", "Chờ kiểm duyệt", "Cần chỉnh sửa", "Đã ẩn", "Đã sang tay"]} value={filter} onChange={setFilter} />
      {offline && <Notice text="Bạn đang offline. Kết nối mạng để cập nhật hoặc quản lý tin." />}<Notice text={error} />{!!error && <Button title="Tải lại danh sách" soft disabled={acting !== null} onPress={() => void load()} />}
      {!!feedback && <Text accessibilityLiveRegion="polite" style={ui.body}>{feedback}</Text>}
      <Button title="Đăng tin mới" onPress={() => router.push("/post")} />
    </View>}
    renderItem={({ item }) => <View style={ui.panel}>
      <View style={ui.row}><Image source={mediaUrl(item.image, API_URL)} style={{ width: 86, height: 86, borderRadius: 14, backgroundColor: colors.sage }} contentFit="cover" accessibilityLabel={item.title} /><View style={{ flex: 1, gap: 7 }}><Text style={ui.heading}>{item.title}</Text><Text style={ui.body}>{priceLabel(item.price, item.description, item.freeGift)}</Text><Text style={ui.badgeText}>{listingStatus(item)}</Text></View></View>
      <Text style={ui.small}>{item.views || 0} lượt xem · {item.likes || 0} lượt lưu · {item.chats || 0} cuộc trò chuyện</Text>
      {!!item.rejectionReason && <Notice text={item.rejectionReason} />}
      <Button title="Xem tin" label={`Xem tin ${item.title}`} soft onPress={() => router.push({ pathname: "/listing/[id]", params: { id: item.id } })} />
      {item.status !== "Sold" && <><Button title="Sửa tin" label={`Sửa tin ${item.title}`} disabled={offline || busy || acting !== null} onPress={() => router.push({ pathname: "/my-listings/[id]/edit", params: { id: item.id } })} />
        <Button title={item.status === "Hidden" ? "Hiện lại tin" : "Ẩn tin"} label={`${item.status === "Hidden" ? "Hiện lại tin" : "Ẩn tin"} ${item.title}`} soft disabled={offline || busy || acting !== null} onPress={() => confirm(item, item.status === "Hidden" ? "show" : "hide")} /></>}
      {item.status === "Active" && item.moderationStatus === "APPROVED" && <Button title="Đánh dấu đã bán" label={`Đánh dấu đã bán ${item.title}`} soft disabled={offline || busy || acting !== null} onPress={() => router.push({ pathname: "/my-listings/[id]/sold", params: { id: item.id } })} />}
      <Button title="Xóa tin" label={`Xóa tin ${item.title}`} soft loading={acting === item.id} disabled={offline || busy || acting !== null} onPress={() => confirm(item, "delete")} />
    </View>}
    ListEmptyComponent={!busy && !error ? <Empty title={items.length ? "Không có tin trong mục này" : "Chưa có tin đăng"} detail="Bạn có thể đổi trạng thái lọc hoặc đăng món đồ đầu tiên." /> : busy && !items.length ? <ScreenState loading onRetry={() => void load()} /> : undefined}
  />;
}
