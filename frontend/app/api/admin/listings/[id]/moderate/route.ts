/**
 * PATCH /api/admin/listings/[id]/moderate — Approve or Reject a listing (Admin & Staff)
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-pg";
import { query, logAudit } from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, errorResponse } = await requireAuth(request);
  if (errorResponse) return errorResponse;

  const role = String(user!.role || "").toLowerCase();
  if (role !== "admin" && role !== "staff") {
    return NextResponse.json({ error: "Chỉ quản trị viên hoặc nhân viên mới có quyền kiểm duyệt tin." }, { status: 403 });
  }

  const { id: listingId } = await params;
  const body = await request.json();
  const action = String(body.action || "").toUpperCase();
  const reason = String(body.rejectionReason || body.reason || "").trim();

  if (!["APPROVE", "REJECT"].includes(action)) {
    return NextResponse.json({ error: "Thao tác không hợp lệ. Chỉ chấp nhận APPROVE hoặc REJECT." }, { status: 400 });
  }

  // TC-MOD-05: Rejection requires a reason
  if (action === "REJECT" && !reason) {
    return NextResponse.json({ error: "Vui lòng nhập lý do từ chối duyệt tin." }, { status: 400 });
  }

  // 1. Fetch listing and check self-moderation (TC-MOD-02)
  const existingRows = await query(
    `SELECT id, seller_id, user_id, title, moderation_status
     FROM products
     WHERE id::text = $1
     LIMIT 1`,
    [listingId]
  );

  if (existingRows.length === 0) {
    return NextResponse.json({ error: "Tin đăng không tồn tại." }, { status: 404 });
  }

  const listing = existingRows[0];
  const isOwner = String(listing.seller_id) === user!.pgUserId || String(listing.user_id) === user!.pgUserId;

  if (isOwner) {
    return NextResponse.json(
      { error: "Bạn không thể tự duyệt hoặc từ chối tin đăng của chính mình." },
      { status: 403 }
    );
  }

  const newModerationStatus = action === "APPROVE" ? "APPROVED" : "REJECTED";

  // 2. Update listing moderation status, moderated_by, moderated_at, rejection_reason
  const rows = await query<{ id: string; title: string; moderation_status: string }>(
    `UPDATE products
     SET moderation_status = $1,
         moderated_by = $2,
         moderated_at = NOW(),
         rejection_reason = $3,
         updated_at = NOW()
     WHERE id = $4
     RETURNING id::text, title, moderation_status`,
    [newModerationStatus, user!.pgUserId, action === "REJECT" ? reason : null, listing.id]
  );

  const updatedListing = rows[0];

  // 3. If rejected, stop any active promotions
  if (newModerationStatus === "REJECTED") {
    await query(
      `UPDATE listing_promotions
       SET status = 'CANCELLED', updated_at = NOW()
       WHERE listing_id = $1 AND status = 'ACTIVE'`,
      [updatedListing.id]
    );
  }

  // 4. Record Audit Log (Section 13 & 38)
  await logAudit({
    actorId: user!.pgUserId,
    action: action === "APPROVE" ? "APPROVE_LISTING" : "REJECT_LISTING",
    targetType: "LISTING",
    targetId: updatedListing.id,
    description: action === "APPROVE"
      ? `Duyệt công khai tin đăng: ${updatedListing.title}`
      : `Từ chối tin đăng: ${updatedListing.title} (Lý do: ${reason})`,
  });

  return NextResponse.json({
    success: true,
    message: action === "APPROVE" ? "Đã duyệt tin thành công!" : "Đã từ chối duyệt tin.",
    listing: {
      id: updatedListing.id,
      title: updatedListing.title,
      moderationStatus: updatedListing.moderation_status,
      rejectionReason: action === "REJECT" ? reason : null,
    },
  });
}
