import { join, resolve } from "node:path";

export const productImageDirectory = resolve(process.env.PRODUCT_IMAGE_DIR || join(process.cwd(), ".data", "product-images"));
export const productImageName = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpg|png|webp)$/i;
const imageTypes: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };
export function productImageMime(name: string) { return imageTypes[name.split(".").at(-1)?.toLowerCase() || ""]; }
export function imageExtension(bytes: Buffer) {
  if (bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return "jpg";
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "png";
  if (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}
