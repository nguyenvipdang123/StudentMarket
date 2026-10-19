import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-pg";
import { apiError, ApiError } from "@/lib/api-error";
import { listNotifications, markNotificationsRead } from "@/lib/notifications";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { user, errorResponse } = await requireAuth(request);
    if (errorResponse) return errorResponse;
    return NextResponse.json(await listNotifications(user!), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
export async function PATCH(request: NextRequest) {
  try {
    const { user, errorResponse } = await requireAuth(request);
    if (errorResponse) return errorResponse;
    const raw = await request.text();
    if (raw.length>30000) throw new ApiError("Dữ liệu quá dài.",413);
    const body = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new ApiError("Dữ liệu không hợp lệ.");
    const ids = body.all === true ? null : body.ids;
    if (ids===null && body.all!==true) throw new ApiError("Chọn thông báo hợp lệ.");
    if (ids !== null && (!Array.isArray(ids) || ids.length<1 || ids.length>100 || ids.some(id => typeof id!=="string" || id.length>240))) throw new ApiError("Chọn thông báo hợp lệ.");
    await markNotificationsRead(user!, ids);
    return NextResponse.json(await listNotifications(user!), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
