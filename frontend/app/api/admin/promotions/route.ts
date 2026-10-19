/**
 * GET /api/admin/promotions — List all promotions with user, listing, package, order details
 * PATCH /api/admin/promotions — Cancel a promotion (Admin only)
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-pg";
import { query } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { user, errorResponse } = await requireAuth(request);
  if (errorResponse) return errorResponse;

  if (user!.role !== "admin") {
    return NextResponse.json({ error: "Chỉ quản trị viên mới có quyền truy cập." }, { status: 403 });
  }

  // Auto expire passed promotions
  await query("UPDATE listing_promotions SET status = 'EXPIRED' WHERE status = 'ACTIVE' AND end_at < NOW()");

  const rows = await query(
    `SELECT lp.*, 
            p.title AS listing_title, p.price AS listing_price, p.moderation_status,
            u.full_name AS user_name, u.email AS user_email,
            COALESCE(lp.package_name_snapshot,pp.name) AS package_name,
            COALESCE(EXTRACT(EPOCH FROM (lp.end_at-lp.start_at))/3600,pp.duration_hours) AS duration_hours,
            COALESCE(lp.priority_snapshot,pp.priority) AS priority
     FROM listing_promotions lp
     JOIN products p ON p.id = lp.listing_id
     JOIN users u ON u.id = lp.user_id
     JOIN promotion_packages pp ON pp.id = lp.package_id
     ORDER BY lp.created_at DESC`
  );

  return NextResponse.json({
    promotions: rows.map(r => ({
      id: r.id,
      listingId: r.listing_id,
      listingTitle: r.listing_title,
      userName: r.user_name,
      userEmail: r.user_email,
      packageName: r.package_name,
      durationHours: Number(r.duration_hours),
      price: Number(r.price),
      status: r.status,
      paymentStatus: r.payment_status,
      transactionId: r.transaction_id,
      startAt: r.start_at?.toISOString() || null,
      endAt: r.end_at?.toISOString() || null,
      createdAt: r.created_at?.toISOString() || "",
    })),
  });
}

export async function PATCH(request: NextRequest) {
  const { user, errorResponse } = await requireAuth(request);
  if (errorResponse) return errorResponse;

  if (user!.role !== "admin") {
    return NextResponse.json({ error: "Chỉ quản trị viên mới có quyền hủy promotion." }, { status: 403 });
  }

  const body = await request.json();
  const promotionId = body.promotionId;

  if (!promotionId) {
    return NextResponse.json({ error: "promotionId là bắt buộc." }, { status: 400 });
  }

  await query(
    `UPDATE listing_promotions
     SET status = 'CANCELLED', updated_at = NOW()
     WHERE id::text = $1`,
    [promotionId]
  );

  return NextResponse.json({ success: true, message: "Đã hủy gói đẩy tin thành công." });
}
