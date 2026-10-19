import { NextResponse } from "next/server";
import { MediaStorageError } from "./media-storage-error";

export class ApiError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export const isUUID = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export function apiError(error: unknown) {
  if (error instanceof ApiError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof MediaStorageError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof SyntaxError) return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  console.error(error);
  return NextResponse.json({ error: "Không thể xử lý yêu cầu lúc này." }, { status: 500 });
}
