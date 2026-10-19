import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-pg";
import { apiError } from "@/lib/api-error";
import { deletePromotionPackage, packageFields, packageId, updatePromotionPackage } from "@/lib/promotion-packages";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: NextRequest, { params }: Context) {
  const { user, errorResponse } = await requireAuth(request);
  if (errorResponse) return errorResponse;
  if (user!.role !== "admin") return NextResponse.json({ error: "Chỉ Admin được sửa gói dịch vụ." }, { status: 403 });
  try {
    const id = packageId((await params).id), fields = packageFields(await request.json(), true);
    const updated = await updatePromotionPackage(id, fields, user!.pgUserId);
    return NextResponse.json({ success: true, message: "Đã cập nhật gói dịch vụ.", package: updated });
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: NextRequest, { params }: Context) {
  const { user, errorResponse } = await requireAuth(request);
  if (errorResponse) return errorResponse;
  if (user!.role !== "admin") return NextResponse.json({ error: "Chỉ Admin được xóa gói dịch vụ." }, { status: 403 });
  try {
    await deletePromotionPackage(packageId((await params).id), user!.pgUserId);
    return NextResponse.json({ success: true, message: "Đã xóa gói khỏi danh sách bán. Lịch sử đơn và gói đã mua được giữ nguyên." });
  } catch (error) { return apiError(error); }
}
