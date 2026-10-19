import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-pg";
import { ApiError, apiError } from "@/lib/api-error";
import { requireConversationParticipant } from "@/lib/chat-attachments";
import { readMedia } from "@/lib/media-storage";
import { productImageName, productImageMime } from "@/lib/product-images";
export const runtime="nodejs";
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string;name:string}>}) {
  try {
    const {user,errorResponse}=await requireAuth(request);
    if(errorResponse) return errorResponse;
    const {id,name}=await params;
    await requireConversationParticipant(id,user!.pgUserId);
    if(!productImageName.test(name)) throw new ApiError("Không tìm thấy ảnh.",404);
    const bytes=await readMedia("chat",id+"/"+name);
    return new NextResponse(new Uint8Array(bytes),{headers:{"Content-Type":productImageMime(name),"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Disposition":'inline; filename="'+name+'"'}});
  }catch(error){return apiError(error);}
}
