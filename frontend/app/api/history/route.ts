import { isUUID } from "@/lib/api-error";
/**
 * GET /api/history — List authenticated user's view history
 * POST /api/history — Record a view
 * DELETE /api/history — Clear history (all or single item)
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-pg";
import { query } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { user, errorResponse } = await requireAuth(request);
  if (errorResponse) return errorResponse;

  const rows = await query(
    `SELECT vh.id, vh.product_id, vh.viewed_at,
            p.title, p.price, p.status,
            u.full_name AS seller_name, u.university AS seller_school,
            (SELECT pi.image_url FROM product_images pi WHERE pi.product_id = p.id AND pi.is_primary = TRUE LIMIT 1) AS image
     FROM view_history vh
     JOIN products p ON p.id = vh.product_id
     LEFT JOIN users u ON u.id = p.seller_id
     WHERE vh.user_id = $1 AND p.moderation_status='APPROVED' AND p.status IN ('Active','Sold')
     ORDER BY vh.viewed_at DESC
     LIMIT 50`,
    [user!.pgUserId]
  );

  return NextResponse.json({
    history: rows.map(r => ({
      id: r.id,
      productId: r.product_id,
      title: r.title,
      price: Number(r.price),
      status: r.status,
      seller: r.seller_name,
      school: r.seller_school,
      image: r.image || "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=300",
      viewedAt: r.viewed_at,
    })),
  });
}

export async function POST(request: NextRequest) {
  const { user, errorResponse } = await requireAuth(request);
  if (errorResponse) return errorResponse;

  const body = await request.json();
  const productId = body.productId as string;
  if (!isUUID(productId)) {
    return NextResponse.json({ error: "productId is required" }, { status: 400 });
  }

  const visible=await query("SELECT id FROM products WHERE id=$1 AND status='Active' AND moderation_status='APPROVED'",[productId]);
  if(!visible.length) return NextResponse.json({error:"Tin không còn hiển thị."},{status:404});
  // Upsert: update viewed_at if exists, insert if not
  await query(
    `INSERT INTO view_history (user_id, product_id, viewed_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (user_id, product_id) DO UPDATE SET viewed_at = NOW()`,
    [user!.pgUserId, productId]
  );

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const { user, errorResponse } = await requireAuth(request);
  if (errorResponse) return errorResponse;

  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("productId");

  if (productId) {
    await query(
      "DELETE FROM view_history WHERE user_id = $1 AND product_id = $2",
      [user!.pgUserId, productId]
    );
  } else {
    // Clear all history
    await query("DELETE FROM view_history WHERE user_id = $1", [user!.pgUserId]);
  }

  return NextResponse.json({ success: true });
}
