import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { sameOrigin, digest } from "@/lib/auth";
import { getAuthenticatedUser } from "@/lib/auth-pg";
import { transaction } from "@/lib/db";
import { isUUID } from "@/lib/api-error";
export async function POST(request:NextRequest) {
  if(!sameOrigin(request)) return NextResponse.json({error:"Yêu cầu không hợp lệ."},{status:403});
  const body=await request.json().catch(()=>({}));
  const id=body.listingId || body.productId;
  if(!isUUID(id) || !["VIEW","CLICK"].includes(body.eventType || "VIEW")) return NextResponse.json({error:"Sự kiện không hợp lệ."},{status:400});
  const user=await getAuthenticatedUser(request);
  const visitor=request.cookies.get("sangtay_visitor")?.value || randomUUID();
  const visitorId=digest(visitor);
  const event=body.eventType || "VIEW";
  const recorded=await transaction(async c=>{
    const {rows:[p]}=await c.query("SELECT seller_id FROM products WHERE id=$1 AND status='Active' AND moderation_status='APPROVED' FOR UPDATE",[id]);
    if(!p || p.seller_id===user?.pgUserId) return false;
    const {rows}=await c.query(`SELECT id FROM listing_analytics WHERE listing_id=$1 AND visitor_id=$2 AND event_type=$3 AND created_at>NOW()-INTERVAL '30 seconds'`,[id,visitorId,event]);
    if(rows.length) return false;
    await c.query("INSERT INTO listing_analytics(listing_id,user_id,visitor_id,event_type) VALUES($1,$2,$3,$4)",[id,user?.pgUserId || null,visitorId,event]);
    if(event==="VIEW") await c.query("UPDATE products SET view_count=view_count+1 WHERE id=$1",[id]);
    return true;
  });
  const response=NextResponse.json({success:true,recorded});
  response.cookies.set("sangtay_visitor",visitor,{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",path:"/",maxAge:60*60*24*30});
  return response;
}

