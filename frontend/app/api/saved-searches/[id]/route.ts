import {NextResponse,type NextRequest} from 'next/server';
import {requireAuth} from '@/lib/auth-pg';
import {apiError} from '@/lib/api-error';
import {changeSavedSearch,deleteSavedSearch} from '@/lib/saved-searches';
export const runtime='nodejs';
export async function PATCH(request:NextRequest,{params}:{params:Promise<{id:string}>}) {
  const {user,errorResponse}=await requireAuth(request);if(errorResponse)return errorResponse;
  if(user!.role!=='student')return NextResponse.json({error:'Chỉ sinh viên được quản lý nhu cầu.'},{status:403});
  try{const body=await request.json();if(typeof body?.enabled!=='boolean')return NextResponse.json({error:'Trạng thái theo dõi không hợp lệ.'},{status:400});
    return NextResponse.json(await changeSavedSearch((await params).id,user!.pgUserId,body.enabled));}catch(e){return apiError(e);}
}
export async function DELETE(request:NextRequest,{params}:{params:Promise<{id:string}>}) {
  const {user,errorResponse}=await requireAuth(request);if(errorResponse)return errorResponse;
  if(user!.role!=='student')return NextResponse.json({error:'Chỉ sinh viên được quản lý nhu cầu.'},{status:403});
  try{return NextResponse.json(await deleteSavedSearch((await params).id,user!.pgUserId));}catch(e){return apiError(e);}
}
