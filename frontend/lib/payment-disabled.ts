import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuth } from "./auth-pg";
import { missingSePaySettings } from "./sepay-policy";
// Browser endpoints never confirm money receipt. Only an authenticated SePay webhook can do so.
export async function paymentUnavailable(request: NextRequest) {
  const {errorResponse}=await requireAuth(request);
  if(errorResponse) return errorResponse;
  return NextResponse.json({error:"Trang này chỉ kiểm tra trạng thái thanh toán. Việc xác nhận được thực hiện qua webhook SePay."},{status:missingSePaySettings().length ? 503 : 405});
}

