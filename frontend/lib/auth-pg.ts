/** Resolve the session to a student UUID or a staff actor UUID. */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getAccountBySession, publicAccount, sameOrigin } from "./auth";
import { getIdentityActorId } from "./db";

export type AuthenticatedUser = {
  /** PostgreSQL account ID */
  accountId: number;
  /** Student user UUID or staff actor UUID */
  pgUserId: string;
  email: string;
  fullName: string;
  university: string;
  role: string;
};

/**
 * Get the authenticated user from the request.
 * Returns the authenticated identity and actor UUID, or null if not logged in.
 */
export async function getAuthenticatedUser(
  request: NextRequest
): Promise<AuthenticatedUser | null> {
  const account = await getAccountBySession(request);
  if (!account) return null;
  if (account.status !== "verified") return null;

  const pub = publicAccount(account);

  const pgUserId = await getIdentityActorId(pub.id, pub.role);
  if (!pgUserId) return null;

  return {
    accountId: pub.id,
    pgUserId,
    email: pub.email,
    fullName: pub.fullName,
    university: pub.university,
    role: pub.role,
  };
}

/**
 * Require authentication. Returns 401 JSON if not logged in.
 */
export async function requireAuth(request: NextRequest) {
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method) && !sameOrigin(request)) {
    return { user: null as AuthenticatedUser | null, errorResponse: NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 }) };
  }
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return {
      user: null as AuthenticatedUser | null,
      errorResponse: NextResponse.json(
        { error: "Vui lòng đăng nhập để tiếp tục." },
        { status: 401 }
      ),
    };
  }
  return { user, errorResponse: null };
}
