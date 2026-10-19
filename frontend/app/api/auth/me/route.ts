import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getAccountBySession, publicAccount } from "@/lib/auth";
import { getIdentityActorId } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const account = await getAccountBySession(request);
  if (!account || account.status !== "verified") {
    return NextResponse.json({ user: null }, { headers: { "Cache-Control": "no-store" } });
  }
  const pub = publicAccount(account);
  const pgUserId = await getIdentityActorId(pub.id, pub.role);
  if (!pgUserId) return NextResponse.json({ user: null }, { headers: { "Cache-Control": "no-store" } });
  const userObj = {
    ...pub,
    pgUserId,
  };
  return NextResponse.json({
    user: userObj,
    id: pub.id,
    pgUserId,
    name: pub.name,
    fullName: pub.fullName,
    email: pub.email,
    role: pub.role === "admin" ? "Admin" : "User",
  }, { headers: { "Cache-Control": "no-store" } });
}
