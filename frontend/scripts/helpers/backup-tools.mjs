import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, readFile, realpath, readdir } from "node:fs/promises";
import { resolve, relative, isAbsolute, sep, join } from "node:path";
import { spawn } from "node:child_process";
import { parseEnv } from "node:util";

export const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
export const quoteIdentifier = value => '"' + value.replaceAll('"', '""') + '"';
export function validateDatabase(name, live) {
  if (!/^[a-z][a-z0-9_]{2,62}$/.test(name || "") || [live, "postgres", "template0", "template1"].includes(name)) {
    throw new Error("Tên database đích phải mới, 3–63 ký tự a-z/0-9/_, và khác database đang dùng.");
  }
  return name;
}
export function safeRelative(root, name) {
  if (typeof name !== "string" || !name || name.includes("\\") || name.split("/").some(p => !p || p === "." || p === ".." || p.includes(":"))) throw new Error("Đường dẫn backup không hợp lệ.");
  const file = resolve(root, ...name.split("/")), distance = relative(root, file);
  if (isAbsolute(distance) || distance.startsWith(".." + sep) || distance === ".." || !distance) throw new Error("Đường dẫn nằm ngoài backup.");
  return file;
}
export async function regularFile(root, name) {
  const file = safeRelative(root, name);
  let parent = root;
  for (const part of name.split("/")) {
    parent = join(parent, part);
    if ((await lstat(parent)).isSymbolicLink()) throw new Error("Backup không được chứa liên kết tượng trưng.");
  }
  if (!(await lstat(file)).isFile()) throw new Error("Backup thiếu file thường.");
  return file;
}
export async function fileHash(file) {
  const hash = createHash("sha256"); let size = 0;
  for await (const chunk of createReadStream(file)) { hash.update(chunk); size += chunk.length; }
  return { size, sha256: hash.digest("hex") };
}
export async function describeFiles(root, directory = root) {
  const files = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, item.name);
    if (item.isSymbolicLink()) throw new Error("Không sao lưu liên kết tượng trưng.");
    if (item.isDirectory()) files.push(...await describeFiles(root, path));
    else if (item.isFile()) files.push({ path: relative(root, path).split(sep).join("/"), ...await fileHash(path) });
    else throw new Error("Backup có loại file không hỗ trợ.");
  }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}
export async function verifyBackup(directory) {
  const root = await realpath(directory);
  const manifestFile = await regularFile(root, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestFile, "utf8"));
  if (manifest.format !== "studentmarket-backup" || manifest.version !== 1 || manifest.complete !== true || !Array.isArray(manifest.files) || !Array.isArray(manifest.media) || !Array.isArray(manifest.cards) || !Array.isArray(manifest.tables)) throw new Error("Backup chưa hoàn tất hoặc không đúng định dạng.");
  const paths = new Set();
  for (const item of manifest.files) {
    if (paths.has(item.path) || !Number.isSafeInteger(item.size) || item.size < 0 || !/^[a-f0-9]{64}$/.test(item.sha256)) throw new Error("Danh mục checksum không hợp lệ.");
    const actual = await fileHash(await regularFile(root, item.path));
    if (actual.size !== item.size || actual.sha256 !== item.sha256) throw new Error("Checksum không khớp: " + item.path);
    paths.add(item.path);
  }
  if (!["database.dump", "config/frontend.env", "source.zip"].every(p => paths.has(p))) throw new Error("Backup thiếu database, cấu hình hoặc mã nguồn.");
  const actualFiles = await describeFiles(root);
  if (actualFiles.length !== paths.size + 1 || actualFiles.some(f => f.path !== "manifest.json" && !paths.has(f.path))) throw new Error("Backup chứa file ngoài manifest.");
  const { validMediaKey } = await import("../../lib/media-files.ts");
  const mediaKeys = new Set();
  for (const item of manifest.media) {
    if (!["products", "cards", "chat"].includes(item.kind) || !validMediaKey(item.kind, item.key) || !paths.has(`media/${item.kind}/${item.key}`) || mediaKeys.has(item.kind + "/" + item.key)) throw new Error("Danh mục ảnh không hợp lệ.");
    mediaKeys.add(item.kind + "/" + item.key);
  }
  for (const card of manifest.cards) if (!/^[a-f0-9-]{36}$/i.test(card.id) || !mediaKeys.has("cards/" + card.key)) throw new Error("Tham chiếu thẻ sinh viên không hợp lệ.");
  for (const table of manifest.tables) if (typeof table.schema !== "string" || typeof table.name !== "string" || !/^\d+$/.test(table.rows)) throw new Error("Danh mục bảng không hợp lệ.");
  return { root, manifest };
}
export function runTool(command, args, env = process.env) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let warnings = false;
    child.stdout.resume(); child.stderr.on("data", () => { warnings = true; });
    child.on("error", () => reject(new Error("Không chạy được công cụ " + command.split(/[\\/]/).at(-1) + ". Kiểm tra PG_BIN/PowerShell.")));
    child.on("close", code => code === 0 ? resolvePromise({ warnings }) : reject(new Error("Công cụ " + command.split(/[\\/]/).at(-1) + " thất bại (" + code + "). Kiểm tra kết nối, quyền và phiên bản PostgreSQL; chi tiết không được in để tránh lộ dữ liệu.")));
  });
}
export function restoreEnvironment(original, values) {
  return Object.entries({ ...parseEnv(original), ...values }).map(([name, value]) => {
    const text = String(value);
    for (const quote of ["'", '"', "`"]) {
      if (text.includes(quote)) continue;
      const line = `${name}=${quote}${text}${quote}`;
      if (parseEnv(line)[name] === text) return line;
    }
    throw new Error("Không thể tạo file môi trường khôi phục cho " + name + "; cần cấu hình thủ công.");
  }).join("\n") + "\n";
}
