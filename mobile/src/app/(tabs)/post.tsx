import { useRef, useState } from "react";
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
import { Button, Chips, Empty, Field, Notice } from "../../components/UI";
import { colors, ui } from "../../theme";
const initial = {
  title: "",
  description: "",
  price: "",
  location: "Khuôn viên trường",
  kind: "Sell",
  category: "Học tập",
  condition: "Như mới",
};
export default function Post() {
  const { user } = useSession();
  // Switching accounts discards the previous account's unsent listing and photos.
  return <PostForm key={user?.pgUserId || user?.id || "guest"} />;
}
function PostForm() {
  const { user } = useSession();
  const [draft, setDraft] = useState(initial),
    [photos, setPhotos] = useState<ImagePicker.ImagePickerAsset[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const pending = useRef(false);
  const change = (key: keyof typeof initial, value: string) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setError("");
  };
  async function pick() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        selectionLimit: 8 - photos.length,
        quality: 0.85,
      });
      if (result.canceled) return;
      if (
        result.assets.some(
          (a) =>
            (a.fileSize || 0) > 5 * 1024 * 1024 ||
            !["image/jpeg", "image/png", "image/webp"].includes(
              a.mimeType || "",
            ),
        )
      ) {
        setError("Chọn ảnh JPG, PNG hoặc WebP, mỗi ảnh tối đa 5 MB.");
        return;
      }
      setPhotos((old) => [...old, ...result.assets].slice(0, 8));
      setError("");
    } catch (e) {
      setError(message(e));
    }
  }
  async function submit() {
    if (pending.current) return;
    const invalid = validateDraft(draft);
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
      photos.forEach((photo, index) =>
        form.append("imageFiles", {
          uri: photo.uri,
          name: photo.fileName || `photo-${index}.jpg`,
          type: photo.mimeType || "image/jpeg",
        } as unknown as Blob),
      );
      await request("/api/products", { method: "POST", body: form }, 60000);
      setDraft(initial);
      setPhotos([]);
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
      setError(message(e));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  if (!user)
    return (
      <SafeAreaView style={ui.screen} edges={["top"]}>
        <View style={ui.content}>
          <Text style={ui.title}>Sang tay món đồ</Text>
          <Empty
            title="Đăng nhập để đăng tin"
            detail="Dùng tài khoản sinh viên đã xác minh của bạn."
            action="Đăng nhập"
            onPress={() => router.push("/login")}
          />
        </View>
      </SafeAreaView>
    );
  if (user.role !== "student")
    return (
      <SafeAreaView style={ui.screen} edges={["top"]}>
        <View style={ui.content}>
          <Empty
            title="Đăng tin dành cho sinh viên"
            detail="Hãy dùng tài khoản sinh viên để đăng món đồ."
          />
        </View>
      </SafeAreaView>
    );
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
          <Text style={ui.small}>
            Đăng tin miễn phí · Tin mới sẽ được kiểm duyệt.
          </Text>
          <View style={ui.panel}>
            <Text style={ui.heading}>Ảnh món đồ · {photos.length}/8</Text>
            <Text style={ui.small}>
              Ảnh đầu tiên là ảnh bìa. JPG, PNG, WebP · tối đa 5 MB/ảnh.
            </Text>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {photos.map((photo, i) => (
                <View key={photo.uri + i}>
                  <Image
                    source={photo.uri}
                    style={{ width: 88, height: 88, borderRadius: 12 }}
                  />
                  <Pressable
                    disabled={busy}
                    accessibilityLabel={`Xóa ảnh ${i + 1}`}
                    onPress={() =>
                      setPhotos((old) => old.filter((_, n) => n !== i))
                    }
                    style={{
                      position: "absolute",
                      right: 2,
                      top: 2,
                      backgroundColor: "white",
                      padding: 8,
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
              disabled={busy || photos.length >= 8}
              onPress={() => void pick()}
            />
          </View>
          <View style={ui.panel}>
            <Field
              label="Tên món đồ *"
              value={draft.title}
              onChangeText={(v) => change("title", v)}
              maxLength={200}
              editable={!busy}
              placeholder="Ví dụ: Đèn bàn học màu kem"
            />
            <Text style={ui.label}>Danh mục</Text>
            <Chips
              values={categories.slice(1)}
              value={draft.category}
              onChange={(v) => {
                if (!busy) change("category", v);
              }}
            />
            <Text style={ui.label}>Tình trạng</Text>
            <Chips
              values={conditions}
              value={draft.condition}
              onChange={(v) => {
                if (!busy) change("condition", v);
              }}
            />
            <Field
              label="Mô tả món đồ *"
              value={draft.description}
              onChangeText={(v) => change("description", v)}
              multiline
              maxLength={10000}
              editable={!busy}
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
                if (!busy)
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
                editable={!busy}
              />
            )}
            <Text style={ui.small}>{user.university}</Text>
            <Field
              label="Khu vực hẹn gặp *"
              value={draft.location}
              onChangeText={(v) => change("location", v)}
              maxLength={200}
              editable={!busy}
            />
          </View>
          <Notice text={error} />
          <Button
            title="Gửi tin đăng"
            loading={busy}
            onPress={() => void submit()}
          />
          <Text style={ui.small}>
            Hãy kiểm tra thông tin trước khi gửi. Khi lỗi, nội dung và ảnh vẫn
            giữ trong màn hình này.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
