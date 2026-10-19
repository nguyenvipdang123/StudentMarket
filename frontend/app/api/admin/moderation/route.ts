/**
 * GET /api/admin/moderation — List listings for moderation queue (Admin/Staff only)
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-pg";
import { query } from "@/lib/db";
import { aiSchemaReady } from "@/lib/ai-moderation";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { user, errorResponse } = await requireAuth(request);
  if (errorResponse) return errorResponse;

  const role = String(user!.role || "").toLowerCase();
  if (role !== "admin" && role !== "staff") {
    return NextResponse.json({ error: "Chỉ quản trị viên hoặc nhân viên mới có quyền kiểm duyệt." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get("status") || "ALL";

  let sql = `
    SELECT p.id, p.title, p.price, p.status, p.moderation_status, p.condition, p.location, p.description,
           p.created_at, p.seller_id, p.moderated_at, p.rejection_reason,
           u.full_name AS seller_name, u.email AS seller_email, u.university AS seller_school,
           (SELECT pi.image_url FROM product_images pi WHERE pi.product_id = p.id AND pi.is_primary = TRUE LIMIT 1) AS image
    FROM products p
    LEFT JOIN users u ON u.id = p.seller_id
  `;

  const params: unknown[] = [];
  if (statusFilter !== "ALL") {
    sql += ` WHERE p.moderation_status = $1`;
    params.push(statusFilter);
  }
  sql += ` ORDER BY p.created_at DESC`;

  const rows = await query(sql, params);
  const aiRows = await aiSchemaReady() ? await query(`SELECT a.listing_id,a.decision,a.confidence,a.reason,a.model,a.images_checked,a.analyzed_at
    FROM listing_ai_reviews a JOIN products p ON p.id=a.listing_id WHERE a.content_revision=p.updated_at::text`) : [];
  const aiResults = new Map(aiRows.map(r => [String(r.listing_id), { decision: r.decision, confidence: r.confidence, reason: r.reason, model: r.model, imagesChecked: r.images_checked, analyzedAt: r.analyzed_at }]));

  return NextResponse.json({
    listings: rows.map(r => ({
      id: r.id,
      title: r.title,
      price: Number(r.price),
      status: r.status,
      moderationStatus: r.moderation_status,
      condition: r.condition,
      location: r.location,
      description: r.description,
      sellerName: r.seller_name,
      sellerEmail: r.seller_email,
      sellerSchool: r.seller_school,
      image: r.image || "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=300",
      rejectionReason: r.rejection_reason || null,
      createdAt: r.created_at?.toISOString() || "",
      ai: aiResults.get(String(r.id)) || null,
    })),
  });
}
