/**
 * GET /api/my-promotions/[id]/analytics — Analytics for a specific promotion
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-pg";
import { query } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, errorResponse } = await requireAuth(request);
  if (errorResponse) return errorResponse;

  const { id: promoId } = await params;
  const pgUserId = user!.pgUserId;

  const promRows = await query(
    `SELECT lp.*, p.title AS listing_title, p.view_count, COALESCE(lp.package_name_snapshot,pp.name) AS package_name, COALESCE(lp.priority_snapshot,pp.priority) AS priority
     FROM listing_promotions lp
     JOIN products p ON p.id = lp.listing_id
     JOIN promotion_packages pp ON pp.id = lp.package_id
     WHERE lp.id::text = $1 AND (lp.user_id = $2 OR p.seller_id = $2 OR $3 = 'admin')`,
    [promoId, pgUserId, user!.role]
  );

  if (promRows.length === 0) {
    return NextResponse.json({ error: "Không tìm thấy gói đẩy tin." }, { status: 404 });
  }

  const promo = promRows[0];

  // Fetch event counts for this listing
  const eventRows = await query(
    `SELECT event_type, COUNT(*) AS count, COUNT(DISTINCT user_id) AS unique_users
     FROM listing_analytics
     WHERE listing_id = $1
     GROUP BY event_type`,
    [promo.listing_id]
  );

  const eventMap: Record<string, number> = {};
  for (const r of eventRows) {
    eventMap[r.event_type] = Number(r.count);
  }

  return NextResponse.json({
    promotionId: promo.id,
    listingId: promo.listing_id,
    listingTitle: promo.listing_title,
    packageName: promo.package_name,
    priority: promo.priority,
    status: promo.status,
    startAt: promo.start_at?.toISOString() || null,
    endAt: promo.end_at?.toISOString() || null,
    analytics: {
      views: Math.max(Number(promo.view_count || 0), eventMap["VIEW"] || 0),
      clicks: eventMap["CLICK"] || 0,
      favorites: eventMap["FAVORITE"] || 0,
      contacts: eventMap["CONTACT"] || 0,
    },
  });
}
