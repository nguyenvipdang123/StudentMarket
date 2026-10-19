import { readFile } from "node:fs/promises";
import pg from "pg";
import {databaseConfig} from '../lib/database-config.mjs';
try {process.loadEnvFile(new URL("../.env.local", import.meta.url));} catch(e) {if(e.code!=='ENOENT')throw e;}
const client = new pg.Client(databaseConfig());
try { await client.connect(); await client.query(await readFile(new URL("./notifications-schema.sql", import.meta.url), "utf8")); console.log("Notification read receipts are ready."); }
catch { process.exitCode = 1; console.error("Cannot prepare notifications. Check PostgreSQL connection."); }
finally { await client.end(); }
