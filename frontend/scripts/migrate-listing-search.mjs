import pg from "pg";
import {databaseConfig} from '../lib/database-config.mjs';
import { readFile } from "node:fs/promises";
try { process.loadEnvFile(".env.local"); } catch (error) { if (error.code !== "ENOENT") throw error; }
const db = new pg.Client(databaseConfig());
try {
  await db.connect(); await db.query("BEGIN");
  await db.query(await readFile(new URL("./listing-search-schema.sql", import.meta.url), "utf8"));
  await db.query("COMMIT");
  console.log("Server search functions and indexes are ready.");
} catch { await db.query("ROLLBACK").catch(() => {}); console.error("Không tạo được index tìm kiếm. Kiểm tra kết nối PostgreSQL và quyền CREATE extension pg_trgm."); process.exitCode = 1; }
finally { await db.end(); }
