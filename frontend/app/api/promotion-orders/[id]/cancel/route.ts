import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-pg";
import { apiError, ApiError } from "@/lib/api-error";
import { cancelPromotionOrder } from "@/lib/sepay-payments";

export const runtime = "nodejs";
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, errorResponse } = await requireAuth(request);
  if (errorResponse) return errorResponse;
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new ApiError("Dữ liệu không hợp lệ.");
    const order = await cancelPromotionOrder((await params).id, body.confirmed, user!);
    return NextResponse.json({ order, message: "Đã hủy đơn thanh toán. Bạn có thể chọn gói và tạo đơn mới." });
  } catch (error) { return apiError(error); }
}
