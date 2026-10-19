import { randomBytes, scrypt as callback } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import pg from "pg";
import {databaseConfig} from '../lib/database-config.mjs';

try { process.loadEnvFile(".env.local"); } catch (error) { if (error.code !== "ENOENT") throw error; }
if (!process.env.DATABASE_URL && !process.env.PG_PASSWORD) throw new Error("Configure DATABASE_URL or PG_* environment variables.");
const email = (process.argv[2] || "admin@sangtay.local").trim().toLowerCase();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Usage: npm run admin:create -- [admin-email]");
const client = new pg.Client(databaseConfig());
const credentialPath = join(process.cwd(), ".data", "admin-login.txt");
await client.connect();
let wroteCredentials = false;
try {
  const existing = await client.query("SELECT 1 FROM auth_identities WHERE role='admin' OR LOWER(email)=LOWER($1) OR student_id='ADMIN-LOCAL' LIMIT 1", [email]);
  if (existing.rowCount) throw new Error("An admin account or reserved identity already exists. No account was changed.");
  const password = randomBytes(24).toString("base64url");
  const salt = randomBytes(16).toString("hex");
  const hash = (await promisify(callback)(password, salt, 64)).toString("hex");
  const now = Date.now();
  await mkdir(join(process.cwd(), ".data"), {recursive:true});
  await writeFile(credentialPath, `SangTay admin\nURL: ${process.env.APP_ORIGIN||'http://localhost:3000'}/admin\nEmail: ${email}\nPassword: ${password}\n\nChange this password in the admin page, then delete this file.\n`, {flag:"wx",mode:0o600});
  wroteCredentials = true;
  await client.query(`INSERT INTO auth_identities (full_name,email,student_id,university,password_hash,status,role,created_at,verified_at)
    VALUES ($1,$2,'ADMIN-LOCAL','SangTay',$3,'verified','admin',$4,$4)`, ["Quản trị SangTay",email,`scrypt:${salt}:${hash}`,now]);
  console.log(`Admin created in PostgreSQL. One-time credentials: ${credentialPath}`);
} catch (error) {
  if (wroteCredentials) await unlink(credentialPath).catch(()=>undefined);
  console.error(error.message); process.exitCode = 1;
} finally { await client.end(); }
