import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-pg";
import { apiError } from "@/lib/api-error";
import { confirmSale } from "@/lib/sales";
export async function POST(request: NextRequest,{params}:{params:Promise<{id:string}>}) {
  const {user,errorResponse}=await requireAuth(request);
  if(errorResponse) return errorResponse;
  try {
    const {id}=await params;
    const body=await request.json();
    return NextResponse.json(await confirmSale(id,user!.pgUserId,body.confirm));
  } catch(e) { return apiError(e); }
}

