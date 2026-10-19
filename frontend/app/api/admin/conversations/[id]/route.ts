import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { error, requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";

export const runtime = "nodejs";

type ConversationRow = {
  id: string;
  product_id: string | null;
  listing_title: string | null;
  buyer_id: string;
  buyer_name: string | null;
  buyer_email: string | null;
  seller_id: string;
  seller_name: string | null;
  seller_email: string | null;
  created_at: Date;
};

type MessageRow = {
  id: string;
  sender_id: string;
  sender_name: string | null;
  content: string;
  sent_at: Date;
  is_read: boolean;
};

const pageSize = 100;

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { response } = await requireAdmin(request);
  if (response) return response;

  const { id } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return error("Cuộc trò chuyện không hợp lệ.");
  }
  const pageText = request.nextUrl.searchParams.get("page") ?? "1";
  if (!/^[1-9]\d{0,3}$/.test(pageText)) return error("Trang tin nhắn không hợp lệ.");
  const page = Number(pageText);

  const [conversation] = await query<ConversationRow>(`
    SELECT c.id, c.product_id, c.buyer_id, c.seller_id, c.created_at,
      p.title AS listing_title, b.full_name AS buyer_name, b.email AS buyer_email,
      s.full_name AS seller_name, s.email AS seller_email
    FROM conversations c
    LEFT JOIN users b ON b.id = c.buyer_id
    LEFT JOIN users s ON s.id = c.seller_id
    LEFT JOIN products p ON p.id = c.product_id
    WHERE c.id = $1
  `, [id]);
  if (!conversation) return error("Không tìm thấy cuộc trò chuyện.", 404);

  const [{ total }] = await query<{ total: number }>(
    "SELECT COUNT(*)::int AS total FROM messages WHERE conversation_id = $1", [id]
  );
  const rows = await query<MessageRow>(`
    SELECT m.id, m.sender_id, u.full_name AS sender_name, m.content, m.sent_at, m.is_read
    FROM messages m
    LEFT JOIN users u ON u.id = m.sender_id
    WHERE m.conversation_id = $1
    ORDER BY m.sent_at DESC, m.id DESC
    LIMIT $2 OFFSET $3
  `, [id, pageSize, (page - 1) * pageSize]);

  return NextResponse.json({
    conversation: {
      id: conversation.id,
      listingId: conversation.product_id,
      listingTitle: conversation.listing_title || "Tin đăng không còn tồn tại",
      buyerId: conversation.buyer_id,
      buyerName: conversation.buyer_name || "Người mua không còn tài khoản",
      buyerEmail: conversation.buyer_email || "",
      sellerId: conversation.seller_id,
      sellerName: conversation.seller_name || "Người bán không còn tài khoản",
      sellerEmail: conversation.seller_email || "",
      createdAt: conversation.created_at.toISOString(),
    },
    messages: rows.reverse().map(row => ({
      id: row.id,
      senderId: row.sender_id,
      senderName: row.sender_name || "Người dùng không còn tài khoản",
      content: row.content,
      sentAt: row.sent_at.toISOString(),
      isRead: row.is_read,
    })),
    page,
    pageSize,
    total,
  }, { headers: { "Cache-Control": "private, no-store" } });
}
