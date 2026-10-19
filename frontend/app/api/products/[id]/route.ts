import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth-pg";
import { isUUID } from "@/lib/api-error";
import { productSelect, mapProduct } from "@/lib/products";
export const runtime = "nodejs";
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUUID(id)) return NextResponse.json({ error: "Không tìm thấy tin." }, { status: 404 });
  const user = await getAuthenticatedUser(request);
  const rows = await query(productSelect + ` WHERE p.id = $1 AND
    ((p.status IN ('Active','Sold') AND p.moderation_status = 'APPROVED') OR p.seller_id = $2 OR $3)`,
    [id, user?.pgUserId || null, user?.role === "admin" || user?.role === "staff"]);
  if (!rows.length) return NextResponse.json({ error: "Không tìm thấy tin." }, { status: 404 });
  return NextResponse.json({ product: mapProduct(rows[0]) });
}

