import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { transaction } from "@/lib/db";
import { requireAuth } from "@/lib/auth-pg";
import { apiError } from "@/lib/api-error";
import { listingInput } from "@/lib/listing-input";
import { readListingRequest, removeProductImage, saveProductImage } from "@/lib/product-images";
import { parseListingQuery, ListingQueryError } from "@/lib/listing-query";
import { searchPublicProducts } from "@/lib/public-product-search";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  try {
    const filters = parseListingQuery(request.nextUrl.searchParams);
    const result = await searchPublicProducts(filters);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ListingQueryError) return NextResponse.json({ error: error.message }, { status: 400 });
    return apiError(error);
  }
}
export async function POST(request: NextRequest) {
  const { user, errorResponse } = await requireAuth(request);
  if (errorResponse) return errorResponse;
  const storedImages: string[] = [];
  try {
    const { body, files } = await readListingRequest(request);
    const v = listingInput(body);
    for (const file of files) storedImages.push(await saveProductImage(file));
    if (storedImages.length) v.image = storedImages[0];
    const id = await transaction(async client => {
      const { rows } = await client.query(`INSERT INTO products
        (id,user_id,seller_id,category_id,title,description,price,condition,type,status,location,university,view_count,created_at,updated_at,moderation_status)
        VALUES(gen_random_uuid(),$1,$1,$2,$3,$4,$5,$6,$7,'Active',$8,$9,0,NOW(),NOW(),'PENDING') RETURNING id`,
        [user!.pgUserId,v.categoryId,v.title,v.description,v.price,v.condition,v.type,v.location,user!.university]);
      const images = storedImages.length ? storedImages : v.image ? [v.image] : [];
      for (const [index,image] of images.entries()) await client.query(`INSERT INTO product_images(id,product_id,image_url,is_primary,sort_order,created_at) VALUES(gen_random_uuid(),$1,$2,$3,$4,NOW())`,[rows[0].id,image,index===0,index+1]);
      return rows[0].id;
    });
    return NextResponse.json({ success: true, product: { id, ...v, images: storedImages.length ? storedImages : v.image ? [v.image] : [], status: "Active", moderationStatus: "PENDING" } }, { status: 201 });
  } catch (e) {
    await Promise.all(storedImages.map(removeProductImage));
    return apiError(e);
  }
}

