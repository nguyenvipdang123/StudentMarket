import { join, resolve, relative, isAbsolute } from "node:path";
import { productImageDirectory, productImageName } from "./product-image-files.ts";

export type MediaKind = "products" | "cards" | "chat";
export const maxMediaBytes = 5 * 1024 * 1024;
export const studentCardDirectory = resolve(process.env.STUDENT_CARD_DIR || join(process.cwd(), ".data", "student-cards"));
export const chatImageDirectory = resolve(process.env.CHAT_ATTACHMENT_DIR || join(process.cwd(), ".data", "chat-attachments"));
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validMediaKey(kind: MediaKind, key: string) {
  if (kind !== "chat") return productImageName.test(key);
  const parts = key.split("/");
  return parts.length === 2 && uuid.test(parts[0]) && productImageName.test(parts[1]);
}
export function mediaRoot(kind: MediaKind) { return kind === "products" ? productImageDirectory : kind === "cards" ? studentCardDirectory : chatImageDirectory; }
export function mediaLocalPath(kind: MediaKind, key: string) {
  if (!validMediaKey(kind, key)) throw new Error("Invalid media key");
  return join(mediaRoot(kind), ...key.split("/"));
}
export function studentCardKey(reference: string) {
  if (reference.startsWith("media:cards/")) {
    const key = reference.slice("media:cards/".length);
    return validMediaKey("cards", key) ? key : null;
  }
  const distance = relative(studentCardDirectory, resolve(reference));
  return distance && !distance.startsWith("..") && !isAbsolute(distance) && validMediaKey("cards", distance) ? distance : null;
}
