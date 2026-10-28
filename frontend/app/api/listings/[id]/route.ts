export { GET } from "../../products/[id]/route";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-pg";
import { transaction } from "@/lib/db";
import { ApiError, apiError, isUUID } from "@/lib/api-error";
import { listingInput } from "@/lib/listing-input";
import { readListingRequest, removeProductImage, removeUnusedProductImage, saveProductImage } from "@/lib/product-images";
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, errorResponse } = await requireAuth(request);
  if (errorResponse) return errorResponse;
  let storedImage = "";
  try {
    const { id } = await params;
    if (!isUUID(id)) throw new ApiError("Không tìm thấy tin.",404);
    const { body, file } = await readListingRequest(request);
    const v = listingInput(body);
    if (!["Active", "Hidden"].includes(String(body.status))) throw new ApiError("Đánh dấu đã bán qua chức năng giao dịch.");
    if (file) {
      storedImage = await saveProductImage(file);
      v.image = storedImage;
    }
    const previousImage = await transaction(async c => {
      const { rows } = await c.query("SELECT * FROM products WHERE id=$1 FOR UPDATE",[id]);
      const p = rows[0];
      if (!p) throw new ApiError("Không tìm thấy tin.",404);
      if (p.seller_id !== user!.pgUserId) throw new ApiError("Bạn không phải chủ tin.",403);
      if (p.status === "Deleted") throw new ApiError("Tin đã được xóa.",404);
      if (body.expectedStatus !== undefined && body.expectedStatus !== p.status) throw new ApiError("Tin đã thay đổi. Tải lại trước khi sửa.",409);
      if (p.status === "Sold") throw new ApiError("Không thể sửa tin đã bán.",409);
      const active = await c.query("SELECT id FROM listing_promotions WHERE listing_id=$1 AND status='ACTIVE' AND end_at>NOW()",[id]);
      if (active.rows.length) throw new ApiError("Vui lòng chờ gói quảng cáo kết thúc trước khi sửa nội dung.",409);
      const previous = await c.query("SELECT image_url FROM product_images WHERE product_id=$1 AND is_primary=TRUE LIMIT 1",[id]);
      await c.query(`UPDATE products SET title=$2,description=$3,price=$4,category_id=$5,condition=$6,location=$7,type=$8,status=$9,
        moderation_status='PENDING', moderated_by=NULL,moderated_at=NULL,rejection_reason=NULL,updated_at=NOW() WHERE id=$1`,
        [id,v.title,v.description,v.price,v.categoryId,v.condition,v.location,v.type,body.status]);
      await c.query("DELETE FROM product_images WHERE product_id=$1 AND is_primary=TRUE",[id]);
      if (v.image) await c.query(`INSERT INTO product_images(id,product_id,image_url,is_primary,sort_order,created_at) VALUES(gen_random_uuid(),$1,$2,TRUE,1,NOW())`,[id,v.image]);
      return String(previous.rows[0]?.image_url || "");
    });
    if (previousImage && previousImage !== v.image) await removeUnusedProductImage(previousImage).catch(() => undefined);
    return NextResponse.json({ success:true, moderationStatus:"PENDING", message:"Đã lưu. Tin sẽ được duyệt lại." });
  } catch(e) {
    if (storedImage) await removeProductImage(storedImage);
    return apiError(e);
  }
}

