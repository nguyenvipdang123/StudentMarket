import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-pg';
import { apiError } from '@/lib/api-error';
import { promotionPerformance } from '@/lib/promotion-analytics';
export const runtime='nodejs';
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}) {
  const {user,errorResponse}=await requireAuth(request);if(errorResponse)return errorResponse;
  try {
    const result=await promotionPerformance((await params).id,user!);
    return NextResponse.json({...result,analytics:result.during.metrics},{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){return apiError(error);}
}
