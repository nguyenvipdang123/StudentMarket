import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { isUUID, apiError } from "@/lib/api-error";
import { productSelect, mapProduct } from "@/lib/products";
export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUUID(id)) return NextResponse.json({ error: "Không tìm thấy người bán." }, { status: 404 });
  try {
    const [people, products, reviews] = await Promise.all([
      query("SELECT id,full_name,university,created_at,auth_status FROM users WHERE id=$1",[id]),
      query(productSelect + " WHERE p.seller_id=$1 AND p.moderation_status='APPROVED' AND p.status IN ('Active','Sold') ORDER BY p.created_at DESC",[id]),
      query(`SELECT r.id,r.rating,r.content,r.created_at,u.full_name AS reviewer_name,p.title AS listing_title,
        (t.status='COMPLETED' AND t.seller_confirmed_at IS NOT NULL AND t.buyer_confirmed_at IS NOT NULL
          AND t.listing_id=r.product_id AND ((t.buyer_id=r.reviewer_id AND t.seller_id=r.target_user_id)
            OR (t.seller_id=r.reviewer_id AND t.buyer_id=r.target_user_id))) AS verified_transaction
        FROM reviews r LEFT JOIN users u ON u.id=r.reviewer_id LEFT JOIN products p ON p.id=r.product_id
        LEFT JOIN transactions t ON t.id=r.transaction_id
        WHERE r.target_user_id=$1 ORDER BY r.created_at DESC`,[id]),
    ]);
    if (!people.length) return NextResponse.json({ error: "Không tìm thấy người bán." }, { status: 404 });
    const person=people[0];
    return NextResponse.json({ seller: { id: person.id, fullName: person.full_name, university: person.university, joinedAt: person.created_at, verified: person.auth_status === "verified" }, products: products.map(mapProduct), reviews: reviews.map(r=>({ id:r.id, rating:Number(r.rating), content:r.content, reviewerName:r.reviewer_name || "Thành viên SangTay", listingTitle:r.listing_title || "Giao dịch P2P", createdAt:r.created_at,verifiedTransaction:r.verified_transaction===true })) });
  } catch (error) { return apiError(error); }
}
