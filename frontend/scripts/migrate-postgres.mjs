import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import pg from "pg";
import {databaseConfig} from '../lib/database-config.mjs';

const scriptDir = fileURLToPath(new URL(".", import.meta.url));
const sql = await readFile(resolve(scriptDir, "postgres-schema.sql"), "utf8");
const authSql = await readFile(resolve(scriptDir, "auth-schema.sql"), "utf8");
const aiSql = await readFile(resolve(scriptDir, "ai-moderation-schema.sql"), "utf8");
const notificationSql = await readFile(resolve(scriptDir, "notifications-schema.sql"), "utf8");
const sepaySql = await readFile(resolve(scriptDir, "sepay-schema.sql"), "utf8");
const searchSql = await readFile(resolve(scriptDir, "listing-search-schema.sql"), "utf8");
const reservationsSql = await readFile(resolve(scriptDir, "reservations-schema.sql"), "utf8");
const savedSearchesSql = await readFile(resolve(scriptDir, "saved-searches-schema.sql"), "utf8");
const promotionAnalyticsSql = await readFile(resolve(scriptDir, "promotion-analytics-schema.sql"), "utf8");
const supportSql = await readFile(resolve(scriptDir, "support-schema.sql"), "utf8");
try { process.loadEnvFile(resolve(scriptDir, "../.env.local")); } catch (e) { if (e.code !== "ENOENT") throw e; }
if (!process.env.DATABASE_URL && !process.env.PG_PASSWORD) throw new Error("Configure DATABASE_URL or PG_* environment variables.");
const client = new pg.Client(databaseConfig());

try {
  await client.connect();
  const { rows } = await client.query("SELECT current_database() AS database");
  console.log(`PostgreSQL connected: ${rows[0].database}`);
  await client.query("BEGIN");
  await client.query('SELECT pg_advisory_xact_lock(73421,2)');
  const {rows:[base]}=await client.query("SELECT to_regclass('public.users') AS users,to_regclass('public.products') AS products,to_regclass('public.categories') AS categories");
  if(!base.users && !base.products && !base.categories) {
    const initial=await readFile(resolve(scriptDir,'base-schema.sql'),'utf8');
    await client.query(initial.replace(/^\uFEFF/,'').replace(/^START TRANSACTION;\s*$/gm,'').replace(/^COMMIT;\s*$/gm,''));
    console.log('Initialized an empty database (schema only; no demo accounts or products).');
  } else if(!base.users || !base.products || !base.categories) throw new Error('Database schema is incomplete. Restore or inspect it before migrating.');
  await client.query(authSql);
  await client.query(sql);
  await client.query(aiSql);
  await client.query(notificationSql);
  await client.query(sepaySql);
  await client.query(searchSql);
  await client.query(reservationsSql);
  await client.query(savedSearchesSql);
  await client.query(promotionAnalyticsSql);
  await client.query(supportSql);
  await client.query("COMMIT");
  console.log("SangTay PostgreSQL tables and columns are ready.");
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined);
  console.error(`PostgreSQL migration failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}
