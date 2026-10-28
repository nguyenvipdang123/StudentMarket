import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-pg";
import { ApiError, apiError } from "@/lib/api-error";
import { changeOwnedListing } from "@/lib/owned-listings";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: NextRequest, { params }: Context) {
  const { user, errorResponse } = await requireAuth(request);
  if (errorResponse) return errorResponse;
  try {
    const body = await request.json();
    if (!body || !["Active", "Hidden"].includes(body.status)) throw new ApiError("Chọn ẩn hoặc hiện lại tin.");
    return NextResponse.json(await changeOwnedListing((await params).id, user!.pgUserId, body.status === "Hidden" ? "hide" : "show", body.expectedStatus));
  } catch (error) { return apiError(error); }
}
export async function DELETE(request: NextRequest, { params }: Context) {
  const { user, errorResponse } = await requireAuth(request);
  if (errorResponse) return errorResponse;
  try {
    const body = await request.json();
    if (body?.confirmed !== true) throw new ApiError("Xác nhận xóa tin trước khi tiếp tục.");
    return NextResponse.json(await changeOwnedListing((await params).id, user!.pgUserId, "delete", body.expectedStatus));
  } catch (error) { return apiError(error); }
}
