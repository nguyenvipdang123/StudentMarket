import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json({ version: 1, turnstileEnabled: !!(process.env.TURNSTILE_SECRET_KEY?.trim() || process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim()),
    googleEnabled: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) }, { headers: { "Cache-Control": "no-store" } });
}
