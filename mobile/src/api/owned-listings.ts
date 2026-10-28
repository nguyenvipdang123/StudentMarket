import { request } from "./client";
import type { Product } from "./types";
import type { CompressedPhoto } from "./photos-policy";
import { appendPhotos } from "./photos";
import { editListingPayload, soldPayload, type OwnedDraft } from "../state/owned-listings";
type Result = { success: boolean; status?: string; moderationStatus?: Product["moderationStatus"]; message: string };
export const ownedListingsApi = {
  list: () => request<{ listings: Product[] }>("/api/my-listings"),
  get: async (id: string) => (await request<{ product: Product }>("/api/products/" + encodeURIComponent(id))).product,
  async edit(id: string, draft: OwnedDraft, item: Product, cover: CompressedPhoto | null) {
    const payload = editListingPayload(draft, item.images?.[0] || item.image, item.status);
    if (!cover) return request<Result>("/api/listings/" + encodeURIComponent(id), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const form = new FormData();
    for (const [key, value] of Object.entries(payload)) form.append(key, String(value));
    // Existing edit API replaces a single cover; gallery photos remain on server.
    await appendPhotos(form, [cover], "imageFile");
    return request<Result>("/api/listings/" + encodeURIComponent(id), { method: "PATCH", body: form }, 60000);
  },
  visibility: (id: string, status: "Active" | "Hidden", expectedStatus: Product["status"]) => request<Result>("/api/my-listings/" + encodeURIComponent(id), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, expectedStatus }) }),
  remove: (id: string, expectedStatus: Product["status"]) => request<Result>("/api/my-listings/" + encodeURIComponent(id), { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmed: true, expectedStatus }) }),
  sold: (id: string, viaSangTay: boolean, buyer: string) => request<Result>("/api/listings/" + encodeURIComponent(id) + "/mark-sold", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(soldPayload(viaSangTay, buyer)) }),
};
