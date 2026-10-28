import { ownedListingsApi } from "../src/api/owned-listings";
import { request } from "../src/api/client";
import { appendPhotos } from "../src/api/photos";
import { ownedDraft } from "../src/state/owned-listings";
import type { Product } from "../src/api/types";
jest.mock("../src/api/client", () => ({ request: jest.fn(async () => ({ success: true, message: "Đã lưu" })) }));
jest.mock("../src/api/photos", () => ({ appendPhotos: jest.fn(async () => {}) }));
const item: Product = { id: "11111111-1111-4111-8111-111111111111", title: "Bàn học gỗ", description: "Bàn còn dùng tốt", price: 50000, category: "Nội thất", status: "Active", condition: "Tốt", school: "DNTU", location: "Thư viện", seller: "Người bán", sellerId: "seller", image: "/api/product-images/11111111-1111-4111-8111-111111111111.jpg" };

test("owner status/delete use authenticated API identity and explicit confirmation, not a client supplied seller", async () => {
  await ownedListingsApi.visibility(item.id, "Hidden", "Active");
  expect(request).toHaveBeenLastCalledWith("/api/my-listings/" + item.id, expect.objectContaining({ method: "PATCH", body: JSON.stringify({ status: "Hidden", expectedStatus: "Active" }) }));
  await ownedListingsApi.remove(item.id, "Hidden");
  expect(request).toHaveBeenLastCalledWith("/api/my-listings/" + item.id, expect.objectContaining({ method: "DELETE", body: JSON.stringify({ confirmed: true, expectedStatus: "Hidden" }) }));
});

test("editing preserves the existing cover, and replacing it uses the single imageFile contract", async () => {
  const draft = ownedDraft(item);
  await ownedListingsApi.edit(item.id, draft, item, null);
  const options = jest.mocked(request).mock.calls.at(-1)?.[1];
  expect(JSON.parse(String(options?.body))).toEqual(expect.objectContaining({ image: item.image, expectedStatus: "Active", price: 50000 }));
  const cover = { uri: "file:///compressed.jpg", fileName: "compressed.jpg", mimeType: "image/jpeg" as const, fileSize: 27000, width: 1000, height: 1000 };
  await ownedListingsApi.edit(item.id, draft, item, cover);
  expect(appendPhotos).toHaveBeenCalledWith(expect.any(FormData), [cover], "imageFile");
  expect(request).toHaveBeenLastCalledWith("/api/listings/" + item.id, expect.objectContaining({ method: "PATCH", body: expect.any(FormData) }), 60000);
});

test("invalid edit never sends a request and an outside sale never sends an unrelated buyer identity", async () => {
  await expect(ownedListingsApi.edit(item.id, { ...ownedDraft(item), price: "-1" }, item, null)).rejects.toThrow();
  expect(request).not.toHaveBeenCalled();
  await ownedListingsApi.sold(item.id, false, "private@example.invalid");
  expect(request).toHaveBeenCalledWith("/api/listings/" + item.id + "/mark-sold", expect.objectContaining({ body: JSON.stringify({ viaSangTay: false, buyerId: "" }) }));
});
