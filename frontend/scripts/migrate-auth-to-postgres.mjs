// One-time import of the old SQLite authentication store. Existing PostgreSQL
// identities are never overwritten; rerunning after a successful import stops.
import { DatabaseSync } from "node:sqlite";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import pg from "pg";

try { process.loadEnvFile(resolve(".env.local")); } catch (error) { if (error.code !== "ENOENT") throw error; }
if (!process.env.PG_PASSWORD) throw new Error("Configure PG_PASSWORD in .env.local");
const source = resolve(process.argv[2] || join(".data", "accounts.sqlite"));
if (!existsSync(source)) throw new Error(`SQLite source does not exist: ${source}`);
const sqlite = new DatabaseSync(source, { readOnly: true });
const client = new pg.Client({ host: process.env.PG_HOST || "localhost", port: Number(process.env.PG_PORT || 5432),
  database: process.env.PG_DATABASE || "student_market", user: process.env.PG_USER || "postgres", password: process.env.PG_PASSWORD });
const tables = {
  accounts: ["id","full_name","email","student_id","university","password_hash","google_sub","status","role","card_path","created_at","verified_at"],
  email_verifications: ["account_id","token_hash","expires_at"],
  sessions: ["token_hash","account_id","expires_at"],
  google_onboarding: ["token_hash","google_sub","full_name","email","expires_at"],
  login_attempts: ["attempt_key","failures","blocked_until"],
};
await client.connect();
try {
  await client.query("BEGIN");
  const existing = await client.query("SELECT COUNT(*)::int AS count FROM auth_identities");
  if (existing.rows[0].count !== 0) throw new Error("PostgreSQL identities are not empty. Import cancelled to avoid overwriting live accounts.");
  const counts = {};
  for (const [table, columns] of Object.entries(tables)) {
    const sourceColumns = sqlite.prepare(`PRAGMA table_info(${table})`).all().map(column => column.name);
    const available = columns.filter(column => sourceColumns.includes(column));
    const rows = sqlite.prepare(`SELECT ${available.join(",")} FROM ${table}`).all();
    counts[table] = rows.length;
    for (const row of rows) {
      const values = available.map(column => row[column]);
      const target = table === "accounts" ? "auth_identities" : table;
      await client.query(`INSERT INTO ${target} (${available.join(",")}) VALUES (${values.map((_,index) => `$${index + 1}`).join(",")})`, values);
    }
  }
  await client.query(`SELECT setval('auth_identity_id_seq', GREATEST((SELECT COALESCE(MAX(id),0) FROM auth_identities),1), (SELECT COUNT(*)>0 FROM auth_identities))`);
  // Student identities are already inserted into users by the view trigger.
  for (const account of sqlite.prepare("SELECT * FROM accounts WHERE role='student'").all()) {
    const role = "Student";
    const status = account.status === "locked" ? "Locked" : account.status === "verified" ? "Verified" : "Pending";
    await client.query(`INSERT INTO users (id,full_name,email,student_id,university,role,auth_type,status,created_at)
      VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,NOW())
      ON CONFLICT(email) DO UPDATE SET full_name=EXCLUDED.full_name,student_id=EXCLUDED.student_id,
        university=EXCLUDED.university,role=EXCLUDED.role,status=EXCLUDED.status`,
      [account.full_name,account.email,account.student_id,account.university,role,account.google_sub ? "Google" : "Email",status]);
  }
  for (const [table, count] of Object.entries(counts)) {
    const target = await client.query(`SELECT COUNT(*)::int AS count FROM ${table === "accounts" ? "auth_identities" : table}`);
    if (target.rows[0].count !== count) throw new Error(`${table} count mismatch; import rolled back.`);
  }
  await client.query("COMMIT");
  console.log(`Authentication migrated to PostgreSQL: ${JSON.stringify(counts)}`);
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined);
  console.error(`Authentication migration failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  sqlite.close();
  await client.end();
}
