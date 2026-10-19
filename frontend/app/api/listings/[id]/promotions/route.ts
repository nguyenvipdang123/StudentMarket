import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-pg";
import { ApiError, apiError } from "@/lib/api-error";
import { createPromotionOrder, pendingListingPayment } from "@/lib/sepay-payments";

export const runtime = "nodejs";
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, errorResponse } = await requireAuth(request);
  if (errorResponse) return errorResponse;
  try {
    const { id } = await params;
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new ApiError("Dữ liệu gói thanh toán không hợp lệ.");
    const order = await createPromotionOrder(id, body.packageId, user!);
    return NextResponse.json({ order }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (e) { return apiError(e); }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, errorResponse } = await requireAuth(request);
  if (errorResponse) return errorResponse;
  try {
    const { id } = await params;
    return NextResponse.json({ order: await pendingListingPayment(id, user!) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) { return apiError(e); }
}
