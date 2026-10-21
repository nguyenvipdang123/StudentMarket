import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-pg";
import { ApiError, apiError } from "@/lib/api-error";
import { confirmSale } from "@/lib/sales";
export async function POST(request: NextRequest,{params}:{params:Promise<{id:string}>}) {
  const {user,errorResponse}=await requireAuth(request);
  if(errorResponse) return errorResponse;
  if(user!.role!=='student') return NextResponse.json({error:'Chỉ sinh viên được xác nhận giao dịch.'},{status:403});
  try {
    const {id}=await params;
    let body;try {body=await request.json();}catch {throw new ApiError('Dữ liệu xác nhận không hợp lệ.');}
    if (!body || typeof body!=='object' || typeof body.confirm!=='boolean') throw new ApiError('Dữ liệu xác nhận không hợp lệ.');
    return NextResponse.json(await confirmSale(id,user!.pgUserId,body.confirm));
  } catch(e) { return apiError(e); }
}

