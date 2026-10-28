import { useEffect, useRef, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { ownedListingsApi } from "../api/owned-listings";
import { message } from "../api/client";
import type { Product } from "../api/types";
import { soldPayload } from "../state/owned-listings";
import { useCatalogue } from "../providers/Market";
import { useOwnedListingChange } from "../hooks/useOwnedListingChange";
import { useTheme } from "../theme";
import { Button, Chips, Field, Notice } from "./UI";
export function SoldListingForm({ item, onReload, api = ownedListingsApi }: { item: Product; onReload: () => void; api?: Pick<typeof ownedListingsApi, "sold"> }) {
  const { ui } = useTheme(), { offline } = useCatalogue(), changed = useOwnedListingChange();
  const [viaSangTay, setViaSangTay] = useState(true), [buyer, setBuyer] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState(""), [done, setDone] = useState("");
  const pending = useRef(false), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function submit() {
    if (!mounted.current || pending.current || done) return;
    if (offline) { setError("Kết nối mạng để xác nhận đã bán."); return; }
    pending.current = true; setBusy(true); setError("");
    try {
      const result = await api.sold(item.id, viaSangTay, buyer);
      if (!mounted.current) return;
      if (!result.success) throw Error(result.message || "Chưa xác nhận được giao dịch.");
      setDone(result.message); await changed(item.id);
    } catch (e) { if (mounted.current) setError(message(e)); }
    finally { pending.current = false; if (mounted.current) setBusy(false); }
  }
  function confirm() {
    try { soldPayload(viaSangTay, buyer); } catch (e) { setError(message(e)); return; }
    Alert.alert("Xác nhận đã giao món đồ?", `${item.title}\n\n${viaSangTay ? "Tin chuyển sang đã bán và chờ người mua xác nhận đã nhận hàng." : "Ghi nhận bán ngoài SangTay. Không tạo giao dịch xác nhận/đánh giá trên hệ thống."}`, [{ text: "Chưa giao", style: "cancel" }, { text: "Đã giao đồ", onPress: () => { void submit(); } }]);
  }
  return <ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled"><Text style={ui.eyebrow}>Khép lại một hành trình</Text><Text style={ui.title}>Đánh dấu đã bán</Text><View style={ui.panel}><Text style={ui.heading}>{item.title}</Text><Text style={ui.body}>Chỉ xác nhận sau khi đã giao đồ. Server sẽ kiểm tra lịch hẹn và người mua; thao tác này không chuyển tiền.</Text>
    <Chips values={["Qua SangTay", "Ngoài SangTay"]} value={viaSangTay ? "Qua SangTay" : "Ngoài SangTay"} onChange={value => { if (!busy && !done) { setViaSangTay(value === "Qua SangTay"); setError(""); } }} />
    {viaSangTay ? <><Field label="Email hoặc mã người mua" value={buyer} autoCapitalize="none" autoCorrect={false} editable={!busy && !done} onChangeText={value => { setBuyer(value); setError(""); }} /><Text style={ui.small}>Người mua phải đã nhắn tin về sản phẩm này. Sau khi ghi nhận, họ xác nhận nhận hàng trên SangTay.</Text></> : <Text style={ui.small}>Bán ngoài hệ thống chỉ đổi trạng thái tin; không tạo giao dịch để hai bên đánh giá.</Text>}
  </View><Notice text={error} />{!!done && <Text accessibilityLiveRegion="polite" style={ui.body}>{done}</Text>}
    {!done && <Button title={error ? "Thử xác nhận lại" : "Xác nhận đã giao đồ"} loading={busy} disabled={offline} onPress={confirm} />}
    {!!error && <Button title="Tải lại trạng thái tin" soft disabled={busy} onPress={onReload} />}
    <Button title="Về Tin của tôi" soft disabled={busy} onPress={() => router.replace("/my-listings")} />
  </ScrollView>;
}
