import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

process.chdir(fileURLToPath(new URL("..", import.meta.url)));
try { process.loadEnvFile(new URL("../.env.local", import.meta.url)); }
catch (error) { if (error.code !== "ENOENT") throw error; }
const { default: pool, query } = await import("../lib/db.ts");
const { aiSchemaReady, aiQueue, runAiListing } = await import("../lib/ai-moderation.ts");
const { workerStatus } = await import("../lib/ai-worker-control.ts");
const { moderationConfigured } = await import("../lib/ai-moderation-provider.ts");
const workerId = randomUUID();
const once = process.argv.includes("--once");
const pollArg = process.argv.find(arg => arg.startsWith("--poll-ms="));
const pollMs = pollArg ? Number(pollArg.split("=")[1]) : 20000;
if (!Number.isInteger(pollMs) || pollMs < 1000 || pollMs > 60000) throw Error("Invalid poll interval.");
let stopping = false, wake, heartbeat, heartbeatBusy = false, lockClient, acquired = false;
function stop() { stopping = true; wake?.(); }
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
async function pulse() {
  if (heartbeatBusy || stopping) return;
  heartbeatBusy = true;
  try {
    // Use the same dedicated connection that owns the advisory lock.
    await lockClient.query("UPDATE ai_moderation_control SET worker_id=$1,heartbeat_at=NOW() WHERE id=TRUE", [workerId]);
  } catch { console.error("AI worker lost its database connection; stopping."); stop(); }
  finally { heartbeatBusy = false; }
}
async function tick() {
  const control = await workerStatus();
  if (!control?.enabled) return;
  const actor = (await query("SELECT 1 FROM staff_accounts WHERE actor_id=$1 AND role='admin' AND status='verified'", [control.actorId]))[0];
  if (!actor) {
    await query("UPDATE ai_moderation_control SET last_error=$1 WHERE id=TRUE", ["Admin bật AI đã bị khóa hoặc không còn quyền; worker đang tạm dừng."]);
    return;
  }
  if (!moderationConfigured()) {
    await query("UPDATE ai_moderation_control SET last_error=$1 WHERE id=TRUE", ["Chưa cấu hình Gemini API key cho worker."]);
    return;
  }
  const listings = await aiQueue(control.actorId);
  // Sequential batches keep provider quota bounded; per-listing leases also protect manual scans.
  const results = [];
  for (const listing of listings) {
    if (stopping) break;
    const latest = await workerStatus();
    if (!latest?.enabled || latest.generation !== control.generation) break;
    results.push(await runAiListing(listing, control.actorId, Number(control.generation)));
  }
  await query(`UPDATE ai_moderation_control SET last_scan_at=NOW(),last_error=$1
    WHERE id=TRUE AND generation=$2`, [results.find(r => r.decision === "ERROR")?.reason || "", control.generation]);
  if (results.length) console.log(JSON.stringify({ processed: results.length, approved: results.filter(r => r.decision === "APPROVED").length, review: results.filter(r => ["REVIEW", "ERROR"].includes(r.decision)).length }));
}
try {
  if (!await aiSchemaReady()) throw Error("Run npm run db:migrate:ai before starting the worker.");
  lockClient = await pool.connect();
  lockClient.on("error", stop);
  const lock = await lockClient.query("SELECT pg_try_advisory_lock(73421, 1) AS acquired");
  acquired = lock.rows[0].acquired;
  if (!acquired) console.log("AI worker already running for this database; reusing it.");
  else {
    await pulse();
    heartbeat = setInterval(() => void pulse(), 10000);
    console.log("AI worker ready. The server-side Admin switch controls automatic scans.");
    do {
      try { await tick(); }
      catch { console.error("AI scan failed; pending listings stay unchanged. Retrying on the next cycle.");
        await query("UPDATE ai_moderation_control SET last_error=$1 WHERE id=TRUE AND worker_id=$2", ["Lượt quét thất bại; worker sẽ thử lại. Tin vẫn ở hàng chờ.", workerId]).catch(() => {});
      }
      if (once || stopping) break;
      await new Promise(resolve => { const timer = setTimeout(resolve, pollMs); wake = () => { clearTimeout(timer); resolve(); }; });
      wake = undefined;
    } while (!stopping);
  }
} catch (error) {
  console.error(error.message === "Run npm run db:migrate:ai before starting the worker." ? error.message : "AI worker could not start. Check PostgreSQL configuration.");
  process.exitCode = 1;
} finally {
  clearInterval(heartbeat);
  if (acquired) {
    await query("UPDATE ai_moderation_control SET worker_id=NULL,heartbeat_at=NULL WHERE id=TRUE AND worker_id=$1", [workerId]).catch(() => {});
    await lockClient.query("SELECT pg_advisory_unlock(73421, 1)").catch(() => {});
  }
  lockClient?.release();
  await pool.end();
}
