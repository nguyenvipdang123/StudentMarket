/**
 * GET /api/my-listings — List the authenticated user's own product listings
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-pg";
import { query } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { user, errorResponse } = await requireAuth(request);
  if (errorResponse) return errorResponse;

  // Auto expire passed promotions
  await query("UPDATE listing_promotions SET status = 'EXPIRED' WHERE status = 'ACTIVE' AND end_at < NOW()");

  const rows = await query(
    `SELECT p.id, p.title, p.price, p.status, p.moderation_status, p.condition, p.location, p.view_count,
            p.created_at, p.updated_at, p.description, p.rejection_reason,
            u.full_name AS seller_name, u.university AS seller_school,
            (SELECT pi.image_url FROM product_images pi WHERE pi.product_id = p.id AND pi.is_primary = TRUE LIMIT 1) AS image,
            (SELECT COUNT(*) FROM favorites f WHERE f.product_id = p.id) AS likes,
            (SELECT COUNT(DISTINCT c.id) FROM conversations c WHERE c.product_id = p.id) AS chats,
            lp.id AS promotion_id,
            lp.status AS promotion_status,
            COALESCE(lp.package_name_snapshot,pp.name) AS promotion_name,
            COALESCE(lp.priority_snapshot,pp.priority) AS promotion_priority,
            lp.start_at AS promotion_start_at,
            lp.end_at AS promotion_end_at
     FROM products p
     LEFT JOIN users u ON u.id = p.seller_id
     LEFT JOIN listing_promotions lp ON lp.listing_id = p.id 
          AND lp.status = 'ACTIVE' 
          AND NOW() BETWEEN lp.start_at AND lp.end_at
     LEFT JOIN promotion_packages pp ON pp.id = lp.package_id
     WHERE p.seller_id = $1 OR p.user_id = $1
     ORDER BY p.created_at DESC`,
    [user!.pgUserId]
  );

  return NextResponse.json({
    listings: rows.map(r => ({
      id: r.id,
      title: r.title,
      price: Number(r.price),
      status: r.status,
      moderationStatus: r.moderation_status || "PENDING",
      condition: r.condition,
      rejectionReason: r.rejection_reason || "",
      location: r.location,
      views: r.view_count,
      likes: Number(r.likes),
      chats: Number(r.chats),
      seller: r.seller_name,
      school: r.seller_school,
      image: r.image || "/sample/khac.svg",
      description: r.description,
      promotion: r.promotion_status === "ACTIVE" ? {
        id: r.promotion_id,
        name: r.promotion_name,
        priority: Number(r.promotion_priority) || 0,
        badge: Number(r.promotion_priority) >= 3 ? "Pro" : (Number(r.promotion_priority) >= 2 ? "Đang được đẩy" : "Nổi bật"),
        startAt: r.promotion_start_at?.toISOString() || null,
        endAt: r.promotion_end_at?.toISOString() || null,
      } : null,
      createdAt: r.created_at?.toISOString() || "",
      updatedAt: r.updated_at?.toISOString() || "",
    })),
  });
}
