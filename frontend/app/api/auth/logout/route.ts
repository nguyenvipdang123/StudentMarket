import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { clearSession, digest, getDb, sameOrigin, sessionCookie } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const token = request.cookies.get(sessionCookie)?.value;
  if (token) await getDb().prepare("DELETE FROM sessions WHERE token_hash = ?").run(digest(token));
  const response = NextResponse.json({ ok: true });
  clearSession(response);
  return response;
}
