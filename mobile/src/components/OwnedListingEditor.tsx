import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { ownedListingsApi } from "../api/owned-listings";
import { API_URL, message } from "../api/client";
import { categories, conditions, type Product } from "../api/types";
import { mediaUrl } from "../api/policy";
import { compressPhoto } from "../api/photos";
import type { CompressedPhoto } from "../api/photos-policy";
import { ownedDraft, type OwnedDraft } from "../state/owned-listings";
import { useCatalogue } from "../providers/Market";
import { useOwnedListingChange } from "../hooks/useOwnedListingChange";
import { useTheme } from "../theme";
import { Button, Chips, Field, Notice } from "./UI";
export function OwnedListingEditor({ item, api = ownedListingsApi }: { item: Product; api?: Pick<typeof ownedListingsApi, "edit"> }) {
  const { ui, colors } = useTheme(), { offline } = useCatalogue(), changed = useOwnedListingChange();
  const [draft, setDraft] = useState(() => ownedDraft(item)), [cover, setCover] = useState<CompressedPhoto | null>(null);
  const [busy, setBusy] = useState(false), [processing, setProcessing] = useState(false), [error, setError] = useState(""), [done, setDone] = useState("");
  const pending = useRef(false), picking = useRef(false), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const disabled = busy || processing || !!done;
  function change(key: keyof OwnedDraft, value: string) { if (!disabled) { setDraft(old => ({ ...old, [key]: value })); setError(""); } }
  async function pick() {
    if (pending.current || picking.current || done) return;
    picking.current = true; setProcessing(true); setError("");
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: false, quality: 1 });
      if (!result.canceled && result.assets[0]) { const photo = await compressPhoto(result.assets[0]); if (mounted.current) setCover(photo); }
    } catch (e) { if (mounted.current) setError(message(e)); }
    finally { picking.current = false; if (mounted.current) setProcessing(false); }
  }
  async function save() {
    if (pending.current || picking.current || done) return;
    if (offline) { setError("Bạn đang offline. Kết nối mạng để lưu thay đổi; nội dung đang sửa vẫn được giữ."); return; }
    pending.current = true; setBusy(true); setError("");
    try {
      const result = await api.edit(item.id, draft, item, cover);
      if (!mounted.current) return;
      if (!result.success) throw Error(result.message || "Chưa lưu được tin.");
      setDone(result.message || "Đã lưu. Tin sẽ được duyệt lại.");
      await changed(item.id);
    } catch (e) { if (mounted.current) setError(message(e)); }
    finally { pending.current = false; if (mounted.current) setBusy(false); }
  }
  return <SafeAreaView style={ui.screen} edges={["bottom"]}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={ui.content}>
    <Text style={ui.eyebrow}>Chăm chút tin đăng</Text><Text style={ui.title}>Sửa món đồ</Text>
    <Text style={ui.small}>Lưu nội dung sẽ gửi tin duyệt lại. Ảnh khác trong tin được giữ nguyên; bạn có thể đổi ảnh bìa bên dưới.</Text>
    {offline && <Notice text="Bạn đang offline. Có thể sửa nội dung, kết nối lại để lưu." />}
    <View style={ui.panel}><Text style={ui.heading}>Ảnh bìa</Text><Image source={cover?.uri || mediaUrl(item.images?.[0] || item.image, API_URL)} style={{ width: "100%", height: 200, borderRadius: 16, backgroundColor: colors.sage }} contentFit="contain" accessibilityLabel="Ảnh bìa của tin đang sửa" />
      {!!cover && <Text style={ui.small}>{Math.round(cover.fileSize / 1024)} KB · Đã nén</Text>}<Button title={processing ? "Đang nén ảnh…" : "Đổi ảnh bìa"} soft loading={processing} disabled={disabled} onPress={() => { void pick(); }} />
      {!!cover && <Button title="Giữ ảnh bìa cũ" soft disabled={disabled} onPress={() => setCover(null)} />}
    </View>
    <View style={ui.panel}><Field label="Tên món đồ *" value={draft.title} maxLength={200} editable={!disabled} onChangeText={value => change("title", value)} />
      <Text style={ui.label}>Danh mục</Text><Chips values={categories.slice(1)} value={draft.category} onChange={value => change("category", value)} />
      <Text style={ui.label}>Tình trạng</Text><Chips values={conditions} value={draft.condition} onChange={value => change("condition", value)} />
      <Field label="Mô tả món đồ *" value={draft.description} multiline maxLength={10000} editable={!disabled} onChangeText={value => change("description", value)} />
    </View>
    <View style={ui.panel}><Text style={ui.heading}>Giá & nơi hẹn</Text><Chips values={["Bán lại", "Trao đổi", "Tặng miễn phí"]} value={draft.kind === "Sell" ? "Bán lại" : draft.kind === "Gift" ? "Tặng miễn phí" : "Trao đổi"} onChange={value => change("kind", value === "Bán lại" ? "Sell" : value === "Tặng miễn phí" ? "Gift" : "Exchange")} />
      {draft.kind === "Sell" && <Field label="Giá bán (đ) *" keyboardType="number-pad" value={draft.price} editable={!disabled} onChangeText={value => change("price", value)} />}
      <Field label="Khu vực hẹn gặp *" value={draft.location} maxLength={200} editable={!disabled} onChangeText={value => change("location", value)} />
      <Text style={ui.label}>Sau khi lưu</Text><Chips values={["Hiển thị sau duyệt", "Giữ ẩn"]} value={draft.status === "Active" ? "Hiển thị sau duyệt" : "Giữ ẩn"} onChange={value => change("status", value === "Giữ ẩn" ? "Hidden" : "Active")} />
    </View>
    <Notice text={error} />{!!done && <Text accessibilityLiveRegion="polite" style={ui.body}>{done}</Text>}
    {!done && <Button title={error ? "Thử lưu lại" : "Lưu thay đổi"} loading={busy} disabled={offline || processing} onPress={() => { void save(); }} />}
    <Button title="Về Tin của tôi" soft disabled={busy || processing} onPress={() => router.replace("/my-listings")} />
  </ScrollView></KeyboardAvoidingView></SafeAreaView>;
}
