import { readdir, open, mkdir, writeFile } from "node:fs/promises";
import { join, resolve, relative } from "node:path";
import { createHash } from "node:crypto";
import pg from "pg";
import {databaseConfig} from '../lib/database-config.mjs';

try { process.loadEnvFile(".env.local"); } catch (e) { if (e.code !== "ENOENT") throw e; }
const { mediaStorageConfig, missingMediaSettings, checkMediaBucket, readMedia, saveMedia, MediaStorageError } = await import("../lib/media-storage.ts");
const { mediaRoot, mediaLocalPath, studentCardKey, validMediaKey, maxMediaBytes } = await import("../lib/media-files.ts");
const { imageExtension } = await import("../lib/product-image-files.ts");
const action = process.argv[2] || "check", apply = process.argv.includes("--apply");
const legacyArg = process.argv.indexOf("--legacy-card-dir");
if (legacyArg !== -1 && (!process.argv[legacyArg + 1] || process.argv[legacyArg + 1].startsWith("--"))) { console.error("Thiếu đường dẫn --legacy-card-dir."); process.exit(1); }
const legacyCardDir = legacyArg === -1 ? null : resolve(process.argv[legacyArg + 1]);
const missing = missingMediaSettings(true);
if (missing.length) { console.error("Cần cấu hình: " + missing.join(", ")); process.exit(1); }
if (!["check", "setup", "migrate"].includes(action)) { console.error("Dùng check, setup hoặc migrate [--apply]."); process.exit(1); }
try {
  for (const kind of ["products", "cards", "chat"]) {
    const result = await checkMediaBucket(kind, action === "setup");
    console.log(`${result.bucket}: ${result.public ? "Public" : "Private"} — OK`);
  }
  if (action !== "migrate") { console.log("Storage configuration is ready. Current provider: " + mediaStorageConfig().provider); process.exit(0); }
} catch (error) { console.error(error instanceof MediaStorageError ? error.message : "Không kiểm tra được Supabase Storage."); process.exit(1); }

const db = new pg.Client(databaseConfig());
const items = new Map(), cardReferences = [];
const counts = { planned: 0, uploaded: 0, verified: 0, failed: 0, cardsUpdated: 0, invalidReferences: 0 };
function add(kind, key) {
  if (!validMediaKey(kind, key)) { counts.invalidReferences++; return; }
  items.set(kind + "/" + key, { kind, key });
}
async function localInventory(kind) {
  let files; try { files = await readdir(mediaRoot(kind), { withFileTypes: true }); } catch (e) { if (e.code === "ENOENT") return; throw e; }
  for (const file of files) {
    if (kind === "chat" && file.isDirectory() && /^[0-9a-f-]{36}$/i.test(file.name)) {
      const children = await readdir(join(mediaRoot(kind), file.name), { withFileTypes: true });
      for (const child of children) if (child.isFile() && validMediaKey(kind, file.name + "/" + child.name)) add(kind, file.name + "/" + child.name);
    } else if (file.isFile() && validMediaKey(kind, file.name)) add(kind, file.name);
  }
}
async function localBytes(kind, key) {
  let file;
  try {
    file = await open(mediaLocalPath(kind, key), "r"); const info = await file.stat();
    if (!info.isFile() || info.size > maxMediaBytes) throw new Error("Invalid file");
    const bytes = await file.readFile();
    if (!bytes.length || bytes.length > maxMediaBytes || imageExtension(bytes) !== key.split(".").at(-1).toLowerCase()) throw new Error("Invalid file");
    return bytes;
  } catch (e) { if (e.code === "ENOENT") return null; throw e; }
  finally { await file?.close(); }
}
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
try {
  await db.connect();
  if (process.argv.includes("--include-unreferenced")) for (const kind of ["products", "cards", "chat"]) await localInventory(kind);
  const images = await db.query("SELECT DISTINCT image_url FROM product_images WHERE image_url LIKE '/api/product-images/%'");
  for (const row of images.rows) add("products", row.image_url.slice("/api/product-images/".length));
  const cards = await db.query("SELECT id::text,card_path FROM users WHERE card_path IS NOT NULL");
  for (const row of cards.rows) {
    let key = studentCardKey(row.card_path);
    // Only repair a renamed project folder when the operator explicitly identifies the old card directory.
    // Read the same UUID file from the current configured card directory, never an arbitrary database path.
    if (!key && legacyCardDir) {
      const moved = relative(legacyCardDir, resolve(row.card_path));
      if (validMediaKey("cards", moved)) key = moved;
    }
    if (!key) { counts.invalidReferences++; continue; }
    add("cards", key); cardReferences.push({ id: row.id, previous: row.card_path, key });
  }
  const chat = await db.query("SELECT regexp_matches(content, '/api/conversations/([0-9a-f-]{36})/attachments/([0-9a-f-]{36}[.](?:jpg|png|webp))', 'gi') AS ref FROM messages WHERE content LIKE '%/attachments/%'");
  for (const row of chat.rows) add("chat", row.ref[0] + "/" + row.ref[1]);
  counts.planned = items.size;
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", ...counts }));
  const completed = new Set(), report = [];
  if (apply) {
    for (const [identity, item] of items) {
      try {
        const source = await localBytes(item.kind, item.key);
        let remote;
        try { remote = await readMedia(item.kind, item.key, true); }
        catch (e) { if (!(e instanceof MediaStorageError) || e.status !== 404) throw e; }
        if (remote) {
          if (source && hash(source) !== hash(remote)) throw new Error("Remote content differs; never overwrite existing data");
          counts.verified++;
        } else {
          if (!source) throw new Error("Source image missing");
          await saveMedia(item.kind, item.key, source, true);
          remote = await readMedia(item.kind, item.key, true);
          if (hash(source) !== hash(remote)) throw new Error("Checksum mismatch");
          counts.uploaded++;
        }
        completed.add(identity); report.push({ ...item, status: "verified" });
      } catch { counts.failed++; report.push({ ...item, status: "failed" }); }
      if ((counts.uploaded + counts.verified + counts.failed) % 10 === 0) console.log(JSON.stringify(counts));
    }
    for (const card of cardReferences) {
      if (!completed.has("cards/" + card.key)) continue;
      const next = "media:cards/" + card.key;
      if (card.previous !== next) counts.cardsUpdated += (await db.query("UPDATE users SET card_path=$2 WHERE id=$1 AND card_path=$3", [card.id, next, card.previous])).rowCount;
    }
    await mkdir(resolve("../.backups"), { recursive: true });
    const reportPath = resolve("../.backups/storage-migration-" + Date.now() + ".json");
    await writeFile(reportPath, JSON.stringify({ counts, items: report, cardReferences }, null, 2), { mode: 0o600 });
    console.log("Report: " + reportPath);
  }
  console.log(JSON.stringify({ ...counts, applied: apply, localFilesDeleted: false }));
  if (counts.failed || counts.invalidReferences) process.exitCode = 1;
  if (!apply) console.log("Chưa chuyển ảnh. Chạy lại với --apply để sao chép và kiểm tra checksum.");
} catch { console.error("Không hoàn tất chuyển ảnh. Giữ nguyên file local; kiểm tra cấu hình database và báo cáo."); process.exitCode = 1; }
finally { await db.end().catch(() => {}); }
