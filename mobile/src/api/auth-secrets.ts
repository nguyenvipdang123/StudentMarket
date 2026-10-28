import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
export type GoogleFlow = { flowId: string; verifier: string; expiresAt: number };
export type GoogleProfile = { pendingToken: string; email: string; fullName: string; expiresAt: number };
const key = (origin: string, kind: "flow" | "profile") => `sangtay.google.${origin.replace(/[^a-z0-9.-]/gi, "_")}.${kind}`;
export async function saveGoogleSecret(origin: string, kind: "flow", value: GoogleFlow): Promise<void>;
export async function saveGoogleSecret(origin: string, kind: "profile", value: GoogleProfile): Promise<void>;
export async function saveGoogleSecret(origin: string, kind: "flow" | "profile", value: GoogleFlow | GoogleProfile) {
  if (Platform.OS === "web") throw Error("Dùng Expo Go trên Android/iOS để lưu phiên Google an toàn.");
  await SecureStore.setItemAsync(key(origin, kind), JSON.stringify(value), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
}
export async function readGoogleSecret(origin: string, kind: "flow"): Promise<GoogleFlow | null>;
export async function readGoogleSecret(origin: string, kind: "profile"): Promise<GoogleProfile | null>;
export async function readGoogleSecret(origin: string, kind: "flow" | "profile") {
  if (Platform.OS === "web") return null;
  const raw = await SecureStore.getItemAsync(key(origin, kind));
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (!Number.isFinite(v.expiresAt) || v.expiresAt <= Date.now() || v.expiresAt > Date.now() + 660000 ||
      (kind === "flow" ? !/^[A-Za-z0-9_-]{43}$/.test(v.flowId) || !/^[a-f0-9]{64}$/.test(v.verifier) : !/^[A-Za-z0-9_-]{43}$/.test(v.pendingToken) || typeof v.email !== "string" || typeof v.fullName !== "string")) throw Error("Expired");
    return v;
  } catch { await removeGoogleSecret(origin, kind); return null; }
}
export async function removeGoogleSecret(origin: string, kind: "flow" | "profile") {
  if (Platform.OS !== "web") await SecureStore.deleteItemAsync(key(origin, kind));
}
