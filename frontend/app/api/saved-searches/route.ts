import {NextResponse,type NextRequest} from 'next/server';
import {requireAuth} from '@/lib/auth-pg';
import {apiError} from '@/lib/api-error';
import {listSavedSearches,saveSearch} from '@/lib/saved-searches';
export const runtime='nodejs';
export async function GET(request:NextRequest) {
  const {user,errorResponse}=await requireAuth(request);if(errorResponse)return errorResponse;
  if(user!.role!=='student')return NextResponse.json({error:'Theo dõi nhu cầu dành cho sinh viên.'},{status:403});
  try{return NextResponse.json({searches:await listSavedSearches(user!.pgUserId)},{headers:{'Cache-Control':'private, no-store'}});}catch(e){return apiError(e);}
}
export async function POST(request:NextRequest) {
  const {user,errorResponse}=await requireAuth(request);if(errorResponse)return errorResponse;
  if(user!.role!=='student')return NextResponse.json({error:'Theo dõi nhu cầu dành cho sinh viên.'},{status:403});
  try{const body=await request.json();if(!body || typeof body!=='object' || Array.isArray(body))return NextResponse.json({error:'Dữ liệu không hợp lệ.'},{status:400});
    return NextResponse.json(await saveSearch(user!.pgUserId,body),{status:201});}catch(e){return apiError(e);}
}
