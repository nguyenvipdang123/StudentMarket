import { useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { SOUTHERN_UNIVERSITIES, universityMatchesQuery } from "../data/universities";
import { useTheme } from "../theme";

export function SchoolPicker({ value, onChange }: {
  value: string;
  onChange: (school: string) => void;
}) {
  const { colors, ui } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const insets = useSafeAreaInsets();
  const matches = SOUTHERN_UNIVERSITIES.filter(school => universityMatchesQuery(school, query));
  function close() {
    setOpen(false);
    setQuery("");
  }
  function select(school: string) {
    onChange(school);
    close();
  }
  return (
    <>
      <View style={[ui.row, { marginHorizontal: 20 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Lọc theo trường: ${value || "Tất cả trường"}`}
          accessibilityState={{ expanded: open }}
          onPress={() => setOpen(true)}
          style={[ui.row, { flex: 1, minHeight: 66, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: value ? colors.green : colors.line, backgroundColor: colors.paper }]}
        >
          <Ionicons name="school-outline" size={23} color={colors.green} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[ui.small, { fontSize: 10 }]}>TRƯỜNG ĐẠI HỌC</Text>
            <Text numberOfLines={2} style={{ fontFamily: "Semi", fontSize: 13, color: colors.green }}>{value || "Tất cả trường"}</Text>
          </View>
          <Ionicons name="chevron-down" size={18} color={colors.green} />
        </Pressable>
        {value ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Bỏ lọc trường" onPress={() => onChange("")} style={{ padding: 12, minHeight: 44, justifyContent: "center" }}>
            <Ionicons name="close-circle-outline" size={25} color={colors.green} />
          </Pressable>
        ) : null}
      </View>
      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, justifyContent: "flex-end", backgroundColor: colors.overlay }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Đóng chọn trường" onPress={close} style={{ flex: 1, minWidth: 44, minHeight: 44 }} />
          <View accessibilityViewIsModal style={{ maxHeight: "85%", flexShrink: 1, backgroundColor: colors.paper, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, paddingBottom: Math.max(insets.bottom, 16), gap: 14 }}>
            <View style={ui.between}>
              <View style={{ flex: 1 }}>
                <Text style={ui.heading}>Chọn trường đại học</Text>
                <Text style={ui.small}>Tìm món đồ gần trường của bạn.</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Đóng danh sách trường" onPress={close} style={{ padding: 12 }}>
                <Ionicons name="close" size={23} color={colors.green} />
              </Pressable>
            </View>
            <TextInput
              role="searchbox"
              accessibilityLabel="Tìm tên hoặc mã trường"
              placeholder="Tên trường hoặc mã, ví dụ DNTU"
              placeholderTextColor={colors.muted}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              style={ui.input}
            />
            <Pressable accessibilityRole="button" accessibilityLabel="Tất cả trường" accessibilityState={{ selected: !value }} onPress={() => select("")} style={[ui.row, { padding: 14, minWidth: 44, minHeight: 44, backgroundColor: colors.sage, borderRadius: 14 }]}>
              <Ionicons name="earth-outline" size={21} color={colors.green} />
              <Text style={[ui.body, { flex: 1, fontFamily: "Semi" }]}>Tất cả trường</Text>
              {!value && <Ionicons name="checkmark-circle" size={22} color={colors.green} />}
            </Pressable>
            <FlatList
              style={{ flexGrow: 0, flexShrink: 1 }}
              data={matches}
              keyExtractor={school => school.code}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable accessibilityRole="button" accessibilityLabel={`${item.name}, ${item.code}`} accessibilityState={{ selected: value === item.name }} onPress={() => select(item.name)} style={[ui.row, { padding: 14, borderRadius: 12, backgroundColor: value === item.name ? colors.sage : colors.paper }]}>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={[ui.body, { fontFamily: "Semi" }]}>{item.name}</Text>
                    <Text style={ui.small}>{item.code}</Text>
                  </View>
                  {value === item.name && <Ionicons name="checkmark-circle" size={22} color={colors.green} />}
                </Pressable>
              )}
              ListEmptyComponent={<Text style={[ui.small, { padding: 14 }]}>Không tìm thấy trường. Thử tên hoặc mã viết tắt khác.</Text>}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
