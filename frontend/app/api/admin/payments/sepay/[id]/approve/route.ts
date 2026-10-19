import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-pg";
import { apiError, ApiError } from "@/lib/api-error";
import { approveSePayPackage } from "@/lib/sepay-payments";

export const runtime = "nodejs";
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, errorResponse } = await requireAuth(request);
  if (errorResponse) return errorResponse;
  if (user!.role !== "admin") return NextResponse.json({ error: "Chỉ Admin được duyệt gói thanh toán." }, { status: 403 });
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new ApiError("Dữ liệu không hợp lệ.");
    const { id } = await params;
    const result = await approveSePayPackage(id, body.note, body.confirmed, user!);
    return NextResponse.json({ ...result, message: "Đã duyệt thanh toán và kích hoạt gói cho khách." });
  } catch (error) { return apiError(error); }
}
