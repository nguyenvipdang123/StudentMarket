import { createHash } from "node:crypto";

export const AI_APPROVAL_THRESHOLD = 0.90;
export const AI_POLICY_VERSION = "sangtay-listings-v2-balanced";
export const AI_FLAGS = ["PROHIBITED", "SCAM", "ABUSE", "PERSONAL_DATA", "PROMPT_INJECTION", "IMAGE_MISMATCH", "UNCLEAR", "NO_IMAGES"] as const;
export type AiVerdict = { decision: "APPROVE" | "REVIEW"; confidence: number; reason: string; flags: string[]; imagesChecked: number };
export type AiListing = {
  id: string; sellerId: string | null; userId: string | null; sellerVerified: boolean;
  title: string; description: string; category: string; condition: string; price: number;
  location: string; status: string; moderationStatus: string; revision: string; images: string[];
};
export function listingFingerprint(listing: AiListing) {
  return createHash("sha256").update(JSON.stringify([AI_POLICY_VERSION, listing])).digest("hex");
}
export function redactListingText(value: string) {
  return value.replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[EMAIL]")
    .replace(/(?:\+?84|0)[\s.-]?(?:\d[\s.-]?){8,10}/g, "[SỐ ĐIỆN THOẠI]");
}
export function preflightReview(listing: AiListing): string | null {
  if (!listing.sellerVerified) return "Người đăng chưa được xác minh; cần Admin kiểm tra.";
  if (listing.status !== "Active") return "Tin không ở trạng thái đang bán.";
  if (listing.title.trim().length < 3 || listing.description.trim().length < 5) return "Nội dung quá ngắn để nhận biết sản phẩm; cần Admin kiểm tra.";
  if (!Number.isFinite(listing.price) || listing.price < 0) return "Giá sản phẩm không hợp lệ.";
  if (!listing.images.length) return "Tin chưa có ảnh sản phẩm để kiểm tra.";
  if (listing.images.length > 8) return "Tin có quá nhiều ảnh; cần kiểm tra thủ công.";
  if (listing.title.length > 300 || listing.description.length > 6000) return "Nội dung quá dài; cần kiểm tra thủ công.";
  if (/ignore.{0,25}(?:instruction|rule)|bỏ qua.{0,25}(?:hướng dẫn|quy tắc)|system\s*prompt|auto.{0,5}approve|hãy.{0,15}duyệt.{0,15}(?:tin|tôi)/i.test(listing.title + " " + listing.description))
    return "Nội dung có dấu hiệu tác động vào hệ thống kiểm duyệt.";
  return null;
}
export function parseAiVerdict(value: unknown, imageCount: number): AiVerdict {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("AI trả kết quả không hợp lệ.");
  const v = value as Record<string, unknown>;
  if (!["APPROVE", "REVIEW"].includes(String(v.decision)) || typeof v.confidence !== "number" || !Number.isFinite(v.confidence) || v.confidence < 0 || v.confidence > 1 ||
    typeof v.reason !== "string" || !v.reason.trim() || v.reason.length > 800 || !Array.isArray(v.flags) || v.flags.some(flag => typeof flag !== "string" || !AI_FLAGS.includes(flag as typeof AI_FLAGS[number])) ||
    !Number.isInteger(v.imagesChecked) || v.imagesChecked !== imageCount || imageCount < 1) throw new Error("AI chưa xác nhận đầy đủ nội dung và ảnh; cần kiểm tra thủ công.");
  return { decision: v.decision as AiVerdict["decision"], confidence: v.confidence, reason: v.reason.trim(), flags: [...new Set(v.flags as string[])], imagesChecked: imageCount };
}
export function canAutoApprove(verdict: AiVerdict, listing: AiListing) {
  return preflightReview(listing) === null && verdict.decision === "APPROVE" && verdict.confidence >= AI_APPROVAL_THRESHOLD && verdict.flags.length === 0 && verdict.imagesChecked === listing.images.length;
}
