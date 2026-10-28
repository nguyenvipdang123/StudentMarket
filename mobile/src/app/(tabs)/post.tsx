import { useEffect, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSession } from "../../providers/Session";
import { message, request } from "../../api/client";
import { categories, conditions } from "../../api/types";
import { validateDraft } from "../../api/policy";
import { compressPhoto, appendPhotos } from "../../api/photos";
import { validatePhotos, type CompressedPhoto } from "../../api/photos-policy";
import { useCatalogue } from "../../providers/Market";
import { OfflineBanner } from "../../components/OfflineBanner";
import { Button, Chips, Empty, Field, Notice } from "../../components/UI";
import { useTheme } from "../../theme";
import { ScreenState } from "../../components/ScreenState";
import { useListingDraft } from "../../hooks/useListingDraft";
import type { ListingDraft } from "../../state/listing-draft";
import type { User } from "../../api/types";
export default function Post() {
  const { user, ready } = useSession();
  const { ui } = useTheme();
  if (!ready) return <SafeAreaView style={ui.screen}><ScreenState loading onRetry={() => {}} /></SafeAreaView>;
  if (!user || user.role !== "student") return <SafeAreaView style={ui.screen} edges={["top"]}><View style={ui.content}>
    <Text style={ui.title}>Sang tay món đồ</Text>
    {user ? <Empty title="Đăng tin dành cho sinh viên" detail="Hãy dùng tài khoản sinh viên để đăng món đồ." /> :
      <Empty title="Đăng nhập để đăng tin" detail="Dùng tài khoản sinh viên đã xác minh của bạn." action="Đăng nhập" onPress={() => router.push("/login")} />}
  </View></SafeAreaView>;
  return <PostForm key={user.pgUserId || user.id} user={user} />;
}
function PostForm({ user }: { user: User }) {
  const { colors, ui } = useTheme();
  const { offline } = useCatalogue();
  const { state, store } = useListingDraft(user.pgUserId || String(user.id));
  const { draft, photos } = state;
  const [busy, setBusy] = useState(false),
    [processing, setProcessing] = useState(false),
    [submitted, setSubmitted] = useState(false),
    [error, setError] = useState("");
  const pending = useRef(false), picking = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const locked = busy || state.clearing || submitted;
  const change = (key: keyof ListingDraft, value: string) => {
    if (locked) return;
    store.change(key, value);
    setError("");
  };
  async function pick(camera = false) {
    if (picking.current || locked || photos.length >= 8) return;
    picking.current = true; setProcessing(true); setError("");
    try {
      if (camera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) { setError("Bạn chưa cho phép camera. Có thể chọn ảnh từ thư viện thay thế."); return; }
      }
      const result = camera ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 1 }) : await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        selectionLimit: 8 - photos.length,
        quality: 1,
      });
      if (result.canceled || !mounted.current) return;
      const compressed: CompressedPhoto[] = [];
      // Sequential processing keeps memory bounded on older phones.
      for (const asset of result.assets.slice(0, 8 - photos.length)) compressed.push(await compressPhoto(asset));
      if (!mounted.current) return;
      await store.addPhotos(compressed);
      if (mounted.current) setError("");
    } catch (e) {
      if (mounted.current) setError(message(e));
    } finally { picking.current = false; if (mounted.current) setProcessing(false); }
  }
  async function removePhoto(uri: string) {
    if (locked || picking.current) return;
    picking.current = true; setProcessing(true);
    try { await store.removePhoto(uri); }
    finally { picking.current = false; if (mounted.current) setProcessing(false); }
  }
  function discard() {
    Alert.alert("Bỏ bản nháp?", "Nội dung và các ảnh nháp của tài khoản này sẽ được xóa khỏi thiết bị.", [
      { text: "Giữ lại", style: "cancel" },
      { text: "Bỏ bản nháp", style: "destructive", onPress: () => { void store.clear(); } },
    ]);
  }
  async function submit() {
    if (pending.current || picking.current || locked) return;
    const invalid = offline ? "Bạn đang offline. Có thể lưu bản nháp trên máy và gửi khi có mạng." : validateDraft(draft) || validatePhotos(photos);
    if (invalid) {
      setError(invalid);
      return;
    }
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("title", draft.title.trim());
      form.append(
        "description",
        (draft.kind === "Gift" ? "Tặng miễn phí. " : "") +
          draft.description.trim(),
      );
      form.append("price", draft.kind === "Sell" ? draft.price : "0");
      form.append("category", draft.category);
      form.append("condition", draft.condition);
      form.append("location", draft.location.trim());
      await appendPhotos(form, photos);
      await request("/api/products", { method: "POST", body: form }, 60000);
      // Once the server accepts the listing, never offer to resend it if local cleanup fails.
      if (mounted.current) setSubmitted(true);
      await store.clear();
      if (!mounted.current) return;
      Alert.alert(
        "Đã gửi tin đăng",
        "Tin đang chờ kiểm duyệt. Bạn có thể theo dõi trong Tin của tôi.",
        [
          {
            text: "Xem tin của tôi",
            onPress: () => router.push("/my-listings"),
          },
        ],
      );
    } catch (e) {
      if (mounted.current) setError(message(e));
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  if (!state.ready) return <SafeAreaView style={ui.screen} edges={["top"]}>
    <ScreenState loading={!state.loadError} error={state.loadError} onRetry={() => void store.retryLoad()} />
    {!!state.loadError && <View style={ui.content}>
      <Notice text={state.error} />
      <Button title="Bỏ bản nháp lỗi" soft disabled={state.clearing} onPress={discard} />
    </View>}
  </SafeAreaView>;
  if (submitted) return <SafeAreaView style={ui.screen} edges={["top"]}><View style={ui.content}>
    <Text style={ui.title}>Đã gửi tin đăng</Text>
    <Text style={ui.body}>Tin đang chờ kiểm duyệt. Bạn có thể theo dõi trong Tin của tôi.</Text>
    <Notice text={state.error} />
    {!!state.error && <Button title="Thử xóa nháp đã gửi" onPress={() => void store.clear()} disabled={state.clearing} />}
    <Button title="Xem tin của tôi" onPress={() => router.push("/my-listings")} />
    <Button title="Đăng món đồ khác" soft disabled={state.clearing} onPress={() => { void store.clear().then(ok => { if (ok && mounted.current) { setSubmitted(false); setError(""); } }); }} />
  </View></SafeAreaView>;
  return (
    <SafeAreaView style={ui.screen} edges={["top"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={ui.content}
        >
          <Text style={ui.eyebrow}>Cũ với bạn, mới với ai đó</Text>
          <Text style={ui.title}>Sang tay món đồ{"\n"}của bạn.</Text>
          <OfflineBanner />
          <Text style={ui.small}>
            Đăng tin miễn phí · Tin mới sẽ được kiểm duyệt.
          </Text>
          <View style={ui.panel}>
            <Text style={ui.heading}>Bản nháp trên thiết bị</Text>
            <Text style={ui.small} accessibilityLiveRegion="polite">
              {state.saving ? "Đang lưu nháp…" : state.dirty ? "Có thay đổi chưa lưu trên máy." : state.savedAt ? `Đã lưu nháp lúc ${new Date(state.savedAt).toLocaleString("vi-VN")}` : "Tự lưu nội dung và ảnh riêng cho tài khoản này, kể cả khi mất mạng."}
            </Text>
            {!!state.warning && <Text style={ui.body}>{state.warning}</Text>}
            <Notice text={state.error} />
            <Button title="Lưu bản nháp" soft disabled={locked || processing} loading={state.saving} onPress={() => void store.save()} />
            <Button title="Bỏ bản nháp" soft disabled={locked || processing || (!state.savedAt && !state.dirty && !photos.length)} onPress={discard} />
          </View>
          <View style={ui.panel}>
            <Text style={ui.heading}>Ảnh món đồ · {photos.length}/8</Text>
            <Text style={ui.small}>
              Bắt buộc ít nhất 1 ảnh. Ảnh được nén JPEG 72%, tối đa 1.600px và 5 MB trước khi gửi; ảnh đầu là ảnh bìa.
            </Text>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {photos.map((photo, i) => (
                <View key={photo.uri + i}>
                  <Image
                    source={photo.uri}
                    style={{ width: 88, height: 88, borderRadius: 12 }}
                  />
                  <Text style={[ui.small, { fontSize: 10 }]}>{Math.round(photo.fileSize / 1024)} KB · Đã nén</Text>
                  <Pressable
                    accessibilityRole="button"
                    disabled={locked || processing}
                    accessibilityLabel={`Xóa ảnh ${i + 1}`}
                    onPress={() => void removePhoto(photo.uri)}
                    style={{
                      position: "absolute",
                      right: 2,
                      top: 2,
                      backgroundColor: colors.onAccent,
                      padding: 8,
                      minWidth: 44,
                      minHeight: 44,
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 20,
                    }}
                  >
                    <Ionicons name="close" size={18} color={colors.green} />
                  </Pressable>
                </View>
              ))}
            </View>
            <Button
              title="Chọn ảnh từ thiết bị"
              soft
              disabled={locked || processing || photos.length >= 8}
              onPress={() => void pick()}
            />
            <Button title="Chụp ảnh món đồ" soft disabled={locked || processing || photos.length >= 8} onPress={() => void pick(true)} />
            {processing && <Text style={ui.small}>Đang xử lý và lưu ảnh trên thiết bị…</Text>}
          </View>
          <View style={ui.panel}>
            <Field
              label="Tên món đồ *"
              value={draft.title}
              onChangeText={(v) => change("title", v)}
              maxLength={200}
              editable={!locked}
              placeholder="Ví dụ: Đèn bàn học màu kem"
            />
            <Text style={ui.label}>Danh mục</Text>
            <Chips
              values={categories.slice(1)}
              value={draft.category}
              onChange={(v) => {
                if (!locked) change("category", v);
              }}
            />
            <Text style={ui.label}>Tình trạng</Text>
            <Chips
              values={conditions}
              value={draft.condition}
              onChange={(v) => {
                if (!locked) change("condition", v);
              }}
            />
            <Field
              label="Mô tả món đồ *"
              value={draft.description}
              onChangeText={(v) => change("description", v)}
              multiline
              maxLength={10000}
              editable={!locked}
              placeholder="Tình trạng, phụ kiện và lỗi nếu có…"
            />
          </View>
          <View style={ui.panel}>
            <Text style={ui.heading}>Giá & nơi hẹn</Text>
            <Chips
              values={["Bán lại", "Trao đổi", "Tặng miễn phí"]}
              value={
                draft.kind === "Sell"
                  ? "Bán lại"
                  : draft.kind === "Gift"
                    ? "Tặng miễn phí"
                    : "Trao đổi"
              }
              onChange={(v) => {
                if (!locked)
                  change(
                    "kind",
                    v === "Bán lại"
                      ? "Sell"
                      : v === "Tặng miễn phí"
                        ? "Gift"
                        : "Exchange",
                  );
              }}
            />
            {draft.kind === "Sell" && (
              <Field
                label="Giá bán (đ) *"
                value={draft.price}
                onChangeText={(v) => change("price", v)}
                keyboardType="number-pad"
                editable={!locked}
                maxLength={40}
              />
            )}
            <Text style={ui.small}>{user.university}</Text>
            <Field
              label="Khu vực hẹn gặp *"
              value={draft.location}
              onChangeText={(v) => change("location", v)}
              maxLength={200}
              editable={!locked}
            />
          </View>
          <Notice text={error} />
          {!!error && <Button title="Thử gửi lại" soft disabled={locked || processing} onPress={() => void submit()} />}
          <Button
            title="Gửi tin đăng"
            loading={busy}
            disabled={locked || processing || offline}
            onPress={() => void submit()}
          />
          <Text style={ui.small}>
            Hãy kiểm tra thông tin trước khi gửi. Khi gửi lỗi, bản nháp vẫn được giữ.
            Khi gửi thành công, bản nháp và ảnh lưu trên máy được xóa. Gỡ app hoặc xóa dữ liệu app sẽ làm mất bản nháp.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
