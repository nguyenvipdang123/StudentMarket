import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-pg";
import { query } from "@/lib/db";
import { apiError, ApiError, isUUID } from "@/lib/api-error";
import { aiSchemaReady, aiQueue, getAiListing, runAiListing } from "@/lib/ai-moderation";
import { moderationConfigured, moderationModel } from "@/lib/ai-moderation-provider";
import { AI_APPROVAL_THRESHOLD } from "@/lib/ai-moderation-policy";
import { workerStatus, setWorkerEnabled } from "@/lib/ai-worker-control";
export const runtime = "nodejs";
export const maxDuration = 60;
async function admin(request: NextRequest) {
  const result = await requireAuth(request);
  if (result.errorResponse) return result;
  if (result.user?.role !== "admin") return { ...result, errorResponse: NextResponse.json({ error: "Chỉ Admin được vận hành AI tự duyệt." }, { status: 403 }) };
  return result;
}
export async function GET(request: NextRequest) {
  try {
    const auth = await admin(request); if (auth.errorResponse) return auth.errorResponse;
    const schemaReady = await aiSchemaReady();
    const results = schemaReady ? await query(`SELECT a.listing_id AS id,p.title,a.decision,a.reason,a.confidence,a.images_checked AS "imagesChecked",a.analyzed_at AS "analyzedAt",a.flags
      FROM listing_ai_reviews a JOIN products p ON p.id=a.listing_id WHERE a.content_revision=p.updated_at::text ORDER BY a.analyzed_at DESC LIMIT 20`) : [];
    const worker = schemaReady ? await workerStatus() : null;
    return NextResponse.json({ configured: moderationConfigured(), schemaReady, model: moderationModel(), threshold: AI_APPROVAL_THRESHOLD, results, worker }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) { return apiError(e); }
}
export async function PATCH(request: NextRequest) {
  try {
    const auth = await admin(request); if (auth.errorResponse) return auth.errorResponse;
    if (!await aiSchemaReady()) throw new ApiError("Chạy npm run db:migrate:ai trước khi bật worker.", 503);
    const body = await request.json();
    if (!body || typeof body !== "object" || typeof body.enabled !== "boolean") throw new ApiError("Trạng thái bật/tắt không hợp lệ.");
    if (body.enabled && !moderationConfigured()) throw new ApiError("Chưa cấu hình Gemini API key ở server.", 503);
    await setWorkerEnabled(body.enabled, auth.user!.pgUserId);
    return NextResponse.json({ worker: await workerStatus() });
  } catch (e) { return apiError(e); }
}
export async function POST(request: NextRequest) {
  try {
    const auth = await admin(request); if (auth.errorResponse) return auth.errorResponse;
    if (!moderationConfigured()) throw new ApiError("Chưa cấu hình Gemini API key ở server.", 503);
    if (!await aiSchemaReady()) throw new ApiError("Chưa có bảng kiểm duyệt AI. Chạy npm run db:migrate:ai.", 503);
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new ApiError("Dữ liệu không hợp lệ.");
    if (body.listingIds !== undefined && (!Array.isArray(body.listingIds) || body.listingIds.length < 1 || body.listingIds.length > 2 || body.listingIds.some((id: unknown) => !isUUID(id)))) throw new ApiError("Chọn từ 1 đến 2 tin hợp lệ.");
    const actor = auth.user!.pgUserId;
    const listings = body.listingIds ? (await Promise.all([...new Set(body.listingIds as string[])].map(getAiListing))).filter(listing => listing !== null) : await aiQueue(actor);
    const results = await Promise.all(listings.map(listing => runAiListing(listing, actor)));
    return NextResponse.json({ results, approved: results.filter(result => result.decision === "APPROVED").length, review: results.filter(result => result.decision === "REVIEW" || result.decision === "ERROR").length });
  } catch (e) { return apiError(e); }
}
