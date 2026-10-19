import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { join } from "node:path";
import { promisify } from "node:util";
import nodemailer from "nodemailer";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { QueryResultRow } from "pg";
import { query } from "./db";
import { studentCardDirectory } from "./media-files";
export { isEducationEmail } from "./education-email";

const scrypt = promisify(scryptCallback);
const dataDirectory = join(process.cwd(), ".data");
export const cardDirectory = studentCardDirectory;
export const adminCredentialPath = join(dataDirectory, "admin-login.txt");
export const sessionCookie = "sangtay_session";
export const oauthCookie = "sangtay_google_oauth";
export const pendingGoogleCookie = "sangtay_google_pending";
const sessionSeconds = 60 * 60 * 24 * 7;

export type AccountStatus = "pending_email" | "pending_review" | "verified" | "locked";
export type AccountRole = "student" | "admin" | "staff";
export type Account = {
  id: number; full_name: string; email: string; student_id: string; university: string;
  password_hash: string | null; google_sub: string | null; status: AccountStatus; role: AccountRole;
};

// A small compatibility layer keeps route queries parameterized while PostgreSQL
// becomes the only live authentication store.
function postgresSql(sql: string) {
  let parameter = 0;
  return sql.replace(/\?/g, () => `$${++parameter}`).replace(/\s+COLLATE NOCASE/gi, "");
}

export function getDb() {
  return {
    prepare(sql: string) {
      const statement = postgresSql(sql);
      return {
        async get(...params: unknown[]): Promise<QueryResultRow | undefined> {
          return (await query(statement, params))[0];
        },
        async all(...params: unknown[]): Promise<QueryResultRow[]> {
          return query(statement, params);
        },
        async run(...params: unknown[]) {
          const returning = /^\s*INSERT\s+INTO\s+auth_identities\b/i.test(statement) && !/\bRETURNING\b/i.test(statement)
            ? `${statement} RETURNING id` : statement;
          const rows = await query(returning, params);
          return { lastInsertRowid: rows[0]?.id ?? 0 };
        },
      };
    },
  };
}

export function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function randomToken() {
  return randomBytes(32).toString("base64url");
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [algorithm, salt, expectedHex] = stored.split(":");
  if (algorithm !== "scrypt" || !salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, "hex");
  if (expected.length !== 64) return false;
  const actual = (await scrypt(password, salt, 64)) as Buffer;
  return timingSafeEqual(actual, expected);
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

export function publicAccount(account: Account) {
  return {
    id: account.id,
    name: account.full_name,
    fullName: account.full_name,
    email: account.email,
    studentId: account.student_id,
    university: account.university,
    status: account.status,
    role: account.role,
  };
}

export async function getAccountByEmail(email: string): Promise<Account | undefined> {
  return await getDb().prepare("SELECT * FROM auth_identities WHERE LOWER(email) = LOWER(?)").get(email) as Account | undefined;
}

export async function getAccountBySession(request: NextRequest) {
  const token = request.cookies.get(sessionCookie)?.value;
  return getAccountBySessionToken(token);
}

export async function getAccountBySessionToken(token?: string): Promise<Account | undefined> {
  if (!token) return undefined;
  const record = await getDb().prepare(`
    SELECT auth_identities.* FROM sessions JOIN auth_identities ON auth_identities.id = sessions.account_id
    WHERE sessions.token_hash = ? AND sessions.expires_at > ? AND auth_identities.status = 'verified'
  `).get(digest(token), Date.now()) as Account | undefined;
  return record;
}

export async function setSession(response: NextResponse, accountId: number) {
  const token = randomToken();
  await getDb().prepare("INSERT INTO sessions (token_hash, account_id, expires_at) VALUES (?, ?, ?)")
    .run(digest(token), accountId, Date.now() + sessionSeconds * 1000);
  response.cookies.set(sessionCookie, token, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
    path: "/", maxAge: sessionSeconds,
  });
}

export function clearSession(response: NextResponse) {
  response.cookies.set(sessionCookie, "", {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
    path: "/", maxAge: 0,
  });
}

export function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  if (origin === appOrigin(request)) return true;
  // Local development can also be opened directly while APP_ORIGIN points to the ngrok tunnel.
  return process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1"].includes(request.nextUrl.hostname) && origin === request.nextUrl.origin;
}

export function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function isUniqueError(exception: unknown) {
  return (typeof exception === "object" && exception !== null && "code" in exception && exception.code === "23505") ||
    (exception instanceof Error && /UNIQUE constraint failed/i.test(exception.message));
}

export function appOrigin(request: NextRequest) {
  if (process.env.APP_ORIGIN) return process.env.APP_ORIGIN.replace(/\/$/, "");
  if (process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1"].includes(request.nextUrl.hostname)) return request.nextUrl.origin;
  throw new Error("APP_ORIGIN is required in production");
}

export function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM && process.env.SMTP_USER && process.env.SMTP_PASSWORD);
}

export async function sendVerificationEmail(to: string, link: string) {
  if (!smtpConfigured()) throw new Error("SMTP is not configured");
  const port = Number(process.env.SMTP_PORT || 587);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: "Xác minh tài khoản SangTay",
    text: `Chào bạn,\n\nMở liên kết sau để xác minh tài khoản SangTay (có hiệu lực 30 phút):\n${link}\n\nNếu bạn không đăng ký, hãy bỏ qua email này.`,
  });
}

export async function sendAccountCode(to: string, code: string, purpose: "register" | "reset") {
  if (!smtpConfigured()) throw new Error("SMTP is not configured");
  const port = Number(process.env.SMTP_PORT || 587);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST, port, secure: port === 465, requireTLS: port !== 465,
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    disableFileAccess: true, disableUrlAccess: true,
  });
  await transporter.sendMail({
    from: process.env.SMTP_FROM, to,
    subject: purpose === "register" ? "Mã xác thực đăng ký SangTay" : "Mã đặt lại mật khẩu SangTay",
    text: `Mã ${purpose === "register" ? "xác thực đăng ký" : "đặt lại mật khẩu"} của bạn là: ${code}\n\nMã có hiệu lực 10 phút và chỉ dùng một lần. Không chia sẻ mã này cho bất kỳ ai.\nNếu bạn không yêu cầu thao tác này, hãy bỏ qua email.`,
  });
}

export async function requireVerified(request: NextRequest) {
  const account = await getAccountBySession(request);
  if (!account) return { account: undefined, response: error("Vui lòng đăng nhập để tiếp tục.", 401) };
  if (account.status !== "verified") return { account, response: error("Tài khoản chưa xác minh hoặc đã bị khóa.", 403) };
  return { account, response: undefined };
}

export async function requireAdmin(request: NextRequest) {
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method) && !sameOrigin(request)) return { account: null, response: error("Yêu cầu không hợp lệ.", 403) };
  const account = await getAccountBySession(request);
  if (!account) return { account: undefined, response: error("Vui lòng đăng nhập bằng tài khoản quản trị.", 401) };
  if (account.role !== "admin" || account.status !== "verified") {
    return { account, response: error("Bạn không có quyền quản trị.", 403) };
  }
  return { account, response: undefined };
}

export async function requireStaffOrAdmin(request: NextRequest) {
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method) && !sameOrigin(request)) return { account: null, response: error("Yêu cầu không hợp lệ.", 403) };
  const account = await getAccountBySession(request);
  if (!account) return { account: undefined, response: error("Vui lòng đăng nhập để tiếp tục.", 401) };
  if (account.status !== "verified") return { account, response: error("Tài khoản chưa xác minh hoặc đã bị khóa.", 403) };
  if (account.role !== "admin" && account.role !== "staff") {
    return { account, response: error("Chỉ quản trị viên hoặc nhân viên mới có quyền thực hiện thao tác này.", 403) };
  }
  return { account, response: undefined };
}
