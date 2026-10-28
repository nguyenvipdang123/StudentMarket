import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme";
export function Button({
  title,
  onPress,
  loading = false,
  soft = false,
  disabled = false,
  label,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  soft?: boolean;
  disabled?: boolean;
  label?: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label || title}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 50,
        minWidth: 44,
        padding: 14,
        borderRadius: 15,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: soft ? colors.sage : colors.green,
        opacity: disabled || loading ? 0.6 : pressed ? 0.8 : 1,
      })}
    >
      {loading ? (
        <ActivityIndicator color={soft ? colors.green : colors.onAccent} />
      ) : (
        <Text
          style={{
            fontFamily: "Bold",
            fontSize: 13,
            color: soft ? colors.green : colors.onAccent,
          }}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const { colors, ui } = useTheme();
  return (
    <View>
      <Text style={ui.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        style={[
          ui.input,
          props.multiline && { height: 130, textAlignVertical: "top" },
        ]}
        {...props}
      />
    </View>
  );
}
export function Notice({ text }: { text: string }) {
  const { colors, ui } = useTheme();
  return text ? (
    <View
      accessible
      accessibilityRole="alert"
      style={{ padding: 14, borderRadius: 14, backgroundColor: colors.errorBackground }}
    >
      <Text style={[ui.small, { color: colors.error }]}>{text}</Text>
    </View>
  ) : null;
}
export function Empty({
  title,
  detail,
  action,
  onPress,
}: {
  title: string;
  detail: string;
  action?: string;
  onPress?: () => void;
}) {
  const { colors, ui } = useTheme();
  return (
    <View style={[ui.panel, { alignItems: "center", paddingVertical: 32 }]}>
      <Ionicons name="leaf-outline" size={34} color={colors.green} />
      <Text style={ui.heading}>{title}</Text>
      <Text style={[ui.body, { textAlign: "center" }]}>{detail}</Text>
      {action && onPress && <Button title={action} onPress={onPress} />}
    </View>
  );
}
export function Chips({
  values,
  value,
  onChange,
}: {
  values: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {values.map((item) => (
        <Pressable
          key={item}
          accessibilityRole="button"
          accessibilityLabel={item}
          accessibilityState={{ selected: item === value }}
          onPress={() => onChange(item)}
          style={{
            paddingHorizontal: 13,
            minHeight: 44,
            minWidth: 44,
            justifyContent: "center",
            paddingVertical: 11,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: item === value ? colors.green : colors.line,
            backgroundColor: item === value ? colors.green : colors.paper,
          }}
        >
          <Text
            style={{
              fontFamily: "Semi",
              fontSize: 12,
              color: item === value ? colors.onAccent : colors.green,
            }}
          >
            {item}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
