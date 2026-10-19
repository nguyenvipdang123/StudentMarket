/**
 * GET /api/admin/revenue — Real financial & promotion metrics for Admin Dashboard
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
    return NextResponse.json({ error: "Chỉ quản trị viên mới có quyền xem doanh thu." }, { status: 403 });
  }

  // Auto-expire passed promotions
  await query("UPDATE listing_promotions SET status = 'EXPIRED' WHERE status = 'ACTIVE' AND end_at < NOW()");

  // 1. Total revenue
  const totalRevRows = await query(
    `SELECT COALESCE(SUM(amount), 0) AS total_revenue, COUNT(*) AS paid_orders_count
     FROM promotion_orders
     WHERE payment_status = 'PAID'`
  );
  const totalRevenue = Number(totalRevRows[0].total_revenue) || 0;
  const paidOrdersCount = Number(totalRevRows[0].paid_orders_count) || 0;

  // 2. Today revenue
  const todayRevRows = await query(
    `SELECT COALESCE(SUM(amount), 0) AS today_revenue
     FROM promotion_orders
     WHERE payment_status = 'PAID' AND paid_at >= CURRENT_DATE`
  );
  const todayRevenue = Number(todayRevRows[0].today_revenue) || 0;

  // 3. Month revenue
  const monthRevRows = await query(
    `SELECT COALESCE(SUM(amount), 0) AS month_revenue
     FROM promotion_orders
     WHERE payment_status = 'PAID' AND paid_at >= DATE_TRUNC('month', CURRENT_DATE)`
  );
  const monthRevenue = Number(monthRevRows[0].month_revenue) || 0;

  // 4. Active promotions count
  const activeCountRows = await query(
    `SELECT COUNT(*) AS active_promotions_count
     FROM listing_promotions
     WHERE status = 'ACTIVE' AND NOW() BETWEEN start_at AND end_at`
  );
  const activePromotionsCount = Number(activeCountRows[0].active_promotions_count) || 0;

  // 5. Expired promotions count
  const expiredCountRows = await query(
    `SELECT COUNT(*) AS expired_promotions_count
     FROM listing_promotions
     WHERE status = 'EXPIRED' OR (status = 'ACTIVE' AND end_at < NOW())`
  );
  const expiredPromotionsCount = Number(expiredCountRows[0].expired_promotions_count) || 0;

  // 6. Breakdown by package
  const pkgRows = await query(
    `SELECT pp.id AS package_id, pp.name AS package_name, pp.price AS package_price,
            COUNT(po.id) AS orders_count,
            COALESCE(SUM(po.amount), 0) AS total_revenue
     FROM promotion_packages pp
     LEFT JOIN promotion_orders po ON po.package_id = pp.id AND po.payment_status = 'PAID'
     GROUP BY pp.id, pp.name, pp.price
     HAVING pp.deleted_at IS NULL OR COUNT(po.id)>0
     ORDER BY pp.priority ASC`
  );

  const packageBreakdown = pkgRows.map(r => ({
    packageId: r.package_id,
    packageName: r.package_name,
    packagePrice: Number(r.package_price),
    ordersCount: Number(r.orders_count),
    revenue: Number(r.total_revenue),
    totalRevenue: Number(r.total_revenue),
  }));

  return NextResponse.json({
    totalRevenue,
    todayRevenue,
    monthRevenue,
    paidOrdersCount,
    activePromotionsCount,
    expiredPromotionsCount,
    packageBreakdown,
    packagesBreakdown: packageBreakdown,
  });
}
