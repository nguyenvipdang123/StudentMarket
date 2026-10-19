/**
 * GET /api/my-promotions — List authenticated user's promotions and performance stats
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-pg";
import { query } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { user, errorResponse } = await requireAuth(request);
  if (errorResponse) return errorResponse;

  const pgUserId = user!.pgUserId;

  // Auto-expire passed promotions
  await query("UPDATE listing_promotions SET status = 'EXPIRED' WHERE status = 'ACTIVE' AND end_at < NOW()");

  const rows = await query(
    `SELECT lp.*, p.title AS listing_title, p.price AS listing_price, p.view_count,
            COALESCE(lp.package_name_snapshot,pp.name) AS package_name, pp.duration_hours, COALESCE(lp.priority_snapshot,pp.priority) AS priority,
            (SELECT COUNT(*) FROM favorites f WHERE f.product_id = p.id) AS likes_count,
            (SELECT COUNT(DISTINCT c.id) FROM conversations c WHERE c.product_id = p.id) AS contacts_count,
            (SELECT pi.image_url FROM product_images pi WHERE pi.product_id = p.id AND pi.is_primary = TRUE LIMIT 1) AS listing_image
     FROM listing_promotions lp
     JOIN products p ON p.id = lp.listing_id
     JOIN promotion_packages pp ON pp.id = lp.package_id
     WHERE lp.user_id = $1
     ORDER BY lp.created_at DESC`,
    [pgUserId]
  );

  return NextResponse.json({
    promotions: rows.map(r => ({
      id: r.id,
      listingId: r.listing_id,
      listingTitle: r.listing_title,
      listingImage: r.listing_image || "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=300",
      packageName: r.package_name,
      price: Number(r.price),
      priority: r.priority,
      status: r.status,
      paymentStatus: r.payment_status,
      startAt: r.start_at?.toISOString() || null,
      endAt: r.end_at?.toISOString() || null,
      createdAt: r.created_at?.toISOString() || "",
      stats: {
        views: r.view_count || 0,
        likes: Number(r.likes_count) || 0,
        contacts: Number(r.contacts_count) || 0,
      },
    })),
  });
}
