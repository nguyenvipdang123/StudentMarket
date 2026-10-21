import {supportCreate,supportList} from '@/lib/support-api';
import type {NextRequest} from 'next/server';
export const runtime='nodejs';
export const GET=(request:NextRequest)=>supportList(request);
export const POST=(request:NextRequest)=>supportCreate(request);
