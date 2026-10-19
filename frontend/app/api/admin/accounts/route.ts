import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getDb, requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";

type StudentRow = {
  id: number; full_name: string; email: string; student_id: string; university: string;
  status: string; card_path: string | null; created_at: number; verified_at: number | null;
};

export async function GET(request: NextRequest) {
  const { response } = await requireAdmin(request);
  if (response) return response;
  const db = getDb();
  const rows = await db.prepare(`SELECT id, full_name, email, student_id, university, status,
    card_path, created_at, verified_at FROM auth_identities WHERE role = 'student'
    ORDER BY CASE status WHEN 'pending_review' THEN 0 WHEN 'pending_email' THEN 1 ELSE 2 END,
    created_at DESC LIMIT 500`).all() as StudentRow[];
  const accounts = rows.map(row => ({
    id: row.id, fullName: row.full_name, email: row.email, studentId: row.student_id,
    university: row.university, status: row.status, hasCard: Boolean(row.card_path),
    createdAt: row.created_at, verifiedAt: row.verified_at,
  }));
  const counts = await db.prepare(`SELECT COUNT(*)::int AS total,
    COUNT(*) FILTER (WHERE status = 'pending_review')::int AS "pendingReview",
    COUNT(*) FILTER (WHERE status = 'pending_email')::int AS "pendingEmail",
    COUNT(*) FILTER (WHERE status = 'verified')::int AS verified,
    COUNT(*) FILTER (WHERE status = 'locked')::int AS locked FROM auth_identities WHERE role = 'student'`).get();
  return NextResponse.json({ accounts, counts }, { headers: { "Cache-Control": "no-store" } });
}
