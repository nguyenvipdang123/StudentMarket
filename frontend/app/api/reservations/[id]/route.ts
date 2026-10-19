import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth-pg';
import { apiError, isUUID } from '@/lib/api-error';
import { updateReservation } from '@/lib/reservations';
import { query } from '@/lib/db';
import { markSold } from '@/lib/sales';
export const runtime='nodejs';
export async function PATCH(request: NextRequest,{params}:{params:Promise<{id:string}>}) {
  const {user,errorResponse}=await requireAuth(request); if(errorResponse) return errorResponse;
  if(user!.role!=='student') return NextResponse.json({error:'Lịch giao dịch dành cho sinh viên.'},{status:403});
  let body; try {body=await request.json();} catch {return NextResponse.json({error:'Dữ liệu không hợp lệ.'},{status:400});}
  const {id}=await params;
  if(!isUUID(id)) return NextResponse.json({error:'Không tìm thấy lịch hẹn.'},{status:404});
  try {
    if(body?.action==='complete') {
      const [r]=await query('SELECT listing_id,buyer_id FROM listing_reservations WHERE id=$1 AND seller_id=$2',[id,user!.pgUserId]);
      if(!r) return NextResponse.json({error:'Không tìm thấy lịch hẹn của bạn.'},{status:404});
      return NextResponse.json(await markSold(r.listing_id,user!.pgUserId,true,r.buyer_id,id));
    }
    return NextResponse.json(await updateReservation(id,user!.pgUserId,body?.action));
  } catch(e) {return apiError(e);}
}
