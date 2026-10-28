import { createContext, createElement, useContext, useMemo, useState, type ReactNode } from "react";
import { StyleSheet, useColorScheme } from "react-native";
import { palettes, type Palette } from "./tokens";
export type ThemeMode = "system" | "light" | "dark";
export const createUi = (colors: Palette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  content: { padding: 20, gap: 18, paddingBottom: 40 },
  title: {
    fontFamily: "Serif",
    fontSize: 32,
    color: colors.dark,
    lineHeight: 40,
  },
  heading: { fontFamily: "Bold", fontSize: 19, color: colors.dark },
  body: {
    fontFamily: "Regular",
    fontSize: 14,
    lineHeight: 23,
    color: colors.ink,
  },
  small: {
    fontFamily: "Regular",
    fontSize: 12,
    lineHeight: 19,
    color: colors.muted,
  },
  eyebrow: {
    fontFamily: "Bold",
    fontSize: 10,
    letterSpacing: 2,
    color: colors.green,
    textTransform: "uppercase",
  },
  panel: {
    padding: 18,
    borderRadius: 22,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 12,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  between: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  label: {
    fontFamily: "Semi",
    fontSize: 13,
    color: colors.ink,
    marginBottom: 7,
  },
  input: {
    fontFamily: "Regular",
    fontSize: 14,
    color: colors.ink,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    borderRadius: 14,
    padding: 14,
    minHeight: 50,
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: colors.sage,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  badgeText: { fontFamily: "Semi", fontSize: 10, color: colors.green },
});

type Theme = { colors: Palette; ui: ReturnType<typeof createUi>; scheme: "light" | "dark"; mode: ThemeMode; setMode: (mode: ThemeMode) => void };
const ThemeContext = createContext<Theme | null>(null);
export function ThemeProvider({ children, initialMode = "system" }: { children: ReactNode; initialMode?: ThemeMode }) {
  const device = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>(initialMode);
  const scheme = mode === "system" ? device === "dark" ? "dark" : "light" : mode;
  const value = useMemo(() => ({ colors: palettes[scheme], ui: createUi(palettes[scheme]), scheme, mode, setMode }), [scheme, mode]);
  return createElement(ThemeContext.Provider, { value }, children);
}
export function useTheme() {
  const theme = useContext(ThemeContext);
  if (!theme) throw Error("ThemeProvider missing");
  return theme;
}
