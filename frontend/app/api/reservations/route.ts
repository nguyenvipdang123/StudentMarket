import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth-pg';
import { apiError } from '@/lib/api-error';
import { createReservation, heldUntil, listReservations } from '@/lib/reservations';
export const runtime='nodejs';
export async function GET(request: NextRequest) {
  const {user,errorResponse}=await requireAuth(request); if(errorResponse) return errorResponse;
  if(user!.role!=='student') return NextResponse.json({error:'Lịch giao dịch dành cho tài khoản sinh viên.'},{status:403});
  try {
    const listingId=request.nextUrl.searchParams.get('listingId') || undefined;
    const reservations=await listReservations(user!.pgUserId,listingId);
    return NextResponse.json({reservations,heldUntil:listingId?await heldUntil(listingId):null},{headers:{'Cache-Control':'private, no-store'}});
  } catch(e) {return apiError(e);}
}
export async function POST(request: NextRequest) {
  const {user,errorResponse}=await requireAuth(request); if(errorResponse) return errorResponse;
  if(user!.role!=='student') return NextResponse.json({error:'Chỉ sinh viên đã xác minh được yêu cầu giữ chỗ.'},{status:403});
  let body; try {body=await request.json();} catch {return NextResponse.json({error:'Dữ liệu lịch hẹn không hợp lệ.'},{status:400});}
  if(!body || typeof body!=='object' || Array.isArray(body)) return NextResponse.json({error:'Dữ liệu lịch hẹn không hợp lệ.'},{status:400});
  try {return NextResponse.json(await createReservation(user!.pgUserId,body),{status:201});} catch(e) {return apiError(e);}
}
