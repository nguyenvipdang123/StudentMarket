import { useCallback, useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { API_URL, message, request } from "../api/client";
import { mediaUrl } from "../api/policy";
import type { Product } from "../api/types";
import { useSession } from "../providers/Session";
import { useAccountMarket, useCatalogue } from "../providers/Market";
import { availability, checkCart, checkoutSummary, type Delivery } from "../state/commerce";
import { Button, Chips, Empty, Notice } from "./UI";
import { OfflineBanner } from "./OfflineBanner";
import { colors, ui } from "../theme";
const money = (value: number) => `${new Intl.NumberFormat("vi-VN").format(value)}đ`;
export function CartScreen({ checkout = false }: { checkout?: boolean }) {
  const { user } = useSession();
  // Switching accounts discards any previous validation result as well as its cart.
  return <CartContent key={user?.pgUserId || user?.id || "guest"} checkout={checkout} />;
}
function CartContent({ checkout }: { checkout: boolean }) {
  const { user } = useSession(), { cart, ready, store, error: storageError } = useAccountMarket(), { offline } = useCatalogue();
  const [delivery, setDelivery] = useState<Delivery>("pickup"), [busy, setBusy] = useState(false), [notice, setNotice] = useState("");
  const [issues, setIssues] = useState<Record<string, string>>({}), [verifiedAt, setVerifiedAt] = useState("");
  const pending = useRef(false);
  const validate = useCallback(async () => {
    if (pending.current) return false;
    setVerifiedAt(""); setNotice("");
    if (offline) { setNotice("Bạn đang offline. Kết nối Internet để kiểm tra tình trạng trước khi thanh toán."); return false; }
    const before = store.getSnapshot().cart;
    if (!before.length) return false;
    pending.current = true; setBusy(true);
    try {
      const result = await checkCart(before, async id => (await request<{ product: Product }>("/api/products/" + encodeURIComponent(id))).product, user?.pgUserId);
      if (store.getSnapshot().cart !== before) { setNotice("Giỏ đã thay đổi. Vui lòng kiểm tra lại."); return false; }
      await store.replaceCart(result.products);
      setIssues(result.issues);
      if (Object.keys(result.issues).length) { setNotice("Có món không còn khả dụng hoặc chưa xác minh được. Xóa món có cảnh báo rồi kiểm tra lại."); return false; }
      setVerifiedAt(new Date().toLocaleString("vi-VN"));
      if (result.priceChanged) { setNotice("Giá đã thay đổi. Giỏ đã cập nhật giá mới; hãy kiểm tra tổng tiền rồi bấm tiếp tục lần nữa."); return false; }
      return true;
    } catch (e) { setNotice(message(e)); return false; }
    finally { pending.current = false; setBusy(false); }
  }, [offline, store, user]);
  useFocusEffect(useCallback(() => { if (checkout) void validate(); }, [checkout, validate]));
  // Totals and availability messages are derived from the current shared cart.
  const summary = checkoutSummary(cart, delivery);
  const blocked = cart.some(p => availability(p, user?.pgUserId) || issues[p.id]);
  if (!user) return <View style={ui.content}><Empty title="Đăng nhập để xem giỏ hàng" detail="Giỏ hàng được lưu riêng cho tài khoản của bạn." action="Đăng nhập" onPress={() => router.push("/login")} /></View>;
  return <SafeAreaView style={ui.screen} edges={["bottom"]}><ScrollView contentContainerStyle={ui.content}>
    <Text style={ui.eyebrow}>{checkout ? "Kiểm tra trước khi hẹn nhận" : "Chọn món, nhận niềm vui"}</Text>
    <Text style={ui.title}>{checkout ? "Tóm tắt thanh toán" : "Giỏ hàng"}</Text>
    <OfflineBanner /><Notice text={storageError} />
    <Text style={ui.small}>Mỗi tin là một món đồ duy nhất, số lượng tối đa 1. Thêm vào giỏ chưa giữ chỗ và chưa đặt mua.</Text>
    {!ready ? <Text style={ui.body}>Đang khôi phục giỏ hàng…</Text> : !cart.length ? <Empty title="Giỏ hàng đang trống" detail="Mở chi tiết một món đồ rồi chọn Thêm vào giỏ." action="Khám phá món đồ" onPress={() => router.push("/")} /> : <>
      {cart.map(product => <View key={product.id} style={ui.panel}>
        <View style={ui.row}><Image source={mediaUrl(product.image, API_URL)} cachePolicy="memory-disk" style={{ width: 65, height: 65, borderRadius: 12, backgroundColor: colors.sage }} /><View style={{ flex: 1, gap: 5 }}><Text style={ui.heading}>{product.title}</Text><Text style={ui.small}>{product.seller} · Số lượng: 1</Text><Text style={ui.body}>{money(product.price)}</Text></View></View>
        <Notice text={issues[product.id] || availability(product, user.pgUserId)} />
        <Button title={`Xóa ${product.title} khỏi giỏ`} soft disabled={busy} onPress={() => { void store.remove(product.id); setIssues({}); setVerifiedAt(""); setNotice(""); }} />
        {checkout && !offline && !!verifiedAt && !blocked && <Button title={`Liên hệ người bán ${product.title}`} onPress={() => router.push({ pathname: "/contact/[listingId]", params: { listingId: product.id } })} />}
      </View>)}
      <View style={ui.panel}>
        <Text style={ui.heading}>Cách nhận hàng</Text>
        <Chips values={["Tự nhận · 0đ", "Giao hàng dự kiến"]} value={delivery === "pickup" ? "Tự nhận · 0đ" : "Giao hàng dự kiến"} onChange={value => setDelivery(value === "Tự nhận · 0đ" ? "pickup" : "delivery")} />
        <Text style={ui.small}>Quy tắc dự tính: tự nhận miễn phí; giao hàng 30.000đ cho mỗi người bán khác nhau. Nhiều món cùng người bán tính một lần. Phí thực tế cần thỏa thuận với người bán.</Text>
        <View style={ui.between}><Text style={ui.body}>Tạm tính ({summary.count} món)</Text><Text style={ui.heading}>{money(summary.subtotal)}</Text></View>
        <View style={ui.between}><Text style={ui.body}>Phí giao dự kiến</Text><Text style={ui.heading}>{money(summary.deliveryFee)}</Text></View>
        <View style={ui.between}><Text style={ui.heading}>Tổng dự kiến</Text><Text style={ui.heading}>{money(summary.total)}</Text></View>
      </View>
      <Notice text={notice} />
      {!!verifiedAt && !offline && <Text style={ui.small}>Đã kiểm tra API lúc {verifiedAt}. Món đồ có thể thay đổi trước khi hai bên giao dịch.</Text>}
      <Button title={checkout ? "Kiểm tra lại tình trạng và giá" : "Kiểm tra món & tiếp tục thanh toán"} loading={busy} disabled={offline || !ready} onPress={() => { void validate().then(valid => { if (valid && !checkout) router.push("/checkout"); }); }} />
      <Text style={ui.small}>Đây là bảng chi phí dự kiến. Chưa tạo đơn, giữ hàng hay thu tiền; hãy liên hệ người bán để thống nhất giao nhận.</Text>
    </>}
  </ScrollView></SafeAreaView>;
}
