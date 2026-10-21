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
            p.title AS listing_title,t.buyer_id AS transaction_buyer_id,
            r.transaction_id,
            (t.status='COMPLETED' AND t.seller_confirmed_at IS NOT NULL AND t.buyer_confirmed_at IS NOT NULL
              AND t.listing_id=r.product_id AND ((t.buyer_id=r.reviewer_id AND t.seller_id=r.target_user_id)
                OR (t.seller_id=r.reviewer_id AND t.buyer_id=r.target_user_id))) AS verified_transaction
     FROM reviews r
     LEFT JOIN users tu ON tu.id = r.target_user_id
     LEFT JOIN products p ON p.id = r.product_id
     LEFT JOIN transactions t ON t.id=r.transaction_id
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
      targetRole: r.transaction_buyer_id===r.reviewer_id || !r.transaction_id ? "Người bán" : "Người mua",
      transactionId: r.transaction_id || null,
      verifiedTransaction: r.verified_transaction===true,
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
  if (user!.role!=='student') return NextResponse.json({error:'Chỉ sinh viên được đánh giá giao dịch.'},{status:403});
  try {
    let body;try {body=await request.json();}catch {throw new ApiError('Dữ liệu đánh giá không hợp lệ.');}
    if (!body || typeof body!=='object' || Array.isArray(body)) throw new ApiError('Dữ liệu đánh giá không hợp lệ.');
    const { transactionId, targetUserId, productId, rating, content } = body;
    if ((transactionId!==undefined ? !isUUID(transactionId) : !isUUID(targetUserId) || !isUUID(productId)) || !Number.isInteger(rating) || rating < 1 || rating > 5 || typeof content !== "string" || content.trim().length < 3 || content.length > 2000) throw new ApiError("Chọn giao dịch hợp lệ, 1–5 sao và nội dung 3–2000 ký tự.");
    const review = await transaction(async c => {
      // Older listing forms can still resolve their single completed sale. New forms send its exact ID.
      const {rows:[t]} = transactionId ? await c.query(`SELECT * FROM transactions WHERE id=$1
        AND (buyer_id=$2 OR seller_id=$2) FOR UPDATE`,[transactionId,user!.pgUserId]) : await c.query(`SELECT * FROM transactions WHERE listing_id=$1 AND status='COMPLETED'
        AND ((buyer_id=$2 AND seller_id=$3) OR (seller_id=$2 AND buyer_id=$3)) FOR UPDATE`,[productId,user!.pgUserId,targetUserId]);
      if (!t || t.status!=='COMPLETED' || !t.seller_confirmed_at || !t.buyer_confirmed_at) throw new ApiError("Chỉ được đánh giá đối tác sau khi hai bên xác nhận giao dịch hoàn tất.",403);
      const partner=t.buyer_id===user!.pgUserId?t.seller_id:t.buyer_id;
      if (partner===user!.pgUserId || (targetUserId!==undefined && targetUserId!==partner) || (productId!==undefined && productId!==t.listing_id)) throw new ApiError('Đối tác hoặc món đồ không khớp giao dịch.',400);
      const existing = await c.query("SELECT id FROM reviews WHERE transaction_id=$1 AND reviewer_id=$2",[t.id,user!.pgUserId]);
      if(existing.rows.length) throw new ApiError("Bạn đã đánh giá giao dịch này.",409);
      const {rows:[review]}=await c.query(`INSERT INTO reviews(reviewer_id,target_user_id,product_id,transaction_id,rating,content) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,created_at`,[user!.pgUserId,partner,t.listing_id,t.id,rating,content.trim()]);
      return review;
    });
    return NextResponse.json({success:true,review},{status:201});
  } catch(e) { return apiError(e); }
}
