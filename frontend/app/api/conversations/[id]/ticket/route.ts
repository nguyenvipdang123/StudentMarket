import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { SignJWT } from "jose";
import { requireAuth } from "@/lib/auth-pg";
import { digest, sessionCookie } from "@/lib/auth";
import { query } from "@/lib/db";
import { isUUID } from "@/lib/api-error";
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}) {
  const {user,errorResponse}=await requireAuth(request);
  if(errorResponse) return errorResponse;
  const {id}=await params;
  if(!isUUID(id)) return NextResponse.json({error:"Cuộc trò chuyện không hợp lệ."},{status:400});
  const secret=process.env.CHAT_TICKET_SECRET;
  if(!secret || secret.length<32) return NextResponse.json({error:"Chat realtime chưa được cấu hình."},{status:503});
  const rows=await query("SELECT id FROM conversations WHERE id=$1 AND (buyer_id=$2 OR seller_id=$2)",[id,user!.pgUserId]);
  if(!rows.length) return NextResponse.json({error:"Không có quyền truy cập."},{status:403});
  const ticket=await new SignJWT({conversation:id,sid:digest(request.cookies.get(sessionCookie)!.value)})
    .setProtectedHeader({alg:"HS256"}).setSubject(user!.pgUserId).setIssuer("student-market")
    .setAudience("chat").setIssuedAt().setExpirationTime("60s").sign(new TextEncoder().encode(secret));
  return NextResponse.json({ticket},{headers:{"Cache-Control":"no-store"}});
}

