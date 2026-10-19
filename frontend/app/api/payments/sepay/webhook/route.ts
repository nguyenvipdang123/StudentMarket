import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ApiError } from "@/lib/api-error";
import { missingSePaySettings, parseSePayEvent, sepayConfig, validSePaySignature } from "@/lib/sepay-policy";
import { processSePayEvent } from "@/lib/sepay-payments";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  const config = sepayConfig();
  if (missingSePaySettings(config).length) return NextResponse.json({ success: false, error: "SePay chưa được cấu hình." }, { status: 503 });
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return NextResponse.json({ success: false }, { status: 415 });
  if (Number(request.headers.get("content-length") || 0) > 16384) return NextResponse.json({ success: false }, { status: 413 });
  const reader = request.body?.getReader();
  if (!reader) return NextResponse.json({ success: false }, { status: 400 });
  let total = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > 16384) { await reader.cancel(); return NextResponse.json({ success: false }, { status: 413 }); }
      chunks.push(value);
    }
  } catch { return NextResponse.json({ success: false }, { status: 400 }); }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!validSePaySignature(raw, request.headers, config)) return NextResponse.json({ success: false }, { status: 401 });
  let event;
  try { event = parseSePayEvent(JSON.parse(raw)); }
  catch { return NextResponse.json({ success: false, error: "Dữ liệu giao dịch không hợp lệ." }, { status: 400 }); }
  try {
    await processSePayEvent(event);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("SePay webhook was not committed; provider should retry.");
    return NextResponse.json({ success: false }, { status: e instanceof ApiError ? e.status : 500 });
  }
}
