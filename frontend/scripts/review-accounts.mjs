import pg from "pg";

try { process.loadEnvFile(".env.local"); } catch (error) { if (error.code !== "ENOENT") throw error; }
if (!process.env.PG_PASSWORD) throw new Error("Configure PG_PASSWORD in .env.local");
const [command, rawStudentId] = process.argv.slice(2);
if (!["list","approve","lock"].includes(command) || (command !== "list" && !rawStudentId))
  throw new Error("Usage: npm run auth:review -- list|approve|lock [studentId]");
const client = new pg.Client({ host:process.env.PG_HOST||"localhost",port:Number(process.env.PG_PORT||5432),
  database:process.env.PG_DATABASE||"student_market",user:process.env.PG_USER||"postgres",password:process.env.PG_PASSWORD });
await client.connect();
try {
  if (command === "list") {
    const {rows} = await client.query("SELECT student_id,full_name,email,university,status,card_path FROM auth_identities WHERE status='pending_review' ORDER BY created_at");
    console.table(rows);
  } else {
    const studentId = rawStudentId.trim().toUpperCase();
    await client.query("BEGIN");
    const {rows} = await client.query("SELECT auth_id AS id,email,auth_status AS status FROM users WHERE LOWER(student_id)=LOWER($1) AND auth_id IS NOT NULL FOR UPDATE", [studentId]);
    const account = rows[0];
    if (!account) throw new Error("Account not found.");
    if (command === "approve") {
      if (account.status !== "pending_review") throw new Error("Only accounts pending card review can be approved.");
      await client.query("UPDATE auth_identities SET status='verified',verified_at=$1 WHERE id=$2", [Date.now(),account.id]);
    } else {
      await client.query("UPDATE auth_identities SET status='locked' WHERE id=$1", [account.id]);
      await client.query("DELETE FROM sessions WHERE account_id=$1", [account.id]);
    }
    await client.query("COMMIT");
    console.log(`${command === "approve" ? "Approved" : "Locked"} ${studentId}.`);
  }
} catch (error) {
  await client.query("ROLLBACK").catch(()=>undefined);
  console.error(error.message); process.exitCode=1;
} finally { await client.end(); }
