import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { error, requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";

export const runtime = "nodejs";

type ConversationRow = {
  id: string;
  product_id: string | null;
  listing_title: string | null;
  buyer_name: string | null;
  buyer_email: string | null;
  seller_name: string | null;
  seller_email: string | null;
  last_message: string | null;
  message_count: number;
  last_message_at: Date | null;
  created_at: Date;
};

const pageSize = 25;
const searchFrom = `
  FROM conversations c
  LEFT JOIN users b ON b.id = c.buyer_id
  LEFT JOIN users s ON s.id = c.seller_id
  LEFT JOIN products p ON p.id = c.product_id
  WHERE ($1 = '' OR p.title ILIKE '%' || $1 || '%'
    OR b.full_name ILIKE '%' || $1 || '%' OR b.email ILIKE '%' || $1 || '%'
    OR s.full_name ILIKE '%' || $1 || '%' OR s.email ILIKE '%' || $1 || '%')
`;

export async function GET(request: NextRequest) {
  const { response } = await requireAdmin(request);
  if (response) return response;

  const search = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const pageText = request.nextUrl.searchParams.get("page") ?? "1";
  if (search.length > 100 || !/^[1-9]\d{0,3}$/.test(pageText)) {
    return error("Điều kiện tìm kiếm không hợp lệ.");
  }
  const page = Number(pageText);
  const [{ total }] = await query<{ total: number }>(`SELECT COUNT(*)::int AS total ${searchFrom}`, [search]);
  const rows = await query<ConversationRow>(`
    WITH page AS (
      SELECT c.id, c.product_id, c.last_message_at, c.created_at,
        p.title AS listing_title, b.full_name AS buyer_name, b.email AS buyer_email,
        s.full_name AS seller_name, s.email AS seller_email
      ${searchFrom}
      ORDER BY COALESCE(c.last_message_at, c.created_at) DESC, c.id DESC
      LIMIT $2 OFFSET $3
    )
    SELECT page.*, recent.content AS last_message, stats.message_count
    FROM page
    LEFT JOIN LATERAL (
      SELECT m.content FROM messages m WHERE m.conversation_id = page.id
      ORDER BY m.sent_at DESC, m.id DESC LIMIT 1
    ) recent ON TRUE
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS message_count FROM messages m WHERE m.conversation_id = page.id
    ) stats ON TRUE
    ORDER BY COALESCE(page.last_message_at, page.created_at) DESC, page.id DESC
  `, [search, pageSize, (page - 1) * pageSize]);

  return NextResponse.json({
    conversations: rows.map(row => ({
      id: row.id,
      listingId: row.product_id,
      listingTitle: row.listing_title || "Tin đăng không còn tồn tại",
      buyerName: row.buyer_name || "Người mua không còn tài khoản",
      buyerEmail: row.buyer_email || "",
      sellerName: row.seller_name || "Người bán không còn tài khoản",
      sellerEmail: row.seller_email || "",
      lastMessage: row.last_message || "Chưa có tin nhắn",
      messageCount: row.message_count,
      lastMessageAt: row.last_message_at?.toISOString() || row.created_at.toISOString(),
      createdAt: row.created_at.toISOString(),
    })),
    page,
    pageSize,
    total,
  }, { headers: { "Cache-Control": "private, no-store" } });
}
