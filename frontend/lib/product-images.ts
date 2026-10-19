import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { ApiError } from "./api-error";
import { query } from "./db";
import { maxProductImageBytes } from "./product-image-config";
import { saveMedia, removeMedia } from "./media-storage";

import { productImageName, imageExtension } from "./product-image-files";
export { productImageDirectory, productImageName, productImageMime, imageExtension } from "./product-image-files";

const imageTypes: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

export async function saveProductImage(file: File) {
  if (file.size < 1 || file.size > maxProductImageBytes) throw new ApiError("Ảnh phải nhỏ hơn 5 MB.", 413);
  const bytes = Buffer.from(await file.arrayBuffer());
  const extension = imageExtension(bytes);
  if (!extension || (file.type && file.type !== imageTypes[extension]))
    throw new ApiError("Chỉ chấp nhận ảnh JPG, PNG hoặc WebP hợp lệ.");
  const name = `${randomUUID()}.${extension}`;
  await saveMedia("products", name, bytes);
  return `/api/product-images/${name}`;
}

export async function removeProductImage(url: string) {
  const name = url.startsWith("/api/product-images/") ? url.slice("/api/product-images/".length) : "";
  if (productImageName.test(name)) await removeMedia("products", name).catch(() => console.error("Storage cleanup failed; an unreferenced product image was retained."));
}

export async function removeUnusedProductImage(url: string) {
  if (!url.startsWith("/api/product-images/")) return;
  const references = await query("SELECT 1 FROM product_images WHERE image_url=$1 LIMIT 1", [url]);
  if (references.length === 0) await removeProductImage(url);
}

export async function readListingRequest(request: NextRequest) {
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data")) {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new ApiError("Dữ liệu tin đăng không hợp lệ.");
    return { body: body as Record<string, unknown>, file: null as File | null, files: [] as File[] };
  }
  if (Number(request.headers.get("content-length") || 0) > maxProductImageBytes * 8 + 100_000)
    throw new ApiError("Ảnh phải nhỏ hơn 5 MB.", 413);
  let form: FormData;
  try { form = await request.formData(); }
  catch { throw new ApiError("Dữ liệu biểu mẫu không hợp lệ."); }
  const body: Record<string, unknown> = {};
  for (const [key, value] of form.entries()) if (typeof value === "string") body[key] = value;
  const candidate = form.get("imageFile");
  if (candidate !== null && !(candidate instanceof File)) throw new ApiError("Tệp ảnh không hợp lệ.");
  const file = candidate instanceof File && candidate.size > 0 ? candidate : null;
  if (file && file.size > maxProductImageBytes) throw new ApiError("Ảnh phải nhỏ hơn 5 MB.", 413);
  const additional = form.getAll("imageFiles");
  if (additional.some(value => !(value instanceof File))) throw new ApiError("Tệp ảnh không hợp lệ.");
  const files = additional.filter((value): value is File => value instanceof File && value.size > 0);
  if (files.length > 8 || (file && files.length)) throw new ApiError("Chọn tối đa 8 ảnh.");
  if (files.some(image => image.size > maxProductImageBytes)) throw new ApiError("Ảnh phải nhỏ hơn 5 MB.", 413);
  return { body, file, files: file ? [file] : files };
}
