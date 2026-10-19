import { randomUUID } from "node:crypto";
import { query, transaction } from "./db.ts";
import { AI_POLICY_VERSION, preflightReview, listingFingerprint, canAutoApprove, type AiListing, type AiVerdict } from "./ai-moderation-policy.ts";
import { evaluateListing, moderationModel } from "./ai-moderation-provider.ts";

const select = `SELECT p.id::text,p.seller_id::text,p.user_id::text,p.title,p.description,p.price,p.condition,p.location,p.status,p.moderation_status,p.updated_at::text AS revision,
  c.name AS category,u.auth_status,
  COALESCE((SELECT json_agg(pi.image_url ORDER BY pi.is_primary DESC,pi.sort_order,pi.id) FROM product_images pi WHERE pi.product_id=p.id),'[]'::json) AS images
  FROM products p LEFT JOIN categories c ON c.id=p.category_id LEFT JOIN users u ON u.id=p.seller_id`;
function mapListing(row: Record<string, unknown>): AiListing {
  return { id: String(row.id), sellerId: row.seller_id as string | null, userId: row.user_id as string | null,
    sellerVerified: row.auth_status === "verified", title: String(row.title || ""), description: String(row.description || ""), category: String(row.category || ""),
    condition: String(row.condition || ""), price: Number(row.price), location: String(row.location || ""), status: String(row.status), moderationStatus: String(row.moderation_status), revision: String(row.revision), images: row.images as string[] };
}
export async function aiSchemaReady() {
  const row = (await query("SELECT to_regclass('public.listing_ai_reviews') AS reviews,to_regclass('public.ai_moderation_control') AS control"))[0];
  return Boolean(row.reviews && row.control);
}
export async function aiQueue(actorId: string) {
  const rows = await query(select + ` WHERE p.moderation_status='PENDING' AND p.status='Active'
    AND p.seller_id IS DISTINCT FROM $1::uuid AND p.user_id IS DISTINCT FROM $1::uuid
    AND NOT EXISTS(SELECT 1 FROM listing_ai_reviews a WHERE a.listing_id=p.id AND a.content_revision=p.updated_at::text
      AND ((a.policy_version=$3 AND a.model=$2 AND (a.decision IN ('REVIEW','APPROVED') OR a.decision='ERROR' AND a.retry_after>NOW()))
        OR a.decision='PROCESSING' AND a.lease_until>NOW()))
    ORDER BY p.created_at ASC LIMIT 2`, [actorId, moderationModel(), AI_POLICY_VERSION]);
  return rows.map(mapListing);
}
export async function getAiListing(id: string) {
  const row = (await query(select + " WHERE p.id=$1", [id]))[0];
  return row ? mapListing(row) : null;
}
export type AiRunResult = { id: string; title: string; decision: string; reason: string; confidence?: number | null; flags?: string[]; imagesChecked?: number };

export async function runAiListing(listing: AiListing, actorId: string, workerGeneration?: number): Promise<AiRunResult> {
  const base = { id: listing.id, title: listing.title };
  if (listing.sellerId === actorId || listing.userId === actorId) return { ...base, decision: "SKIPPED", reason: "Không tự duyệt tin của chính mình." };
  if (listing.moderationStatus !== "PENDING" || listing.status !== "Active") return { ...base, decision: "SKIPPED", reason: "Tin không còn ở hàng chờ." };
  const fingerprint = listingFingerprint(listing), token = randomUUID();
  const claimed = await query(`INSERT INTO listing_ai_reviews(listing_id,fingerprint,content_revision,decision,model,reviewed_by,lease_until,claim_token,policy_version)
    VALUES($1,$2,$3,'PROCESSING',$4,$5,NOW()+INTERVAL '2 minutes',$6,$7)
    ON CONFLICT(listing_id) DO UPDATE SET fingerprint=$2,content_revision=$3,decision='PROCESSING',model=$4,reviewed_by=$5,lease_until=NOW()+INTERVAL '2 minutes',claim_token=$6,policy_version=$7,analyzed_at=NOW(),reason='',confidence=NULL,flags='[]',auto_approved=FALSE,images_checked=0
    WHERE (listing_ai_reviews.decision<>'PROCESSING' OR listing_ai_reviews.lease_until<=NOW())
      AND (listing_ai_reviews.fingerprint<>$2 OR listing_ai_reviews.model IS DISTINCT FROM $4 OR listing_ai_reviews.policy_version IS DISTINCT FROM $7 OR listing_ai_reviews.decision='ERROR' AND listing_ai_reviews.retry_after<=NOW()
      OR listing_ai_reviews.decision='PROCESSING' AND listing_ai_reviews.lease_until<=NOW())
    RETURNING listing_id`, [listing.id, fingerprint, listing.revision, moderationModel(), actorId, token, AI_POLICY_VERSION]);
  if (!claimed.length) return { ...base, decision: "SKIPPED", reason: "Tin đã được AI kiểm tra hoặc đang được xử lý." };

  let verdict: AiVerdict | null = null, reason = preflightReview(listing), decision: "REVIEW" | "ERROR" = "REVIEW";
  if (!reason) {
    try { verdict = await evaluateListing(listing); reason = verdict.reason; }
    catch (e) { decision = "ERROR"; reason = e instanceof Error ? e.message : "Chưa phân tích được; cần Admin kiểm tra."; }
  }
  return transaction(async client => {
    let workerAllowed = true;
    if (workerGeneration !== undefined) {
      const control = (await client.query("SELECT enabled,actor_id,generation FROM ai_moderation_control WHERE id=TRUE FOR SHARE")).rows[0];
      workerAllowed = Boolean(control?.enabled && control.actor_id === actorId && Number(control.generation) === workerGeneration);
    }
    const ownership = await client.query("SELECT 1 FROM listing_ai_reviews WHERE listing_id=$1 AND claim_token=$2 FOR UPDATE", [listing.id, token]);
    if (!ownership.rowCount) return { ...base, decision: "SKIPPED", reason: "Kết quả này đã hết hiệu lực." };
    const row = (await client.query(select + " WHERE p.id=$1 FOR UPDATE OF p", [listing.id])).rows[0];
    const current = row ? mapListing(row) : null;
    const actor = (await client.query("SELECT 1 FROM staff_accounts WHERE actor_id=$1 AND role='admin' AND status='verified' FOR SHARE", [actorId])).rowCount;
    if (!workerAllowed || !actor || !current || current.moderationStatus !== "PENDING" || listingFingerprint(current) !== fingerprint) {
      // Content or permissions changed while the provider was working: never apply the old approval.
      await client.query("DELETE FROM listing_ai_reviews WHERE listing_id=$1 AND claim_token=$2", [listing.id, token]);
      return { ...base, decision: "STALE", reason: "Tin hoặc quyền kiểm duyệt đã thay đổi; không áp dụng kết quả cũ." };
    }
    let revision = current.revision;
    const approve = verdict !== null && canAutoApprove(verdict, current);
    if (approve) {
      const updated = await client.query(`UPDATE products SET moderation_status='APPROVED',moderated_by=$2,moderated_at=NOW(),rejection_reason=NULL,updated_at=NOW()
        WHERE id=$1 AND moderation_status='PENDING' RETURNING updated_at::text AS revision`, [listing.id, actorId]);
      revision = updated.rows[0].revision;
    }
    const finalDecision = approve ? "APPROVED" : decision;
    if (verdict && !approve && verdict.decision === "APPROVE") reason = "Chưa đạt ngưỡng tự duyệt hoặc còn cảnh báo. " + reason;
    await client.query(`UPDATE listing_ai_reviews SET decision=$3::text,content_revision=$4::text,confidence=$5,reason=$6::text,flags=$7::jsonb,images_checked=$8,auto_approved=$9,
      analyzed_at=NOW(),lease_until=NULL,claim_token=NULL,retry_after=CASE WHEN $3::text='ERROR' THEN NOW()+INTERVAL '15 minutes' ELSE NULL END
      WHERE listing_id=$1 AND claim_token=$2`, [listing.id, token, finalDecision, revision, verdict?.confidence ?? null, reason, JSON.stringify(verdict?.flags || []), verdict?.imagesChecked || 0, approve]);
    await client.query(`INSERT INTO audit_logs(id,actor_id,action,target_type,target_id,description,created_at) VALUES(gen_random_uuid(),$1,$2,'LISTING',$3,$4,NOW())`,
      [actorId, approve ? "AI_APPROVE_LISTING" : "AI_REVIEW_LISTING", listing.id, `[${moderationModel()}] ${reason}`]);
    return { ...base, decision: finalDecision, reason: reason || "Cần Admin kiểm tra.", confidence: verdict?.confidence ?? null, flags: verdict?.flags || [], imagesChecked: verdict?.imagesChecked || 0 };
  });
}
