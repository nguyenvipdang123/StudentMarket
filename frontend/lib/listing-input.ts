import { ApiError } from "./api-error";
const categories: Record<string, number> = { "Học tập": 1, "Công nghệ": 2, "Nội thất": 3, "Thời trang": 4, "Khác": 5 };
export function listingInput(body: Record<string, unknown>) {
  const title = String(body.title || "").trim();
  const description = String(body.description || "").trim();
  const price = Number(body.price);
  const category = String(body.category || "");
  const condition = String(body.condition || "");
  const location = String(body.location || "").trim();
  const image = String(body.image || "").trim();
  if (title.length < 3 || title.length > 200 || description.length < 10 || description.length > 10000) throw new ApiError("Tiêu đề cần 3–200 ký tự, mô tả cần 10–10000 ký tự.");
  if (!Number.isFinite(price) || price < 0 || price > 9999999999) throw new ApiError("Giá không hợp lệ.");
  if (!categories[category] || !["Mới 100%", "Như mới", "Tốt", "Đã qua sử dụng"].includes(condition)) throw new ApiError("Danh mục hoặc tình trạng không hợp lệ.");
  if (location.length < 2 || location.length > 200) throw new ApiError("Địa điểm cần 2–200 ký tự.");
  if (image && (!/^https?:\/\//i.test(image) && !/^\/api\/product-images\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpg|png|webp)$/i.test(image) || image.length > 2048))
    throw new ApiError("Ảnh sản phẩm không hợp lệ.");
  return { title, description, price, category, categoryId: categories[category], condition, location, image, type: price === 0 ? "Exchange" : "Sell" };
}

