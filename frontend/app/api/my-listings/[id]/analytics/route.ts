/**
 * GET /api/my-listings/[id]/analytics — Detailed engagement metrics for owner's listing
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

  const { id: listingId } = await params;
  const pgUserId = user!.pgUserId;

  // 1. Verify ownership
  const prodRows = await query(
    `SELECT id, title, price, status, moderation_status, seller_id, user_id, view_count, created_at
     FROM products
     WHERE id::text = $1
     LIMIT 1`,
    [listingId]
  );

  if (prodRows.length === 0) {
    return NextResponse.json({ error: "Tin đăng không tồn tại." }, { status: 404 });
  }

  const listing = prodRows[0];
  const isOwner = String(listing.seller_id) === pgUserId || String(listing.user_id) === pgUserId;

  if (!isOwner && user!.role !== "admin") {
    return NextResponse.json({ error: "Bạn không có quyền xem thống kê của tin đăng này." }, { status: 403 });
  }

  // 2. Fetch event counts
  const eventRows = await query(
    `SELECT event_type, COUNT(*) AS count, COUNT(DISTINCT COALESCE(user_id::text,visitor_id)) AS unique_users
     FROM listing_analytics
     WHERE listing_id = $1
     GROUP BY event_type`,
    [listing.id]
  );

  const eventMap: Record<string, { count: number; unique: number }> = {};
  for (const r of eventRows) {
    eventMap[r.event_type] = {
      count: Number(r.count),
      unique: Number(r.unique_users),
    };
  }

  // Also query real favorites and conversations counts
  const favRows = await query(
    `SELECT COUNT(*) AS total FROM favorites WHERE product_id = $1`,
    [listing.id]
  );
  const convRows = await query(
    `SELECT COUNT(DISTINCT id) AS total FROM conversations WHERE product_id = $1`,
    [listing.id]
  );

  const viewsCount = Math.max(Number(listing.view_count || 0), eventMap["VIEW"]?.count || 0);
  const uniqueViews = eventMap["VIEW"]?.unique || 0;
  const favoritesCount = Number(favRows[0]?.total || 0);
  const contactsCount = Number(convRows[0]?.total || 0);
  const clicksCount = Number(eventMap["CLICK"]?.count || 0);

  // Active promotion if any
  const promRows = await query(
    `SELECT lp.*, COALESCE(lp.package_name_snapshot,pp.name) AS package_name, COALESCE(lp.priority_snapshot,pp.priority) AS priority
     FROM listing_promotions lp
     JOIN promotion_packages pp ON pp.id = lp.package_id
     WHERE lp.listing_id = $1 AND lp.status = 'ACTIVE' AND NOW() BETWEEN lp.start_at AND lp.end_at
     LIMIT 1`,
    [listing.id]
  );

  return NextResponse.json({
    listingId: listing.id,
    title: listing.title,
    analytics: {
      views: viewsCount,
      uniqueViews,
      favorites: favoritesCount,
      contacts: contactsCount,
      clicks: clicksCount,
    },
    promotion: promRows.length > 0 ? {
      id: promRows[0].id,
      name: promRows[0].package_name,
      priority: promRows[0].priority,
      startAt: promRows[0].start_at?.toISOString() || null,
      endAt: promRows[0].end_at?.toISOString() || null,
    } : null,
  });
}
