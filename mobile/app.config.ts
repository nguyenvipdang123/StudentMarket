import type { ConfigContext, ExpoConfig } from "expo/config";
import { palettes } from "./src/tokens.ts";
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name || "SangTay",
  slug: config.slug || "sangtay-mobile",
  userInterfaceStyle: "automatic",
  android: { ...config.android, adaptiveIcon: { ...config.android?.adaptiveIcon, backgroundColor: palettes.light.sage } },
  plugins: (config.plugins || []).map(plugin => Array.isArray(plugin) && plugin[0] === "expo-splash-screen"
    ? [plugin[0], { ...plugin[1], backgroundColor: palettes.light.cream, dark: { backgroundColor: palettes.dark.cream } }]
    : plugin),
});
