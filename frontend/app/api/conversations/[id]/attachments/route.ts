import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireAuth } from "@/lib/auth-pg";
import { ApiError, apiError } from "@/lib/api-error";
import { requireConversationParticipant } from "@/lib/chat-attachments";
import { saveMedia } from "@/lib/media-storage";
import { imageExtension, productImageMime } from "@/lib/product-images";
export const runtime="nodejs";
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}) {
  try {
    const {user,errorResponse}=await requireAuth(request);
    if(errorResponse) return errorResponse;
    const {id}=await params;
    await requireConversationParticipant(id,user!.pgUserId);
    if(Number(request.headers.get("content-length")||0)>5*1024*1024+10000) throw new ApiError("Ảnh phải nhỏ hơn 5 MB.",413);
    const form=await request.formData();
    const file=form.get("image");
    if(!(file instanceof File)||!file.size||file.size>5*1024*1024) throw new ApiError("Chọn ảnh nhỏ hơn 5 MB.",413);
    const bytes=Buffer.from(await file.arrayBuffer());
    const ext=imageExtension(bytes);
    if(!ext||(file.type&&file.type!==productImageMime("image."+ext))) throw new ApiError("Chỉ chấp nhận ảnh JPG, PNG hoặc WebP hợp lệ.");
    const name=randomUUID()+"."+ext;
    await saveMedia("chat",id+"/"+name,bytes);
    return NextResponse.json({url:"/api/conversations/"+id+"/attachments/"+name});
  } catch(error) {return apiError(error);}
}
