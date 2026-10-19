/**
 * PostgreSQL connection helper for Next.js API routes.
 * All personal data queries go through here.
 * User identity is determined from session cookie — NEVER from frontend params.
 */
import { Pool, types, type PoolClient, type QueryResultRow } from "pg";
import { databaseConfig, databasePoolSize } from "./database-config.mjs";

// Auth IDs and millisecond timestamps are BIGINT and remain within JS safe integers.
types.setTypeParser(20, value => Number(value));

const pool = new Pool({
  ...databaseConfig(),
  max: databasePoolSize(),
  idleTimeoutMillis: 30000,
  query_timeout: 15000,
});

export async function transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await pool.query<T>(text, params);
  return result.rows;
}

/**
 * Resolve an account identity to the marketplace users UUID.
 */
export async function resolveUserUUID(email: string): Promise<string | null> {
  const rows = await query<{ id: string }>(
    "SELECT id::text FROM users WHERE LOWER(email) = LOWER($1)",
    [email]
  );
  return rows.length > 0 ? rows[0].id : null;
}

export async function getIdentityActorId(accountId: number, role: string): Promise<string | null> {
  const rows = role === "student"
    ? await query<{ id: string }>("SELECT id::text FROM users WHERE auth_id=$1", [accountId])
    : await query<{ id: string }>("SELECT actor_id::text AS id FROM staff_accounts WHERE id=$1", [accountId]);
  return rows[0]?.id ?? null;
}

export async function logAudit({
  actorId,
  action,
  targetType,
  targetId,
  description,
}: {
  actorId: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  description?: string | null;
}) {
  try {
    await query(
      `INSERT INTO audit_logs (id, actor_id, action, target_type, target_id, description, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW())`,
      [actorId, action, targetType, targetId || null, description || null]
    );
  } catch (e) {
    console.error("Failed to write audit log:", e);
  }
}

export default pool;
