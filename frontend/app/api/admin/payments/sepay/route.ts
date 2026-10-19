import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-pg";
import { query } from "@/lib/db";
import { missingSePaySettings, sepayConfig } from "@/lib/sepay-policy";

export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const { user, errorResponse } = await requireAuth(request);
  if (errorResponse) return errorResponse;
  if (user!.role !== "admin") return NextResponse.json({ error: "Chỉ Admin được xem đối soát thanh toán." }, { status: 403 });
  const events = await query(`SELECT e.transaction_id::text,e.amount,e.status,e.reason,e.reference_code,e.transaction_at,e.received_at,
    po.transaction_code AS order_code,po.id AS order_id,po.amount AS order_amount,po.payment_status,
    po.package_name_snapshot,po.duration_hours_snapshot,po.created_at AS order_created_at,po.expires_at,
    p.title AS listing_title,u.full_name AS seller_name,e.transfer_type
    FROM sepay_payment_events e LEFT JOIN promotion_orders po ON po.id=e.order_id LEFT JOIN products p ON p.id=po.listing_id LEFT JOIN users u ON u.id=po.user_id
    ORDER BY e.received_at DESC LIMIT 50`);
  const count = (await query("SELECT COUNT(*)::int AS n FROM sepay_payment_events WHERE status='REVIEW'"))[0].n;
  return NextResponse.json({ configured: missingSePaySettings().length === 0, missingSettings: missingSePaySettings(), authMethod: sepayConfig().auth,
    webhookPath: "/api/payments/sepay/webhook", reviewCount: count,
    events: events.map(e => ({ id: e.transaction_id, amount: Number(e.amount), status: e.status, reason: e.reason, referenceCode: e.reference_code,
      orderCode: e.order_code, orderId: e.order_id, listingTitle: e.listing_title, sellerName: e.seller_name,
      packageName: e.package_name_snapshot, durationHours: e.duration_hours_snapshot, orderAmount: e.order_amount == null ? null : Number(e.order_amount),
      orderCreatedAt: e.order_created_at?.toISOString() || null, expiresAt: e.expires_at?.toISOString() || null,
      canApprove: e.status === "REVIEW" && ["PENDING", "CANCELLED"].includes(e.payment_status) && e.transfer_type === "in" && Number(e.amount) === Number(e.order_amount),
      transactionAt: e.transaction_at.toISOString(), receivedAt: e.received_at.toISOString() })) },
  { headers: { "Cache-Control": "no-store" } });
}
