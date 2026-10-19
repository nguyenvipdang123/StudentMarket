import { ApiError, apiError, isUUID } from "@/lib/api-error";
/**
 * GET /api/reviews — List reviews created by authenticated user ("Đánh giá từ tôi")
 * POST /api/reviews — Add a new review
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-pg";
import { query, transaction } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { user, errorResponse } = await requireAuth(request);
  if (errorResponse) return errorResponse;

  const rows = await query(
    `SELECT r.id, r.reviewer_id, r.target_user_id, r.product_id, r.rating, r.content, r.created_at,
            tu.full_name AS target_user_name, tu.university AS target_user_school,
            p.title AS listing_title
     FROM reviews r
     LEFT JOIN users tu ON tu.id = r.target_user_id
     LEFT JOIN products p ON p.id = r.product_id
     WHERE r.reviewer_id = $1
     ORDER BY r.created_at DESC`,
    [user!.pgUserId]
  );

  return NextResponse.json({
    reviews: rows.map(r => ({
      id: r.id,
      reviewerId: r.reviewer_id,
      reviewerName: user!.fullName,
      targetUserId: r.target_user_id,
      targetUserName: r.target_user_name || "Thành viên SangTay",
      targetRole: "Người bán",
      listingId: r.product_id || null,
      listingTitle: r.listing_title || "Giao dịch P2P",
      rating: r.rating,
      content: r.content,
      createdAt: r.created_at?.toISOString() || "",
    })),
  });
}

export async function POST(request: NextRequest) {
  const { user, errorResponse } = await requireAuth(request);
  if (errorResponse) return errorResponse;
  try {
    const { targetUserId, productId, rating, content } = await request.json();
    if (!isUUID(targetUserId) || !isUUID(productId) || !Number.isInteger(rating) || rating < 1 || rating > 5 || typeof content !== "string" || content.trim().length < 3 || content.length > 2000) throw new ApiError("Đánh giá cần 1–5 sao và nội dung 3–2000 ký tự.");
    const review = await transaction(async c => {
      const {rows:[t]} = await c.query(`SELECT id FROM transactions WHERE listing_id=$1 AND status='COMPLETED'
        AND ((buyer_id=$2 AND seller_id=$3) OR (seller_id=$2 AND buyer_id=$3)) FOR UPDATE`,[productId,user!.pgUserId,targetUserId]);
      if (!t || targetUserId===user!.pgUserId) throw new ApiError("Chỉ được đánh giá đối tác sau giao dịch hoàn tất.",403);
      const existing = await c.query("SELECT id FROM reviews WHERE transaction_id=$1 AND reviewer_id=$2",[t.id,user!.pgUserId]);
      if(existing.rows.length) throw new ApiError("Bạn đã đánh giá giao dịch này.",409);
      const {rows:[review]}=await c.query(`INSERT INTO reviews(reviewer_id,target_user_id,product_id,transaction_id,rating,content) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,created_at`,[user!.pgUserId,targetUserId,productId,t.id,rating,content.trim()]);
      return review;
    });
    return NextResponse.json({success:true,review},{status:201});
  } catch(e) { return apiError(e); }
}
