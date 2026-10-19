/**
 * GET /api/promotions/packages — List active promotion packages
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const rows = await query(
    `SELECT id, name, description, duration_hours, price, priority, is_active
     FROM promotion_packages
     WHERE is_active = TRUE AND deleted_at IS NULL
     ORDER BY priority ASC`
  );

  return NextResponse.json({
    packages: rows.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
      durationHours: r.duration_hours,
      durationDays: Math.round(r.duration_hours / 24),
      price: Number(r.price),
      priority: r.priority,
    })),
  });
}
