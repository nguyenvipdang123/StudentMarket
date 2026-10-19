/**
 * GET, POST /api/admin/promotion-packages — Admin packages management (Admin only)
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-pg";
import { query, logAudit } from "@/lib/db";
import { apiError } from "@/lib/api-error";
import { packageFields } from "@/lib/promotion-packages";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { user, errorResponse } = await requireAuth(request);
  if (errorResponse) return errorResponse;

  if (user!.role !== "admin") {
    return NextResponse.json({ error: "Chỉ quản trị viên mới có quyền quản lý gói đẩy tin." }, { status: 403 });
  }

  const rows = await query(
    `SELECT pp.*, 
            COUNT(po.id) AS total_orders,
            COALESCE(SUM(CASE WHEN po.payment_status = 'PAID' THEN po.amount ELSE 0 END), 0) AS total_revenue
     FROM promotion_packages pp
     LEFT JOIN promotion_orders po ON po.package_id = pp.id
     WHERE pp.deleted_at IS NULL
     GROUP BY pp.id
     ORDER BY pp.priority ASC`
  );

  return NextResponse.json({
    packages: rows.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
      durationHours: r.duration_hours,
      price: Number(r.price),
      priority: r.priority,
      isActive: r.is_active,
      totalOrders: Number(r.total_orders || 0),
      totalRevenue: Number(r.total_revenue || 0),
      createdAt: r.created_at?.toISOString() || "",
    })),
  });
}

export async function POST(request: NextRequest) {
  const { user, errorResponse } = await requireAuth(request);
  if (errorResponse) return errorResponse;

  if (user!.role !== "admin") {
    return NextResponse.json({ error: "Chỉ quản trị viên mới có quyền tạo gói đẩy tin." }, { status: 403 });
  }

  let fields;
  try { fields = packageFields(await request.json()); }
  catch (error) { return apiError(error); }
  const name = fields.name!, description = fields.description!, durationHours = fields.durationHours!, price = fields.price!, priority = fields.priority!;

  const rows = await query<{ id: number }>(
    `INSERT INTO promotion_packages (name, description, duration_hours, price, priority, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, TRUE, NOW(), NOW())
     RETURNING id`,
    [name, description, durationHours, price, priority]
  );

  const pkgId = rows[0].id;

  await logAudit({
    actorId: user!.pgUserId,
    action: "CREATE_PROMOTION_PACKAGE",
    targetType: "PROMOTION_PACKAGE",
    targetId: String(pkgId),
    description: `Tạo gói đẩy tin mới: ${name} (${price.toLocaleString()}đ, ${durationHours}h, cấp ${priority})`,
  });

  return NextResponse.json({
    success: true,
    message: "Tạo gói đẩy tin thành công!",
    package: {
      id: pkgId,
      name,
      description,
      durationHours,
      price,
      priority,
      isActive: true,
    },
  }, { status: 201 });
}
