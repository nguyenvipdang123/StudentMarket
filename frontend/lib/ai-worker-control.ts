import { query, transaction } from "./db.ts";

export async function workerStatus() {
  const row = (await query(`SELECT enabled,generation,actor_id AS "actorId",heartbeat_at AS "heartbeatAt",
    last_scan_at AS "lastScanAt",last_error AS "lastError",
    worker_id IS NOT NULL AND heartbeat_at>NOW()-INTERVAL '45 seconds' AS online
    FROM ai_moderation_control WHERE id=TRUE`))[0];
  return row;
}

export async function setWorkerEnabled(enabled: boolean, actorId: string) {
  return transaction(async client => {
    const actor = await client.query("SELECT 1 FROM staff_accounts WHERE actor_id=$1 AND role='admin' AND status='verified' FOR SHARE", [actorId]);
    if (!actor.rowCount) throw new Error("Quyền Admin đã thay đổi.");
    // Serialize against in-flight approvals, and invalidate results from the old switch generation.
    await client.query(`UPDATE ai_moderation_control SET enabled=$1,actor_id=$2,generation=generation+1,updated_at=NOW(),last_error=''
      WHERE id=TRUE`, [enabled, actorId]);
    await client.query(`INSERT INTO audit_logs(id,actor_id,action,target_type,target_id,description,created_at)
      VALUES(gen_random_uuid(),$1,$2,'SYSTEM','AI_WORKER',$3,NOW())`,
      [actorId, enabled ? "AI_WORKER_ENABLED" : "AI_WORKER_DISABLED", enabled ? "Bật worker AI tự kiểm duyệt tin đăng." : "Tắt worker AI tự kiểm duyệt tin đăng."]);
  });
}
