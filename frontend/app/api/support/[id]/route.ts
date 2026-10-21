import {supportRead,supportReply} from '@/lib/support-api';
import type {NextRequest} from 'next/server';
export const runtime='nodejs';
type Context={params:Promise<{id:string}>};
export const GET=async(request:NextRequest,context:Context)=>supportRead(request,(await context.params).id);
export const POST=async(request:NextRequest,context:Context)=>supportReply(request,(await context.params).id);
