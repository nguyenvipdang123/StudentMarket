/**
 * GET /api/my-promotions — List authenticated user's promotions and performance stats
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-pg";
import { query } from "@/lib/db";
import { apiError,isUUID } from "@/lib/api-error";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { user, errorResponse } = await requireAuth(request);
  if (errorResponse) return errorResponse;

  const pgUserId = user!.pgUserId;
  const listingId=request.nextUrl.searchParams.get('listingId');
  if(listingId&&!isUUID(listingId))return NextResponse.json({error:'Mã tin không hợp lệ.'},{status:400});
  try {
  const rows = await query(
    `SELECT lp.*, p.title AS listing_title, p.price AS listing_price, p.view_count,
            CASE WHEN lp.status='ACTIVE' AND lp.end_at<=NOW() THEN 'EXPIRED' ELSE lp.status END AS effective_status,
            COALESCE(lp.package_name_snapshot,pp.name) AS package_name, pp.duration_hours, COALESCE(lp.priority_snapshot,pp.priority) AS priority,
            (SELECT COUNT(*) FROM favorites f WHERE f.product_id = p.id) AS likes_count,
            (SELECT COUNT(DISTINCT c.id) FROM conversations c WHERE c.product_id = p.id) AS contacts_count,
            (SELECT pi.image_url FROM product_images pi WHERE pi.product_id = p.id AND pi.is_primary = TRUE LIMIT 1) AS listing_image
     FROM listing_promotions lp
     JOIN products p ON p.id = lp.listing_id
     JOIN promotion_packages pp ON pp.id = lp.package_id
     WHERE lp.user_id = $1 AND lp.payment_status='PAID' AND lp.start_at IS NOT NULL
       AND ($2::uuid IS NULL OR lp.listing_id=$2)
     ORDER BY lp.start_at DESC,lp.id LIMIT 100`,
    [pgUserId,listingId]
  );

  return NextResponse.json({
    promotions: rows.map(r => ({
      id: r.id,
      listingId: r.listing_id,
      listingTitle: r.listing_title,
      listingImage: r.listing_image || "/sample/khac.svg",
      packageName: r.package_name,
      price: Number(r.price),
      priority: r.priority,
      status: r.effective_status,
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
  },{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){return apiError(error);}
}
