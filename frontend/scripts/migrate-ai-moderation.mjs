import { readFile } from "node:fs/promises";
import pg from "pg";
import {databaseConfig} from '../lib/database-config.mjs';
try {process.loadEnvFile(new URL("../.env.local", import.meta.url));} catch(e) {if(e.code!=='ENOENT')throw e;}
const client = new pg.Client(databaseConfig());
try { await client.connect(); await client.query("BEGIN"); await client.query(await readFile(new URL("./ai-moderation-schema.sql", import.meta.url), "utf8")); await client.query("COMMIT"); console.log("Bảng kiểm duyệt AI đã sẵn sàng. Chưa duyệt hoặc đổi trạng thái tin nào."); }
catch { await client.query("ROLLBACK").catch(() => {}); process.exitCode = 1; console.error("Chưa tạo được bảng kiểm duyệt AI. Kiểm tra kết nối PostgreSQL."); }
finally { await client.end().catch(() => {}); }
