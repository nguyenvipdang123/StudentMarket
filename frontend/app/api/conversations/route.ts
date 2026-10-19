/**
 * GET /api/conversations — List authenticated user's conversations from PostgreSQL
 * POST /api/conversations — Create/get a conversation
 * 
 * User identity determined from session cookie. NEVER from frontend params.
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-pg";
import { query, transaction } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { user, errorResponse } = await requireAuth(request);
  if (errorResponse) return errorResponse;

  const pgId = user!.pgUserId;

  const rows = await query(
    `SELECT c.id, c.buyer_id, c.seller_id, c.product_id, c.last_message_at, c.created_at,
            b.full_name AS buyer_name, b.university AS buyer_school,
            s.full_name AS seller_name, s.university AS seller_school,
            p.title AS listing_title, p.price AS listing_price, p.status AS listing_status,
            (SELECT pi.image_url FROM product_images pi WHERE pi.product_id = p.id AND pi.is_primary = TRUE LIMIT 1) AS listing_image,
            (SELECT m.content FROM messages m WHERE m.conversation_id = c.id ORDER BY m.sent_at DESC LIMIT 1) AS last_message,
            (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.sender_id != $1 AND m.is_read = FALSE) AS unread_count
     FROM conversations c
     LEFT JOIN users b ON b.id = c.buyer_id
     LEFT JOIN users s ON s.id = c.seller_id
     LEFT JOIN products p ON p.id = c.product_id
     WHERE c.buyer_id = $1 OR c.seller_id = $1
     ORDER BY c.last_message_at DESC`,
    [pgId]
  );

  const conversations = rows.map(r => ({
    id: r.id,
    listingId: r.product_id || "",
    listingTitle: r.listing_title || "Món đồ sinh viên",
    listingImage: r.listing_image || "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=300",
    listingPrice: Number(r.listing_price) || 0,
    listingStatus: r.listing_status || "Active",
    buyerId: r.buyer_id,
    buyerName: r.buyer_name || "Người mua",
    buyerSchool: r.buyer_school || "Đại học",
    sellerId: r.seller_id,
    sellerName: r.seller_name || "Người bán",
    sellerSchool: r.seller_school || "Đại học",
    lastMessage: r.last_message || "Bắt đầu cuộc trò chuyện...",
    updatedAt: r.last_message_at?.toISOString() || "",
    unreadCount: Number(r.unread_count) || 0,
  }));

  return NextResponse.json({ conversations, pgUserId: pgId });
}

export async function POST(request: NextRequest) {
  const { user, errorResponse } = await requireAuth(request);
  if (errorResponse) return errorResponse;
  return transaction(async client => {
    const query = async <T extends import("pg").QueryResultRow = import("pg").QueryResultRow>(sql: string, values?: unknown[]): Promise<T[]> => (await client.query<T>(sql, values)).rows;


  const body = await request.json();
  const listingId = body.listingId || body.listing_id || body.productId;
  let sellerId = body.sellerId || body.seller_id;

  if (!listingId) {
    return NextResponse.json({ error: "listingId is required" }, { status: 400 });
  }

  const buyerId = user!.pgUserId;

  // Section 5: Never trust sellerId from frontend; fetch from products DB
  const prodRows = await query(
    `SELECT seller_id, user_id FROM products WHERE id::text = $1 AND status='Active' AND moderation_status='APPROVED' FOR UPDATE`,
    [listingId]
  );
  if (prodRows.length === 0) {
    return NextResponse.json({ error: "Sản phẩm không tồn tại." }, { status: 404 });
  }
  const realSellerId = String(prodRows[0].seller_id || prodRows[0].user_id);

  // TC-CHAT-05: Don't allow user to message themselves
  if (buyerId === realSellerId) {
    return NextResponse.json({ error: "Bạn không thể nhắn tin với chính mình." }, { status: 400 });
  }

  sellerId = realSellerId;

  // Check if conversation already exists (either buyer or seller)
  const existing = await query(
    `SELECT id FROM conversations 
     WHERE product_id = $1 AND ((buyer_id = $2 AND seller_id = $3) OR (buyer_id = $3 AND seller_id = $2))`,
    [listingId, buyerId, sellerId]
  );

  if (existing.length > 0) {
    return NextResponse.json({ id: existing[0].id, status: "existing", pgUserId: buyerId });
  }

  // Create new conversation
  const rows = await query(
    `INSERT INTO conversations (id, buyer_id, seller_id, product_id, last_message_at, created_at)
     VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW())
     RETURNING id::text`,
    [buyerId, sellerId, listingId]
  );

  return NextResponse.json({ id: rows[0].id, status: "created", pgUserId: buyerId });
  });
}
