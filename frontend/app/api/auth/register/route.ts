import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  digest, error, getDb, hashPassword, isEducationEmail,
  isUniqueError, isValidEmail, sameOrigin, smtpConfigured,
} from "@/lib/auth";
import { allowEmailRequest, issueEmailCode } from "@/lib/email-codes";
import { saveMedia, removeMedia, MediaStorageError } from "@/lib/media-storage";
import { checkTurnstile } from "@/lib/turnstile";

export const runtime = "nodejs";

function cardExtension(bytes: Buffer) {
  if (bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return "jpg";
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "png";
  if (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return error("Yêu cầu không hợp lệ.", 403);
  if (Number(request.headers.get("content-length") || 0) > 6_000_000) return error("Ảnh thẻ phải nhỏ hơn 5 MB.", 413);

  let form: FormData;
  try { form = await request.formData(); } catch { return error("Dữ liệu đăng ký không hợp lệ."); }
  const bot = await checkTurnstile(form.get('turnstileToken'), 'register');
  if (bot) return error(bot.error, bot.status);
  const fullName = String(form.get("fullName") || "").trim().replace(/\s+/g, " ");
  const email = String(form.get("email") || "").trim().toLowerCase();
  const studentId = String(form.get("studentId") || "").trim().toUpperCase();
  const password = String(form.get("password") || "");
  const confirmPassword = String(form.get("confirmPassword") || "");
  const university = String(form.get("university") || "").trim();
  const card = form.get("studentCard");
  const educationEmail = isEducationEmail(email);

  if (fullName.length < 2 || fullName.length > 100) return error("Họ và tên cần từ 2 đến 100 ký tự.");
  if (!isValidEmail(email)) return error("Email không đúng định dạng.");
  if (!/^[A-Z0-9][A-Z0-9._-]{2,29}$/.test(studentId)) return error("Mã sinh viên cần từ 3 đến 30 ký tự, chỉ gồm chữ, số, dấu chấm, gạch dưới hoặc gạch ngang.");
  if (password.length < 8 || password.length > 128 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) return error("Mật khẩu cần 8–128 ký tự, có ít nhất một chữ và một số.");
  if (password !== confirmPassword) return error("Xác nhận mật khẩu không khớp.");
  if (university.length < 2 || university.length > 120) return error("Vui lòng chọn trường đại học.");
  const db = getDb();
  const existingByEmail = await db.prepare("SELECT id FROM auth_identities WHERE LOWER(email) = LOWER(?)").get(email);
  if (existingByEmail) {
    return error("Email này đã được đăng ký.", 409);
  }
  const existingByStudentId = await db.prepare("SELECT id FROM auth_identities WHERE LOWER(student_id) = LOWER(?)").get(studentId);
  if (existingByStudentId) {
    return error("Mã sinh viên này đã được đăng ký.", 409);
  }

  if (!educationEmail && !(card instanceof File && card.size > 0)) {
    return error("Email ngoài miền .edu hoặc .edu.vn cần ảnh thẻ sinh viên để xác minh.");
  }
  if (!smtpConfigured()) {
    return error("Hệ thống chưa cấu hình SMTP để gửi mã xác thực email.", 503);
  }
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  if (!await allowEmailRequest(`registration:${digest(ip)}`, 10, 3600000)) return error("Đã đăng ký quá nhiều lần. Vui lòng thử lại sau một giờ.", 429);

  let cardPath: string | null = null;
  if (card instanceof File && card.size > 0) {
    if (card.size > 5_000_000) return error("Ảnh thẻ phải nhỏ hơn 5 MB.");
    const bytes = Buffer.from(await card.arrayBuffer());
    const extension = cardExtension(bytes);
    if (!extension) return error("Ảnh thẻ phải là JPG, PNG hoặc WebP hợp lệ.");
    const key = `${randomUUID()}.${extension}`;
    try { await saveMedia("cards", key, bytes); }
    catch (exception) { return error(exception instanceof MediaStorageError ? exception.message : "Chưa lưu được ảnh thẻ. Vui lòng thử lại sau.", 503); }
    cardPath = `media:cards/${key}`;
  }

  const initialStatus = "pending_email";
  const now = Date.now();
  let accountId = 0;
  try {
    const hash = await hashPassword(password);
    const result = await db.prepare(`
      INSERT INTO auth_identities (full_name, email, student_id, university, password_hash, status, card_path, created_at, verified_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(fullName, email, studentId, university, hash, initialStatus, cardPath, now, null);
    accountId = Number(result.lastInsertRowid);

    await issueEmailCode(accountId, "register");
  } catch (exception) {
    if (accountId) await db.prepare("DELETE FROM auth_identities WHERE id = ?").run(accountId);
    if (cardPath) await removeMedia("cards", cardPath.slice("media:cards/".length)).catch(() => console.error("Student card cleanup failed after registration rollback."));
    if (isUniqueError(exception)) return error("Email này đã được đăng ký.", 409);
    console.error("Registration failed; account creation was rolled back.");
    return error("Không thể hoàn tất đăng ký. Vui lòng thử lại sau.", 503);
  }

  return NextResponse.json({
    status: initialStatus,
    email, expiresIn: 600, resendAfter: 60,
    message: "Đã gửi mã xác thực 6 số đến email của bạn. Mã có hiệu lực 10 phút.",
  }, { status: 201 });
}
