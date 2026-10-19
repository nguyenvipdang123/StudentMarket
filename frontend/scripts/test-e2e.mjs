import { spawn, execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, mkdtemp, readFile, writeFile, open, unlink } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { resolve, join, dirname, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createServer } from "node:net";
import { createServer as httpServer } from "node:http";
import pg from "pg";
import assert from "node:assert/strict";
import { seedE2E } from "./helpers/e2e-seed.mjs";
import { startMockAssistant } from "./helpers/mock-assistant.mjs";

const frontend = resolve(dirname(fileURLToPath(import.meta.url)), ".."); process.chdir(frontend);
const root = resolve(frontend, ".."), reports = join(root, ".backups/e2e");
const playwright = join(frontend, "node_modules/@playwright/test/cli.js");
const browserEnvironment = { ...process.env, PLAYWRIGHT_BROWSERS_PATH: join(root, ".backups/playwright-browsers") };
const command = process.argv[2] || "test", args = process.argv.slice(3);
const children = new Set(); let interrupted = false;
function launch(script, values, env, log) {
  const child = spawn(process.execPath, [script, ...values], { cwd: frontend, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  children.add(child);
  child.stdout.on("data", part => log ? log.write(part) : process.stdout.write(part));
  child.stderr.on("data", part => log ? log.write(part) : process.stderr.write(part));
  child.once("exit", () => children.delete(child));
  return child;
}
function finished(child) { return new Promise((resolvePromise, reject) => { child.once("error", reject); child.once("exit", (code, signal) => resolvePromise(code ?? (signal ? 1 : 0))); }); }
async function stop(child) { if (!child || child.exitCode !== null) return; const done = finished(child); child.kill(); await done; }
function interrupt() { interrupted = true; for (const child of children) child.kill(); }
process.once("SIGINT", interrupt); process.once("SIGTERM", interrupt);

async function test() {
  try { process.loadEnvFile(".env.local"); } catch (e) { if (e.code !== "ENOENT") throw e; }
  await mkdir(reports, { recursive: true });
  let lock;
  try { lock = await open(join(reports, "run.lock"), "wx"); }
  catch (e) { if (e.code === "EEXIST") throw new Error("Một lượt E2E đang chạy hoặc còn run.lock từ lượt bị ngắt. Xem docs/ui-testing.md trước khi xóa lock."); throw e; }
  await lock.writeFile(String(process.pid));
  const directory = await mkdtemp(join(reports, "run-"));
  console.log("Kết quả lượt chạy: " + directory);
  const database = "student_market_e2e_" + randomBytes(6).toString("hex");
  const settings = { host: process.env.PG_HOST || "localhost", port: Number(process.env.PG_PORT || 5432), user: process.env.PG_USER || "postgres", password: process.env.PG_PASSWORD, connectionTimeoutMillis: 5000 };
  const admin = new pg.Client({ ...settings, database: "postgres" });
  let db, created = false, app, assistant, mail;
  let code = 1;
  const serverLog = createWriteStream(join(directory, "server.log"), { mode: 0o600 });
  try {
    console.log("Tạo database E2E riêng và dữ liệu mẫu...");
    await admin.connect();
    const pgBin = process.env.PG_BIN || (process.platform === "win32" ? "C:/Program Files/PostgreSQL/16/bin" : "");
    const dump = pgBin ? join(pgBin, process.platform === "win32" ? "pg_dump.exe" : "pg_dump") : "pg_dump";
    const schema = execFileSync(dump, ["--schema-only", "--no-owner", "--no-privileges", "--no-password", "-h", settings.host, "-p", String(settings.port), "-U", settings.user, "-d", process.env.PG_DATABASE || "student_market"], { env: { ...process.env, PGPASSWORD: settings.password || "" }, encoding: "utf8", windowsHide: true, maxBuffer: 32 * 1024 * 1024 });
    assert.match(database, /^student_market_e2e_[a-f0-9]{12}$/); assert.notEqual(database, process.env.PG_DATABASE);
    await admin.query(`CREATE DATABASE "${database}"`); created = true;
    db = new pg.Client({ ...settings, database }); await db.connect();
    await db.query(schema.split("\n").filter(line => !line.startsWith("\\")).join("\n"));
    await db.query("SET search_path TO public");
    for (const name of ["auth", "postgres", "ai-moderation", "notifications", "sepay", "listing-search", "reservations", "saved-searches"]) await db.query(await readFile(join(frontend, "scripts", name + "-schema.sql"), "utf8"));
    const fixtures = await seedE2E(db);
    assistant = await startMockAssistant(); assistant.setReady(true);
    const mails = [];
    mail = httpServer(async (request, response) => {
      if (request.method === "POST") { let raw = ""; for await (const chunk of request) raw += chunk; mails.push(JSON.parse(raw)); response.end("{}"); return; }
      const email = new URL(request.url, "http://127.0.0.1").searchParams.get("email");
      const message = mails.findLast(item => item.to === email);
      response.setHeader("Content-Type", "application/json"); response.end(JSON.stringify({ code: message?.text.match(/\b\d{6}\b/)?.[0] || "" }));
    });
    await new Promise(resolvePromise => mail.listen(0, "127.0.0.1", resolvePromise));
    const mailOrigin = "http://127.0.0.1:" + mail.address().port;
    const preload = join(directory, "mock-mail.mjs");
    await writeFile(preload, `import mailer from ${JSON.stringify(pathToFileURL(join(frontend, "node_modules/nodemailer/dist/esm/nodemailer.js")).href)};mailer.createTransport=()=>({sendMail:async message=>{const response=await fetch(${JSON.stringify(mailOrigin)},{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(message)});if(!response.ok)throw Error('test mail failed');return {accepted:[message.to]};}});`, { mode: 0o600 });
    const probe = createServer(); await new Promise(resolvePromise => probe.listen(0, "127.0.0.1", resolvePromise)); const port = probe.address().port; await new Promise(resolvePromise => probe.close(resolvePromise));
    const origin = "http://127.0.0.1:" + port;
    const fixturePath = join(directory, "fixtures.json");
    await writeFile(fixturePath, JSON.stringify({ ...fixtures, mailOrigin }), { mode: 0o600 });
    const env = { ...process.env, ...browserEnvironment,
      PG_HOST: settings.host, PG_PORT: String(settings.port), PG_USER: settings.user, PG_PASSWORD: settings.password || "", PG_DATABASE: database,
      STUDENTMARKET_E2E_BUILD: "1", STUDENTMARKET_E2E_DATABASE: database, STUDENTMARKET_E2E_BASE_URL: origin, STUDENTMARKET_E2E_RUN_DIR: directory, STUDENTMARKET_E2E_FIXTURES: fixturePath,
      NODE_ENV: "production", NODE_OPTIONS: "--import=" + pathToFileURL(preload).href,
      APP_ORIGIN: origin, MEDIA_STORAGE_PROVIDER: "local", MEDIA_STORAGE_READ_LOCAL_FALLBACK: "false", PRODUCT_IMAGE_DIR: join(directory, "media/products"), STUDENT_CARD_DIR: join(directory, "media/cards"), CHAT_ATTACHMENT_DIR: join(directory, "media/chat"),
      SUPABASE_URL: "", SUPABASE_SECRET_KEY: "", SUPABASE_SERVICE_ROLE_KEY: "", GEMINI_API_KEY: "", SEPAY_ENABLED: "false", SEPAY_WEBHOOK_SECRET: randomBytes(32).toString("hex"),
      GOOGLE_CLIENT_ID: "", GOOGLE_CLIENT_SECRET: "", NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY: "",
      SMTP_HOST: "ui-test.invalid", SMTP_FROM: "SangTay E2E <test@ui-test.invalid>", SMTP_USER: "e2e-only", SMTP_PASSWORD: "e2e-only", CHAT_TICKET_SECRET: randomBytes(32).toString("hex"),
      PDF_CHAT_APP_URL: assistant.origin, PDF_CHAT_GRAPH_URL: assistant.origin,
      NEXT_PUBLIC_CHAT_WS_URL: "ws://127.0.0.1:" + port,
    };
    // Do not let an administrative page expose the real bank configuration in test traces.
    for (const key of Object.keys(env)) if (key.startsWith("SEPAY_")) env[key] = "";
    env.SEPAY_ENABLED = "false"; env.SEPAY_WEBHOOK_SECRET = randomBytes(32).toString("hex");
    console.log("Build kiểm thử riêng tại frontend/.next-e2e...");
    const nextEnvPath = join(frontend, "next-env.d.ts"), nextEnv = await readFile(nextEnvPath).catch(error => { if (error.code === "ENOENT") return null; throw error; });
    try { const build = launch(join(frontend, "node_modules/next/dist/bin/next"), ["build", "--webpack"], env); if (await finished(build)) throw new Error("Build E2E thất bại."); }
    finally { if (nextEnv) await writeFile(nextEnvPath, nextEnv); else await unlink(nextEnvPath).catch(error => { if (error.code !== "ENOENT") throw error; }); }
    if (interrupted) throw new Error("Đã ngắt kiểm thử.");
    app = launch(join(frontend, "node_modules/next/dist/bin/next"), ["start", "-p", String(port), "-H", "127.0.0.1"], env, serverLog);
    let ready = false;
    for (let attempt = 0; attempt < 120; attempt++) {
      if (app.exitCode !== null || interrupted) break;
      try { if ((await fetch(origin + "/api/auth/me", { signal: AbortSignal.timeout(1000) })).ok) { ready = true; break; } } catch { /* Wait for the new test server only. */ }
      await new Promise(resolvePromise => setTimeout(resolvePromise, 250));
    }
    if (!ready) throw new Error("Server E2E chưa sẵn sàng; xem server.log trong thư mục kết quả.");
    console.log("Chạy trình duyệt tự động trên database " + database);
    code = await finished(launch(playwright, ["test", "--config", "playwright.config.ts", ...args], env));
    const summary = { database, databaseRemoved: false, exitCode: code, report: join(directory, "report/index.html"), runDirectory: directory, createdAt: new Date().toISOString() };
    await writeFile(join(directory, "summary.json"), JSON.stringify(summary, null, 2), { mode: 0o600 });
    await writeFile(join(reports, "latest.json"), JSON.stringify(summary, null, 2), { mode: 0o600 });
    console.log("Báo cáo: " + summary.report);
    process.exitCode = code;
  } finally {
    await stop(app);
    await db?.end().catch(() => {});
    if (created) { assert.match(database, /^student_market_e2e_[a-f0-9]{12}$/); assert.notEqual(database, process.env.PG_DATABASE); await admin.query(`DROP DATABASE "${database}" WITH (FORCE)`); }
    await admin.end().catch(() => {});
    if (mail) await new Promise(resolvePromise => mail.close(resolvePromise));
    await assistant?.close(); serverLog.end();
    for (const file of [join(directory, "summary.json"), join(reports, "latest.json")]) {
      try { const summary = JSON.parse(await readFile(file, "utf8")); if (summary.database === database) { summary.databaseRemoved = created; await writeFile(file, JSON.stringify(summary, null, 2), { mode: 0o600 }); } } catch { /* Failed setup may not have a report yet. */ }
    }
    await lock.close(); await unlink(join(reports, "run.lock"));
  }
}
try {
  if (command === "install") process.exitCode = await finished(launch(playwright, ["install", "chromium", "--only-shell"], browserEnvironment));
  else if (command === "report") {
    const latest = JSON.parse(await readFile(join(reports, "latest.json"), "utf8"));
    const path = resolve(dirname(latest.report));
    if (!path.startsWith(reports + sep) || relative(reports, path).startsWith("..")) throw new Error("Đường dẫn báo cáo không hợp lệ.");
    process.exitCode = await finished(launch(playwright, ["show-report", path], browserEnvironment));
  } else if (command === "test") await test();
  else throw new Error("Dùng test, install hoặc report.");
} catch (error) { console.error(error.message); process.exitCode = 1; }
