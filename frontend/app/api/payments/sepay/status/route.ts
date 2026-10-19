import { NextResponse } from "next/server";
import { missingSePaySettings } from "@/lib/sepay-policy";
export const runtime = "nodejs";
export async function GET() {
  return NextResponse.json({ configured: missingSePaySettings().length === 0 }, { headers: { "Cache-Control": "no-store" } });
}
