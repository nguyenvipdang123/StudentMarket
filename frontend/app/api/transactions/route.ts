/**
 * GET /api/transactions — List user's buying and selling transactions
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

  const rows = await query(
    `SELECT t.*, 
            p.title AS listing_title, p.price AS listing_price,
            s.full_name AS seller_name, b.full_name AS buyer_name
     FROM transactions t
     JOIN products p ON p.id = t.listing_id
     JOIN users s ON s.id = t.seller_id
     JOIN users b ON b.id = t.buyer_id
     WHERE t.seller_id = $1 OR t.buyer_id = $1
     ORDER BY t.created_at DESC`,
    [pgUserId]
  );

  return NextResponse.json({
    transactions: rows.map(r => ({
      id: r.id,
      listingId: r.listing_id,
      listingTitle: r.listing_title,
      listingPrice: Number(r.listing_price),
      sellerId: r.seller_id,
      sellerName: r.seller_name,
      buyerId: r.buyer_id,
      buyerName: r.buyer_name,
      isBuyer: String(r.buyer_id) === pgUserId,
      isSeller: String(r.seller_id) === pgUserId,
      status: r.status,
      saleSource: r.sale_source,
      sellerConfirmedAt: r.seller_confirmed_at?.toISOString() || null,
      buyerConfirmedAt: r.buyer_confirmed_at?.toISOString() || null,
      completedAt: r.completed_at?.toISOString() || null,
      createdAt: r.created_at?.toISOString() || "",
    })),
  });
}
