import { isUUID } from "@/lib/api-error";
/**
 * GET /api/favorites — List authenticated user's favorites
 * POST /api/favorites — Toggle a favorite (add/remove)
 * 
 * User identity comes from session cookie. Frontend NEVER sends userId.
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-pg";
import { query } from "@/lib/db";
import { mapFavoriteProduct } from '@/lib/favorite-product';

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { user, errorResponse } = await requireAuth(request);
  if (errorResponse) return errorResponse;

  const rows = await query(
    `SELECT f.id, f.product_id, f.created_at, f.price_alert_enabled,
            p.title, p.price, p.description, p.status, p.condition, p.location,
            u.full_name AS seller_name, u.university AS seller_school,
            (SELECT pi.image_url FROM product_images pi WHERE pi.product_id = p.id AND pi.is_primary = TRUE LIMIT 1) AS image
     FROM favorites f
     JOIN products p ON p.id = f.product_id
     LEFT JOIN users u ON u.id = p.seller_id
     WHERE f.user_id = $1 AND p.moderation_status='APPROVED' AND p.status <> 'Hidden'
     ORDER BY f.created_at DESC`,
    [user!.pgUserId]
  );

  return NextResponse.json({
    favorites: rows.map(mapFavoriteProduct),
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(request: NextRequest) {
  const { user, errorResponse } = await requireAuth(request);
  if (errorResponse) return errorResponse;

  const body = await request.json();
  const productId = body.productId as string;
  if (!isUUID(productId)) {
    return NextResponse.json({ error: "productId is required" }, { status: 400 });
  }

  // Check if already favorited
  const existing = await query(
    "SELECT id FROM favorites WHERE user_id = $1 AND product_id = $2",
    [user!.pgUserId, productId]
  );

  if (existing.length > 0) {
    // Remove favorite
    await query(
      "DELETE FROM favorites WHERE user_id = $1 AND product_id = $2",
      [user!.pgUserId, productId]
    );
    return NextResponse.json({ action: "removed", isSaved: false });
  } else {
    const visible=await query("SELECT id FROM products WHERE id=$1 AND status='Active' AND moderation_status='APPROVED'",[productId]);
    if(!visible.length) return NextResponse.json({error:"Tin không còn hiển thị."},{status:404});
    // Add favorite
    await query(
      "INSERT INTO favorites (user_id, product_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [user!.pgUserId, productId]
    );
    return NextResponse.json({ action: "added", isSaved: true });
  }
}

export async function PATCH(request:NextRequest) {
  const {user,errorResponse}=await requireAuth(request);if(errorResponse)return errorResponse;
  if(user!.role!=='student')return NextResponse.json({error:'Theo dõi giảm giá dành cho sinh viên.'},{status:403});
  let body;try{body=await request.json();}catch{return NextResponse.json({error:'Dữ liệu không hợp lệ.'},{status:400});}
  if(!isUUID(body?.productId)||typeof body?.enabled!=='boolean')return NextResponse.json({error:'Chọn sản phẩm và trạng thái theo dõi hợp lệ.'},{status:400});
  const rows=await query('UPDATE favorites SET price_alert_enabled=$3 WHERE user_id=$1 AND product_id=$2 RETURNING price_alert_enabled',[user!.pgUserId,body.productId,body.enabled]);
  if(!rows.length)return NextResponse.json({error:'Không tìm thấy món đồ trong danh sách đã lưu của bạn.'},{status:404});
  return NextResponse.json({priceAlertEnabled:rows[0].price_alert_enabled});
}
