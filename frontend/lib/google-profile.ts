import { digest, isUniqueError, type Account } from "./auth";
import { transaction } from "./db";
export class GoogleProfileError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export async function completeGoogleProfile(token: string, body: { fullName?: unknown; studentId?: unknown; university?: unknown }) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new GoogleProfileError("Phiên Google đã hết hạn. Vui lòng thử lại.", 401);
  const fullName = String(body.fullName || "").trim().replace(/\s+/g, " ");
  const studentId = String(body.studentId || "").trim().toUpperCase();
  const university = String(body.university || "").trim();
  if (fullName.length < 2 || fullName.length > 100) throw new GoogleProfileError("Họ và tên cần từ 2 đến 100 ký tự.");
  if (!/^[A-Z0-9][A-Z0-9._-]{2,29}$/.test(studentId)) throw new GoogleProfileError("Mã sinh viên không hợp lệ.");
  if (university.length < 2 || university.length > 120) throw new GoogleProfileError("Vui lòng chọn trường đại học.");
  try {
    return await transaction(async client => {
      const pending = (await client.query("SELECT * FROM google_onboarding WHERE token_hash=$1 AND expires_at>$2 FOR UPDATE", [digest(token), Date.now()])).rows[0];
      if (!pending) throw new GoogleProfileError("Phiên Google đã hết hạn. Vui lòng thử lại.", 401);
      const inserted = (await client.query(`INSERT INTO auth_identities(full_name,email,student_id,university,google_sub,status,created_at,verified_at)
        VALUES($1,$2,$3,$4,$5,'verified',$6,$6) RETURNING *`, [fullName, pending.email, studentId, university, pending.google_sub, Date.now()])).rows[0] as Account;
      await client.query("DELETE FROM google_onboarding WHERE token_hash=$1", [digest(token)]);
      return inserted;
    });
  } catch (e) {
    if (isUniqueError(e)) throw new GoogleProfileError("Email hoặc mã sinh viên đã được đăng ký.", 409);
    throw e;
  }
}
