/**
 * GET, POST /api/payments/[order_id] — Standard payment gateway simulation/confirmation endpoint
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-pg";
import { apiError } from "@/lib/api-error";
import { getPaymentOrder } from "@/lib/sepay-payments";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ order_id: string }> }
) {
  const { user, errorResponse } = await requireAuth(request);
  if (errorResponse) return errorResponse;

  try {
    const order = await getPaymentOrder((await params).order_id, user!);
    return NextResponse.json({ ...order, orderId: order.id }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) { return apiError(e); }
}

export { paymentUnavailable as POST } from "@/lib/payment-disabled";
