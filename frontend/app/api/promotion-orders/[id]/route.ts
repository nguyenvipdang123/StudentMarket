import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-pg";
import { apiError } from "@/lib/api-error";
import { getPaymentOrder } from "@/lib/sepay-payments";
export const runtime = "nodejs";
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, errorResponse } = await requireAuth(request);
  if (errorResponse) return errorResponse;
  try { return NextResponse.json({ order: await getPaymentOrder((await params).id, user!) }, { headers: { "Cache-Control": "no-store" } }); }
  catch (e) { return apiError(e); }
}
