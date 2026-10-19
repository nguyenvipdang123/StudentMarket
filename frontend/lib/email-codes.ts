import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import type { PoolClient } from "pg";
import { digest, isEducationEmail, sendAccountCode, type Account } from "./auth";
import { query, transaction } from "./db";

type Purpose = "register" | "reset";
export class EmailCodeError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export async function lockAccount(client: PoolClient, id: number) {
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`auth-account:${id}`]);
  // Lock the underlying row as well: moderation can lock an account without using this helper.
  await client.query("SELECT auth_id FROM users WHERE auth_id=$1 FOR UPDATE", [id]);
  await client.query("SELECT id FROM staff_accounts WHERE id=$1 FOR UPDATE", [id]);
}
function codeHash(account: Account, purpose: Purpose, code: string) {
  const secret = process.env.EMAIL_CODE_SECRET || process.env.CHAT_TICKET_SECRET || "";
  if (secret.length < 32) throw new Error("Email code secret is not configured");
  return createHmac("sha256", secret).update(JSON.stringify([account.id, purpose, account.password_hash, code])).digest("hex");
}
function eligible(account: Account | undefined, purpose: Purpose) {
  return Boolean(account && (purpose === "register" ? account.status === "pending_email" : account.status === "verified"));
}
export async function issueEmailCode(accountId: number, purpose: Purpose) {
  return transaction(async client => {
    await lockAccount(client, accountId);
    const account = (await client.query("SELECT * FROM auth_identities WHERE id=$1", [accountId])).rows[0] as Account | undefined;
    if (!account || !eligible(account, purpose)) throw new EmailCodeError("Tài khoản không cần xác thực ở bước này.", 409);
    const previous = (await client.query("SELECT * FROM account_email_codes WHERE account_id=$1 AND purpose=$2", [accountId, purpose])).rows[0];
    const now = Date.now(), sameWindow = previous && Number(previous.window_started_at) > now - 3600000;
    if (previous && Number(previous.sent_at) > now - 60000) throw new EmailCodeError("Vui lòng đợi 60 giây trước khi gửi lại mã.", 429);
    if (sameWindow && previous.send_count >= 5) throw new EmailCodeError("Đã đạt giới hạn gửi mã. Vui lòng thử lại sau một giờ.", 429);
    const code = String(randomInt(0, 1000000)).padStart(6, "0");
    await client.query(`INSERT INTO account_email_codes(account_id,purpose,code_hash,expires_at,sent_at,attempts,window_started_at,send_count)
      VALUES($1,$2,$3,$4,$5,0,$6,$7) ON CONFLICT(account_id,purpose) DO UPDATE SET
      code_hash=EXCLUDED.code_hash,expires_at=EXCLUDED.expires_at,sent_at=EXCLUDED.sent_at,attempts=0,
      window_started_at=EXCLUDED.window_started_at,send_count=EXCLUDED.send_count`,
    [accountId, purpose, codeHash(account, purpose, code), now + 600000, now, sameWindow ? previous.window_started_at : now, sameWindow ? previous.send_count + 1 : 1]);
    // Delivery and code rotation share the account lock. A failed send rolls back to the previous code.
    await sendAccountCode(account.email, code, purpose);
    if (purpose === "register") await client.query("DELETE FROM email_verifications WHERE account_id=$1", [accountId]);
    return { expiresIn: 600, resendAfter: 60 };
  });
}

export async function consumeEmailCode(email: string, code: string, purpose: Purpose, newHash?: string) {
  const invalid = { ok: false as const, status: 400, message: "Mã không đúng, đã hết hạn hoặc đã dùng. Hãy kiểm tra email hoặc gửi lại mã." };
  if (!/^\d{6}$/.test(code)) return invalid;
  return transaction(async client => {
    const first = (await client.query("SELECT id FROM auth_identities WHERE LOWER(email)=$1", [email])).rows[0];
    if (!first) return invalid;
    await lockAccount(client, Number(first.id));
    const account = (await client.query("SELECT * FROM auth_identities WHERE id=$1", [first.id])).rows[0] as Account | undefined;
    if (!account || !eligible(account, purpose)) return invalid;
    const row = (await client.query("SELECT * FROM account_email_codes WHERE account_id=$1 AND purpose=$2 FOR UPDATE", [account.id, purpose])).rows[0];
    if (!row || Number(row.expires_at) <= Date.now()) return invalid;
    if (row.attempts >= 5) return { ...invalid, status: 429, message: "Mã đã bị khóa sau 5 lần nhập sai. Vui lòng yêu cầu mã mới." };
    const actual = Buffer.from(codeHash(account, purpose, code), "hex"), expected = Buffer.from(row.code_hash, "hex");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      await client.query("UPDATE account_email_codes SET attempts=attempts+1 WHERE account_id=$1 AND purpose=$2", [account.id, purpose]);
      return { ...invalid, status: row.attempts === 4 ? 429 : 400 };
    }
    if (purpose === "reset") {
      if (!newHash) throw new Error("Missing password hash");
      await client.query("UPDATE auth_identities SET password_hash=$1 WHERE id=$2 AND status='verified'", [newHash, account.id]);
      await client.query("DELETE FROM sessions WHERE account_id=$1", [account.id]);
      await client.query("DELETE FROM login_attempts WHERE attempt_key=$1", [digest(account.email)]);
    } else {
      const next = isEducationEmail(account.email) ? "verified" : "pending_review";
      await client.query("UPDATE auth_identities SET status=$1,verified_at=$2 WHERE id=$3 AND status='pending_email'", [next, next === "verified" ? Date.now() : null, account.id]);
      account.status = next;
      await client.query("DELETE FROM email_verifications WHERE account_id=$1", [account.id]);
    }
    // Keep the send window for throttling while making this code single-use.
    await client.query("UPDATE account_email_codes SET expires_at=0,code_hash='' WHERE account_id=$1 AND purpose=$2", [account.id, purpose]);
    await client.query(`INSERT INTO audit_logs(id,actor_id,action,target_type,target_id,description,created_at)
      VALUES(gen_random_uuid(),NULL,$1,'ACCOUNT',$2,$3,NOW())`, [purpose === "reset" ? "RESET_PASSWORD" : account.status === "verified" ? "AUTO_VERIFY_EDU_ACCOUNT" : "VERIFY_ACCOUNT_EMAIL", String(account.id), purpose === "reset" ? "Đặt lại mật khẩu bằng mã email; đã thu hồi các phiên đăng nhập." : "Đã xác thực email bằng mã; giữ quy trình xét duyệt sinh viên."]);
    return { ok: true as const, account };
  });
}

// Limits requests even for unknown addresses without exposing account existence.
export async function allowEmailRequest(key: string, limit: number, periodMs: number) {
  const now = Date.now();
  const rows = await query(`INSERT INTO login_attempts(attempt_key,failures,blocked_until) VALUES($1,1,$2)
    ON CONFLICT(attempt_key) DO UPDATE SET failures=CASE WHEN login_attempts.blocked_until<=$3 THEN 1 ELSE login_attempts.failures+1 END,
      blocked_until=CASE WHEN login_attempts.blocked_until<=$3 THEN $2 ELSE login_attempts.blocked_until END
    RETURNING failures`, [key, now + periodMs, now]);
  return rows[0].failures <= limit;
}
