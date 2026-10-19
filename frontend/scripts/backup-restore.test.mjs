import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile, readFile, readdir, symlink, unlink } from "node:fs/promises";
import { resolve, join } from "node:path";
import { parseEnv } from "node:util";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import pg from "pg";
import { validateDatabase, safeRelative, restoreEnvironment, describeFiles, verifyBackup } from "./helpers/backup-tools.mjs";

try { process.loadEnvFile(".env.local"); } catch (e) { if (e.code !== "ENOENT") throw e; }
const backups = resolve("../.backups"); await mkdir(backups, { recursive: true });
const run = await mkdtemp(join(backups, "backup-test-"));
test("restore rejects live/system/invalid database names and unsafe paths", () => {
  for (const name of ["student_market", "postgres", "template0", "template1", "../../db", 'db";DROP DATABASE x;', "a".repeat(64), ""]) assert.throws(() => validateDatabase(name, "student_market"));
  assert.equal(validateDatabase("student_market_recovered", "student_market"), "student_market_recovered");
  for (const path of ["../outside", "a/../../b", "C:/secret", "a\\b", "/absolute", "a//b", ".", "a/./b"]) assert.throws(() => safeRelative(run, path));
  assert.equal(safeRelative(run, "media/cards/test.png"), join(run, "media/cards/test.png"));
});
test("restored environment preserves Windows paths, secrets and multiline values without executing them", () => {
  const values = { PG_PASSWORD: "p'\"a#ss$`", PRODUCT_IMAGE_DIR: "F:\\StudentMarket\\new data", OTHER: "abc\nxyz" };
  // A password containing every dotenv quote requires manual configuration, not silent corruption.
  assert.throws(() => restoreEnvironment("A=ok", values));
  values.PG_PASSWORD = "p'\"a#ss$";
  assert.deepEqual(parseEnv(restoreEnvironment("A=ok\nPG_DATABASE=old", { ...values, PG_DATABASE: "new_db" })), { A: "ok", ...values, PG_DATABASE: "new_db" });
});
test("manifest verification rejects partial, missing, changed, extra files and traversal", async () => {
  const dir = join(run, "manifest"); await mkdir(dir);
  await mkdir(join(dir, "config"));
  for (const path of ["database.dump", "source.zip", "config/frontend.env"]) await writeFile(join(dir, path), "fixture");
  const manifest = { format: "studentmarket-backup", version: 1, complete: true, tables: [], cards: [], media: [], files: await describeFiles(dir) };
  const setManifest = () => writeFile(join(dir, "manifest.json"), JSON.stringify(manifest));
  await setManifest(); assert.equal((await verifyBackup(dir)).manifest.files.length, 3);
  manifest.complete = false; await setManifest(); await assert.rejects(verifyBackup(dir));
  manifest.complete = true; await setManifest();
  await writeFile(join(dir, "database.dump"), "changed"); await assert.rejects(verifyBackup(dir), /Checksum/);
  await writeFile(join(dir, "database.dump"), "fixture");
  await writeFile(join(dir, "extra"), "unknown"); await assert.rejects(verifyBackup(dir), /ngoài manifest/); await unlink(join(dir, "extra"));
  manifest.files[0].path = "../escape"; await setManifest(); await assert.rejects(verifyBackup(dir));
});
test("manifest rejects symbolic links when the OS permits creating them", async t => {
  const dir = join(run, "links"); await mkdir(dir); await writeFile(join(dir, "target"), "fixture");
  try { await symlink(join(dir, "target"), join(dir, "link")); }
  catch (e) { if (["EPERM", "EACCES"].includes(e.code)) { t.skip("OS does not grant symlink creation"); return; } throw e; }
  await assert.rejects(describeFiles(dir), /liên kết/);
});

test("PostgreSQL round trip: schema, ledger, sequence, view, trigger, all media, config; live/existing target refused", { timeout: 180000 }, async () => {
  const suffix = randomBytes(5).toString("hex"), source = "student_market_backup_test_" + suffix, destination = "student_market_restore_test_" + suffix;
  const settings = { host: process.env.PG_HOST || "localhost", port: Number(process.env.PG_PORT || 5432), user: process.env.PG_USER || "postgres", password: process.env.PG_PASSWORD };
  const admin = new pg.Client({ ...settings, database: "postgres" });
  let db, restored, createdSource = false, createdDestination = false;
  const png = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
  const key = "00000000-0000-4000-8000-000000000001.png", conversation = "00000000-0000-4000-8000-000000000002";
  const productRoot = join(run, "source-media/products"), cardRoot = join(run, "source-media/cards"), chatRoot = join(run, "source-media/chat");
  for (const dir of [productRoot, cardRoot, join(chatRoot, conversation)]) await mkdir(dir, { recursive: true });
  for (const path of [join(productRoot, key), join(cardRoot, key), join(chatRoot, conversation, key)]) await writeFile(path, png);
  const env = { ...process.env, PG_DATABASE: source, MEDIA_STORAGE_PROVIDER: "local", MEDIA_STORAGE_READ_LOCAL_FALLBACK: "false", PRODUCT_IMAGE_DIR: productRoot, STUDENT_CARD_DIR: cardRoot, CHAT_ATTACHMENT_DIR: chatRoot };
  function cli(args) {
    return new Promise((resolvePromise, reject) => {
      const child = spawn(process.execPath, ["--experimental-strip-types", "scripts/backup-restore.mjs", ...args], { env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
      let output = ""; child.stdout.on("data", b => output += b); child.stderr.resume(); child.on("error", reject);
      child.on("close", code => resolvePromise({ code, output }));
    });
  }
  try {
    await admin.connect(); await admin.query(`CREATE DATABASE "${source}"`); createdSource = true;
    db = new pg.Client({ ...settings, database: source }); await db.connect();
    await db.query(`
      CREATE TABLE product_images(image_url text);
      CREATE TABLE users(id uuid PRIMARY KEY, card_path text);
      CREATE TABLE messages(content text);
      CREATE TABLE payment_ledger(id serial PRIMARY KEY, amount integer NOT NULL);
      INSERT INTO payment_ledger(amount) VALUES(5000),(19000);
      CREATE VIEW revenue AS SELECT SUM(amount) AS total FROM payment_ledger;
      CREATE FUNCTION reject_negative() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.amount<0 THEN RAISE EXCEPTION 'negative'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER nonnegative BEFORE INSERT ON payment_ledger FOR EACH ROW EXECUTE FUNCTION reject_negative();
      CREATE TABLE ai_moderation_control(enabled boolean); INSERT INTO ai_moderation_control VALUES(true);
    `);
    await db.query("INSERT INTO product_images VALUES($1)", ["/api/product-images/" + key]);
    await db.query("INSERT INTO users VALUES($1,$2)", [conversation, join(cardRoot, key)]);
    await db.query("INSERT INTO messages VALUES($1)", [`/api/conversations/${conversation}/attachments/${key}`]);
    const before = new Set(await readdir(join(backups, "snapshots")).catch(() => []));
    const result = await cli(["backup"]);
    assert.equal(result.code, 0, "backup command failed: " + result.output);
    const added = (await readdir(join(backups, "snapshots"))).filter(n => !before.has(n) && !n.endsWith(".partial"));
    const candidates = [];
    for (const name of added) { const dir = join(backups, "snapshots", name); if ((await verifyBackup(dir)).manifest.sourceDatabase === source) candidates.push(dir); }
    assert.equal(candidates.length, 1); const backup = candidates[0];
    assert.equal((await verifyBackup(backup)).manifest.media.length, 3);
    assert.notEqual((await cli(["restore", "--from", backup, "--database", source])).code, 0);
    assert.notEqual((await cli(["restore", "--from", backup, "--database", "postgres"])) .code, 0);
    const existing = "student_market_existing_test_" + suffix;
    await admin.query(`CREATE DATABASE "${existing}"`);
    try { assert.notEqual((await cli(["restore", "--from", backup, "--database", existing])).code, 0); }
    finally { await admin.query(`DROP DATABASE "${existing}"`); }
    const output = join(run, "restored");
    const restore = await cli(["restore", "--from", backup, "--database", destination, "--output", output]);
    createdDestination = Boolean((await admin.query("SELECT 1 FROM pg_database WHERE datname=$1", [destination])).rowCount);
    assert.equal(restore.code, 0, "restore command failed: " + restore.output);
    restored = new pg.Client({ ...settings, database: destination }); await restored.connect();
    assert.equal((await restored.query("SELECT total::text FROM revenue")).rows[0].total, "24000");
    assert.equal((await restored.query("INSERT INTO payment_ledger(amount) VALUES(123) RETURNING id")).rows[0].id, 3);
    await assert.rejects(restored.query("INSERT INTO payment_ledger(amount) VALUES(-1)"));
    assert.equal((await restored.query("SELECT enabled FROM ai_moderation_control")).rows[0].enabled, false);
    assert.equal((await db.query("SELECT enabled FROM ai_moderation_control")).rows[0].enabled, true);
    assert.equal((await restored.query("SELECT card_path FROM users")).rows[0].card_path, "media:cards/" + key);
    for (const path of [`products/${key}`, `cards/${key}`, `chat/${conversation}/${key}`]) assert.deepEqual(await readFile(join(output, "media", path)), png);
    const config = parseEnv(await readFile(join(output, "frontend.env.restored"), "utf8"));
    assert.equal(config.PG_DATABASE, destination); assert.equal(config.MEDIA_STORAGE_PROVIDER, "local"); assert.equal(config.SEPAY_ENABLED, "false");
    assert.equal(config.STUDENT_CARD_DIR, join(output, "media/cards"));
    assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM payment_ledger")).rows[0].n, 2);
    assert.notEqual((await cli(["restore", "--from", backup, "--database", destination, "--output", output])).code, 0);
    console.log("Round-trip fixture backup retained: " + backup);
  } finally {
    await restored?.end().catch(() => {}); await db?.end().catch(() => {});
    // Exact generated fixture names only; never drop the configured application database.
    for (const [name, created] of [[destination, createdDestination], [source, createdSource]]) {
      assert.match(name, /^student_market_(backup|restore)_test_[a-f0-9]{10}$/);
      assert.notEqual(name, process.env.PG_DATABASE);
      if (created) await admin.query(`DROP DATABASE "${name}"`);
    }
    await admin.end();
  }
});
