// The only source of colour literals for the mobile app, native config and tests.
export const palettes = {
  light: {
    cream: "#F7F5EC", paper: "#FFFEFA", green: "#235E46", dark: "#163D2D",
    sage: "#E8F0E2", line: "#667C6B", muted: "#4E6356", ink: "#243D32",
    peach: "#F6E3D2", error: "#923C2C", errorBackground: "#FFF0E9",
    onAccent: "#FFFFFF", brand: "#995022", overlay: "rgba(16,27,23,0.55)",
  },
  dark: {
    cream: "#101B17", paper: "#192920", green: "#91D9B2", dark: "#F1F7F3",
    sage: "#253B30", line: "#91AA9B", muted: "#B0C7B8", ink: "#E6F1E9",
    peach: "#3B2D22", error: "#FFB5A3", errorBackground: "#3C211C",
    onAccent: "#102319", brand: "#F4BB89", overlay: "rgba(0,0,0,0.65)",
  },
} as const;
export type Palette = { [K in keyof typeof palettes.light]: string };
export function contrastRatio(a: string, b: string) {
  const luminance = (hex: string) => {
    const channels = [1, 3, 5].map(i => Number.parseInt(hex.slice(i, i + 2), 16) / 255)
      .map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
