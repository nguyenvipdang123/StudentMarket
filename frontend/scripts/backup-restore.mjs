import { mkdir, readFile, writeFile, copyFile, rename, lstat } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import pg from "pg";
import { verifyBackup, describeFiles, validateDatabase, quoteIdentifier as qi, runTool, restoreEnvironment } from "./helpers/backup-tools.mjs";

const frontend = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(frontend);
try { process.loadEnvFile(".env.local"); } catch (e) { if (e.code !== "ENOENT") throw e; }
const { readMedia, mediaStorageConfig, missingMediaSettings } = await import("../lib/media-storage.ts");
const { studentCardKey, validMediaKey } = await import("../lib/media-files.ts");
const root = resolve(frontend, ".."), backupRoot = join(root, ".backups", "snapshots");
const settings = { host: process.env.PG_HOST || "localhost", port: Number(process.env.PG_PORT || 5432), user: process.env.PG_USER || "postgres", password: process.env.PG_PASSWORD };
const live = process.env.PG_DATABASE || "student_market";
const pgEnv = { ...process.env, PGPASSWORD: settings.password || "", PGSSLMODE: process.env.PGSSLMODE || "prefer" };
const pgBin = process.env.PG_BIN || (process.platform === "win32" ? "C:/Program Files/PostgreSQL/16/bin" : "");
const executable = name => pgBin ? join(pgBin, name + (process.platform === "win32" ? ".exe" : "")) : name;
const pgArgs = database => ["--host", settings.host, "--port", String(settings.port), "--username", settings.user, "--no-password", "--dbname", database];
const id = () => new Date().toISOString().replace(/[:.]/g, "-") + "-" + randomBytes(3).toString("hex");
const args = process.argv.slice(2), action = args.shift() || "help";
function flag(name) {
  const index = args.indexOf(name);
  if (index < 0) return null;
  if (!args[index + 1] || args[index + 1].startsWith("--")) throw new Error("Thiếu giá trị " + name);
  const value = args[index + 1]; args.splice(index, 2); return value;
}
async function exclusiveDirectory(path) { await mkdir(dirname(path), { recursive: true }); await mkdir(path, { mode: 0o700 }); }
async function put(directory, path, bytes) { const file = join(directory, ...path.split("/")); await mkdir(dirname(file), { recursive: true }); await writeFile(file, bytes, { flag: "wx", mode: 0o600 }); }
async function tableCounts(db) {
  const tables = await db.query("SELECT schemaname AS schema, tablename AS name FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema') AND schemaname NOT LIKE 'pg_toast%' ORDER BY schemaname,tablename");
  const result = [];
  for (const table of tables.rows) result.push({ ...table, rows: (await db.query(`SELECT count(*)::text AS n FROM ${qi(table.schema)}.${qi(table.name)}`)).rows[0].n });
  return result;
}
async function inventory(db) {
  const items = new Map(), cards = [];
  function add(kind, key) { if (!validMediaKey(kind, key)) throw new Error("Database có tham chiếu ảnh không hợp lệ; sửa trước khi sao lưu."); items.set(kind + "/" + key, { kind, key }); }
  for (const row of (await db.query("SELECT DISTINCT image_url FROM product_images WHERE image_url LIKE '/api/product-images/%'")).rows) add("products", row.image_url.slice("/api/product-images/".length));
  for (const row of (await db.query("SELECT id::text,card_path FROM users WHERE card_path IS NOT NULL")).rows) {
    const key = studentCardKey(row.card_path);
    if (!key) throw new Error("Tham chiếu thẻ sinh viên không hợp lệ; chạy storage:migrate trước.");
    add("cards", key); cards.push({ id: row.id, key });
  }
  for (const row of (await db.query("SELECT regexp_matches(content, '/api/conversations/([0-9a-f-]{36})/attachments/([0-9a-f-]{36}[.](?:jpg|png|webp))', 'gi') AS ref FROM messages WHERE content LIKE '%/attachments/%'")).rows) add("chat", row.ref[0] + "/" + row.ref[1]);
  return { media: [...items.values()], cards };
}
async function backup() {
  if (args.length) throw new Error("backup không nhận tham số. Đích mặc định: .backups/snapshots.");
  if (missingMediaSettings().length) throw new Error("Cấu hình kho ảnh chưa đủ.");
  const name = id(), partial = join(backupRoot, name + ".partial"), final = join(backupRoot, name);
  await exclusiveDirectory(partial);
  console.log("Đang tạo snapshot database và danh mục ảnh...");
  const db = new pg.Client({ ...settings, database: live });
  let manifest;
  try {
    await db.connect(); await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const snapshot = (await db.query("SELECT pg_export_snapshot() AS id")).rows[0].id;
    const tables = await tableCounts(db), media = await inventory(db);
    const dump = await runTool(executable("pg_dump"), [...pgArgs(live), "--format=custom", "--no-owner", "--no-privileges", "--snapshot", snapshot, "--file", join(partial, "database.dump")], pgEnv);
    if (dump.warnings) throw new Error("pg_dump có cảnh báo; snapshot giữ dạng .partial để kiểm tra, chưa được xem là bản sao hoàn chỉnh.");
    await db.query("COMMIT");
    manifest = { format: "studentmarket-backup", version: 1, complete: true, createdAt: new Date().toISOString(), sourceDatabase: live, provider: mediaStorageConfig().provider, tables, ...media };
  } finally { await db.end().catch(() => {}); }
  let completed = 0;
  for (const item of manifest.media) {
    const bytes = await readMedia(item.kind, item.key, manifest.provider === "supabase");
    await put(partial, `media/${item.kind}/${item.key}`, bytes);
    if (++completed % 10 === 0) console.log(`Đã sao lưu ${completed}/${manifest.media.length} ảnh.`);
  }
  await put(partial, "config/frontend.env", await readFile(join(frontend, ".env.local")));
  for (const path of ["frontend/.data/admin-login.txt", "backend/StudentMarket.API/appsettings.json", "backend/StudentMarket.API/appsettings.Development.json", "backend/StudentMarket.API/appsettings.Local.json"]) {
    const source = join(root, path);
    try { if (!(await lstat(source)).isFile()) throw new Error("Không hỗ trợ cấu hình liên kết."); await put(partial, "config/" + path, await readFile(source)); }
    catch (e) { if (e.code !== "ENOENT") throw e; }
  }
  console.log("Đang đóng gói mã nguồn (bỏ dependencies và cache)...");
  await runTool("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", join(root, "scripts", "package-source.ps1"), "-Destination", join(partial, "source.zip")]);
  manifest.files = await describeFiles(partial);
  await put(partial, "manifest.json", JSON.stringify(manifest, null, 2));
  await verifyBackup(partial);
  await rename(partial, final);
  console.log(JSON.stringify({ backup: final, tables: manifest.tables.length, images: manifest.media.length, files: manifest.files.length, verified: true }, null, 2));
}
async function restore() {
  const from = flag("--from"), name = flag("--database"), outputFlag = flag("--output");
  if (!from || !name || args.length) throw new Error("Dùng restore --from <thư mục backup> --database <database_mới> [--output <thư mục_mới>].");
  validateDatabase(name, live);
  console.log("Đang kiểm tra toàn bộ checksum trước khi khôi phục...");
  const { root: source, manifest } = await verifyBackup(resolve(from));
  if (name === manifest.sourceDatabase) throw new Error("Không ghi đè database nguồn của backup.");
  const admin = new pg.Client({ ...settings, database: "postgres" });
  const output = resolve(outputFlag || join(root, ".backups", "restores", id()));
  let created = false, target;
  try {
    await admin.connect();
    if ((await admin.query("SELECT 1 FROM pg_database WHERE datname=$1", [name])).rowCount) throw new Error("Database đích đã tồn tại; hãy chọn tên mới. Không có dữ liệu nào bị ghi đè.");
    await exclusiveDirectory(output);
    for (const kind of ["products", "cards", "chat"]) await mkdir(join(output, "media", kind), { recursive: true });
    for (const item of manifest.media) {
      const path = `media/${item.kind}/${item.key}`;
      await mkdir(dirname(join(output, path)), { recursive: true });
      await copyFile(join(source, path), join(output, path));
    }
    await admin.query(`CREATE DATABASE ${qi(name)} TEMPLATE template0`); created = true;
    console.log("Đang khôi phục vào database mới...");
    const restored = await runTool(executable("pg_restore"), [...pgArgs(name), "--single-transaction", "--exit-on-error", "--no-owner", "--no-privileges", join(source, "database.dump")], pgEnv);
    if (restored.warnings) throw new Error("pg_restore có cảnh báo; chưa đánh dấu khôi phục hoàn tất.");
    target = new pg.Client({ ...settings, database: name }); await target.connect();
    const counts = await tableCounts(target);
    if (JSON.stringify(counts) !== JSON.stringify(manifest.tables)) throw new Error("Số bản ghi sau khôi phục không khớp snapshot.");
    await target.query("BEGIN");
    for (const card of manifest.cards) await target.query("UPDATE users SET card_path=$2 WHERE id=$1", [card.id, "media:cards/" + card.key]);
    // The restored worker must only be enabled deliberately after switching environments.
    if ((await target.query("SELECT to_regclass('public.ai_moderation_control') AS name")).rows[0].name) await target.query("UPDATE public.ai_moderation_control SET enabled=FALSE");
    await target.query("COMMIT");
    const env = restoreEnvironment(await readFile(join(source, "config/frontend.env"), "utf8"), {
      PG_HOST: settings.host, PG_PORT: settings.port, PG_USER: settings.user, PG_PASSWORD: settings.password || "", PG_DATABASE: name,
      MEDIA_STORAGE_PROVIDER: "local", MEDIA_STORAGE_READ_LOCAL_FALLBACK: "false",
      PRODUCT_IMAGE_DIR: join(output, "media/products"), STUDENT_CARD_DIR: join(output, "media/cards"), CHAT_ATTACHMENT_DIR: join(output, "media/chat"), SEPAY_ENABLED: "false",
    });
    await put(output, "frontend.env.restored", env);
    await put(output, "restore-report.json", JSON.stringify({ complete: true, backup: source, database: name, tables: counts.length, images: manifest.media.length, aiEnabled: false, paymentsEnabled: false, createdAt: new Date().toISOString() }, null, 2));
    console.log(JSON.stringify({ restored: true, database: name, output, tables: counts.length, images: manifest.media.length, liveConfigurationChanged: false }, null, 2));
  } catch (error) {
    if (created) console.error("Database mới đã được tạo nhưng khôi phục chưa hoàn tất: " + name + ". Không dùng trước khi kiểm tra; database gốc giữ nguyên.");
    throw error;
  } finally { await target?.end().catch(() => {}); await admin.end().catch(() => {}); }
}
try {
  if (action === "backup") await backup();
  else if (action === "verify") {
    const from = flag("--from"); if (!from || args.length) throw new Error("Dùng verify --from <thư mục backup>.");
    const { root: source, manifest } = await verifyBackup(resolve(from));
    console.log(JSON.stringify({ verified: true, backup: source, files: manifest.files.length, images: manifest.media.length }, null, 2));
  } else if (action === "restore") await restore();
  else if (action === "help") console.log("backup | verify --from <thư mục> | restore --from <thư mục> --database <database_mới> [--output <thư mục_mới>]\nĐường dẫn tương đối được tính từ frontend. Xem docs/backup-restore.md.");
  else throw new Error("Lệnh không hợp lệ. Dùng help.");
} catch (error) {
  // Provider/SQL errors can include credentials, SQL literals and personal data.
  const trusted = error?.constructor === Error;
  console.error(trusted ? error.message : "Sao lưu/khôi phục thất bại. Kiểm tra cấu hình, quyền truy cập và dịch vụ; bản chưa hoàn tất không được sử dụng.");
  process.exitCode = 1;
}
