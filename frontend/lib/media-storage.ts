import { mkdir, open, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { validMediaKey, mediaLocalPath, maxMediaBytes, type MediaKind } from "./media-files.ts";
import { productImageMime, imageExtension } from "./product-image-files.ts";
import { MediaStorageError } from "./media-storage-error.ts";

export { MediaStorageError } from "./media-storage-error.ts";
export function mediaStorageConfig() {
  return { provider: process.env.MEDIA_STORAGE_PROVIDER || "local", url: (process.env.SUPABASE_URL || "").replace(/\/$/, ""),
    secret: process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    buckets: { products: process.env.SUPABASE_PRODUCT_BUCKET || "studentmarket-products", cards: process.env.SUPABASE_CARD_BUCKET || "studentmarket-cards", chat: process.env.SUPABASE_CHAT_BUCKET || "studentmarket-chat" } };
}
export function missingMediaSettings(requireSupabase = false) {
  const c = mediaStorageConfig(), missing: string[] = [];
  if (!["local", "supabase"].includes(c.provider)) missing.push("MEDIA_STORAGE_PROVIDER");
  if (!requireSupabase && c.provider === "local") return missing;
  try { const u = new URL(c.url); if (u.protocol !== "https:" || u.username || u.password || u.search || u.hash || u.pathname !== "/") missing.push("SUPABASE_URL"); }
  catch { missing.push("SUPABASE_URL"); }
  let keyOK = /^sb_secret_[A-Za-z0-9_-]+$/.test(c.secret);
  if (!keyOK) { try { keyOK = JSON.parse(Buffer.from(c.secret.split(".")[1], "base64url").toString()).role === "service_role"; } catch { /* Reject public and malformed keys. */ } }
  if (!keyOK) missing.push("SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY");
  if (new Set(Object.values(c.buckets)).size !== 3 || Object.values(c.buckets).some(b => !/^[a-z0-9][a-z0-9-]{2,62}$/.test(b))) missing.push("SUPABASE_*_BUCKET (3 bucket riêng biệt)");
  return missing;
}
function configured(requireSupabase = false) {
  if (missingMediaSettings(requireSupabase).length) throw new MediaStorageError(503, "Kho ảnh chưa được cấu hình đầy đủ. Vui lòng liên hệ Admin.");
  return mediaStorageConfig();
}
/** Never forward credentials through redirects or expose provider error bodies to callers. */
export async function storageRequest(path: string, init: RequestInit = {}) {
  const c = configured(true);
  const headers = new Headers(init.headers);
  headers.set("apikey", c.secret);
  if (!c.secret.startsWith("sb_secret_")) headers.set("Authorization", `Bearer ${c.secret}`);
  try { return await fetch(`${c.url}/storage/v1/${path}`, { ...init, headers, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(15000) }); }
  catch { throw new MediaStorageError(503); }
}
async function responseOK(response: Response) {
  if (response.ok) return;
  let status = response.status;
  try { const body = await response.json(); if (Number(body.statusCode) === 404) status = 404; } catch { /* Do not log provider errors. */ }
  if (status === 404) throw new MediaStorageError(404, "Không tìm thấy ảnh.");
  if (status === 409) throw new MediaStorageError(409, "Ảnh đã tồn tại trong kho lưu trữ.");
  throw new MediaStorageError(503);
}
const bucketChecks = new Map<string, number>();
export async function checkMediaBucket(kind: MediaKind, create = false) {
  const c = configured(true), bucket = c.buckets[kind];
  let response = await storageRequest(`bucket/${bucket}`);
  if (!response.ok && create) {
    try { await responseOK(response); }
    catch (error) {
      if (!(error instanceof MediaStorageError) || error.status !== 404) throw error;
      const created = await storageRequest("bucket", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: bucket, name: bucket, public: kind === "products", file_size_limit: maxMediaBytes, allowed_mime_types: ["image/jpeg", "image/png", "image/webp"] }) });
      await responseOK(created);
      response = await storageRequest(`bucket/${bucket}`);
    }
  }
  await responseOK(response);
  let info;
  try { info = await response.json(); } catch { throw new MediaStorageError(503); }
  if (info.public !== (kind === "products")) throw new MediaStorageError(503, `Bucket ${bucket} cần đặt ${kind === "products" ? "Public" : "Private"} trước khi sử dụng.`);
  bucketChecks.set(`${c.url}/${bucket}`, Date.now());
  return { bucket, public: Boolean(info.public) };
}
async function checkedBucket(kind: MediaKind) {
  const c = configured(true), bucket = c.buckets[kind];
  if (Date.now() - (bucketChecks.get(`${c.url}/${bucket}`) || 0) > 60000) await checkMediaBucket(kind);
  return bucket;
}
function validate(kind: MediaKind, key: string) {
  if (!validMediaKey(kind, key)) throw new MediaStorageError(404, "Không tìm thấy ảnh.");
}
function validBytes(key: string, bytes: Buffer) {
  if (!bytes.length || bytes.length > maxMediaBytes || imageExtension(bytes) !== key.split(".").at(-1)?.toLowerCase()) throw new MediaStorageError(413, "Ảnh JPG, PNG hoặc WebP phải nhỏ hơn 5 MB.");
}
async function readLocalMedia(kind: MediaKind, key: string) {
    let file;
    try {
      file = await open(mediaLocalPath(kind, key), "r"); const stat = await file.stat();
      if (!stat.isFile() || stat.size > maxMediaBytes) throw new MediaStorageError(413, "Ảnh không hợp lệ hoặc quá lớn.");
      const bytes = await file.readFile(); validBytes(key, bytes); return bytes;
    } catch (error) { if (error instanceof MediaStorageError) throw error; throw new MediaStorageError(404, "Không tìm thấy ảnh."); }
    finally { await file?.close(); }
}
export async function readMedia(kind: MediaKind, key: string, forceSupabase = false): Promise<Buffer> {
  validate(kind, key); const c = configured(forceSupabase);
  if (c.provider === "local" && !forceSupabase) return readLocalMedia(kind, key);
  const bucket = await checkedBucket(kind), response = await storageRequest(`object/authenticated/${bucket}/${key}`);
  try { await responseOK(response); }
  catch (error) {
    if (!forceSupabase && process.env.MEDIA_STORAGE_READ_LOCAL_FALLBACK === "true" && error instanceof MediaStorageError && error.status === 404) return readLocalMedia(kind, key);
    throw error;
  }
  if (Number(response.headers.get("content-length") || 0) > maxMediaBytes) { await response.body?.cancel(); throw new MediaStorageError(413, "Ảnh quá lớn."); }
  const reader = response.body?.getReader(); if (!reader) throw new MediaStorageError(503);
  const chunks: Uint8Array[] = []; let length = 0;
  try {
    while (true) { const { value, done } = await reader.read(); if (done) break; length += value.length; if (length > maxMediaBytes) { await reader.cancel(); throw new MediaStorageError(413, "Ảnh quá lớn."); } chunks.push(value); }
  } catch (error) { if (error instanceof MediaStorageError) throw error; throw new MediaStorageError(503); }
  const bytes = Buffer.concat(chunks); validBytes(key, bytes); return bytes;
}
export async function saveMedia(kind: MediaKind, key: string, bytes: Buffer, forceSupabase = false) {
  validate(kind, key); validBytes(key, bytes); const c = configured(forceSupabase);
  if (c.provider === "local" && !forceSupabase) {
    const path = mediaLocalPath(kind, key); await mkdir(dirname(path), { recursive: true }); await writeFile(path, bytes, { flag: "wx", mode: 0o600 }); return;
  }
  const bucket = await checkedBucket(kind);
  const response = await storageRequest(`object/${bucket}/${key}`, { method: "POST", headers: { "Content-Type": productImageMime(key), "x-upsert": "false", "Cache-Control": kind === "products" ? "max-age=31536000" : "max-age=0" }, body: new Uint8Array(bytes) });
  await responseOK(response);
}
export async function removeMedia(kind: MediaKind, key: string) {
  validate(kind, key); const c = configured();
  if (c.provider === "local") { await unlink(mediaLocalPath(kind, key)).catch(error => { if (error.code !== "ENOENT") throw error; }); return; }
  const bucket = await checkedBucket(kind);
  const response = await storageRequest(`object/${bucket}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prefixes: [key] }) });
  await responseOK(response);
}
