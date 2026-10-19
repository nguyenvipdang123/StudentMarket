/**
 * GET /api/conversations/[id]/messages — Get messages for a conversation
 * Only accessible by buyer or seller of the conversation (403 otherwise).
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-pg";
import { query, transaction } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, errorResponse } = await requireAuth(request);
  if (errorResponse) return errorResponse;

  const { id: conversationId } = await params;
  const pgId = user!.pgUserId;

  // Verify user is a participant
  const convRows = await query(
    `SELECT c.id, c.buyer_id, c.seller_id, c.product_id,
            b.full_name AS buyer_name, b.university AS buyer_school,
            s.full_name AS seller_name, s.university AS seller_school,
            p.title AS listing_title, p.price AS listing_price, p.status AS listing_status,
            (SELECT pi.image_url FROM product_images pi WHERE pi.product_id = p.id AND pi.is_primary = TRUE LIMIT 1) AS listing_image
     FROM conversations c
     LEFT JOIN users b ON b.id = c.buyer_id
     LEFT JOIN users s ON s.id = c.seller_id
     LEFT JOIN products p ON p.id = c.product_id
     WHERE c.id = $1`,
    [conversationId]
  );

  if (convRows.length === 0) {
    return NextResponse.json({ error: "Cuộc trò chuyện không tồn tại." }, { status: 404 });
  }

  const conv = convRows[0];
  const isBuyer = String(conv.buyer_id) === pgId;
  const isSeller = String(conv.seller_id) === pgId;

  if (!isBuyer && !isSeller) {
    return NextResponse.json(
      { error: "Bạn không có quyền xem cuộc trò chuyện này." },
      { status: 403 }
    );
  }

  await query("UPDATE messages SET is_read=TRUE,read_at=NOW() WHERE conversation_id=$1 AND sender_id<>$2 AND is_read=FALSE",[conversationId,pgId]);
  // Get messages
  const msgRows = await query(
    `SELECT m.id, m.conversation_id, m.sender_id, m.content, m.sent_at, m.is_read, m.read_at,
            u.full_name AS sender_name
     FROM messages m
     LEFT JOIN users u ON u.id = m.sender_id
     WHERE m.conversation_id = $1
     ORDER BY m.sent_at ASC`,
    [conversationId]
  );

  return NextResponse.json({
    conversation: {
      id: conv.id,
      buyerId: conv.buyer_id,
      buyerName: conv.buyer_name,
      buyerSchool: conv.buyer_school,
      sellerId: conv.seller_id,
      sellerName: conv.seller_name,
      sellerSchool: conv.seller_school,
      listingId: conv.product_id,
      listingTitle: conv.listing_title || "Món đồ",
      listingImage: conv.listing_image || "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=300",
      listingPrice: Number(conv.listing_price) || 0,
      listingStatus: conv.listing_status || "Active",
    },
    messages: msgRows.map(m => ({
      id: m.id,
      conversationId: m.conversation_id,
      senderId: m.sender_id,
      senderName: m.sender_name || "Người dùng",
      content: m.content,
      sentAt: m.sent_at?.toISOString() || "",
      isRead: Boolean(m.is_read),
      readAt: m.read_at?.toISOString() || null,
    })),
    pgUserId: pgId,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, errorResponse } = await requireAuth(request);
  if (errorResponse) return errorResponse;
  return transaction(async client => {
    const query = async <T extends import("pg").QueryResultRow = import("pg").QueryResultRow>(sql: string, values?: unknown[]): Promise<T[]> => (await client.query<T>(sql, values)).rows;


  const { id: conversationId } = await params;
  const pgId = user!.pgUserId;

  const convRows = await query(
    `SELECT buyer_id, seller_id FROM conversations WHERE id = $1`,
    [conversationId]
  );

  if (convRows.length === 0) {
    return NextResponse.json({ error: "Cuộc trò chuyện không tồn tại." }, { status: 404 });
  }

  const conv = convRows[0];
  const isBuyer = String(conv.buyer_id) === pgId;
  const isSeller = String(conv.seller_id) === pgId;

  if (!isBuyer && !isSeller) {
    return NextResponse.json(
      { error: "Bạn không có quyền gửi tin nhắn trong cuộc trò chuyện này." },
      { status: 403 }
    );
  }

  const body = await request.json();
  const content = String(body.content || "").trim();

  if (!content || content.length > 5000) {
    return NextResponse.json({ error: "Nội dung tin nhắn không được để trống." }, { status: 400 });
  }

  const msgRows = await query<{ id: string; sent_at: Date }>(
    `INSERT INTO messages (id, conversation_id, sender_id, content, sent_at, is_read)
     VALUES (gen_random_uuid(), $1, $2, $3, NOW(), FALSE)
     RETURNING id::text, sent_at`,
    [conversationId, pgId, content]
  );

  await query(
    `UPDATE conversations SET last_message_at = NOW() WHERE id = $1`,
    [conversationId]
  );

  return NextResponse.json({
    success: true,
    message: {
      id: msgRows[0].id,
      conversationId,
      senderId: pgId,
      senderName: user!.fullName,
      content,
      sentAt: msgRows[0].sent_at?.toISOString() || new Date().toISOString(),
      isRead: false,
    },
  }, { status: 201 });
  });
}
