import {NextResponse,type NextRequest} from 'next/server';
import {requireAuth} from '@/lib/auth-pg';
import {apiError} from '@/lib/api-error';
import {allowEmailRequest} from '@/lib/email-codes';
import {imageExtension,productImageMime} from '@/lib/product-image-files';
import {adviceConfig,adviceInput,ListingAdviceError,suggestListing,type AdviceImage} from '@/lib/listing-advice';
import {maxAdviceImages,maxAdviceImageBytes,maxAdviceRequestBytes} from '@/lib/listing-advice-types';
export const runtime='nodejs';
let activeRequests=0;
async function readForm(request:NextRequest){
  const contentType=request.headers.get('content-type')||'';
  if(!contentType.startsWith('multipart/form-data'))throw new ListingAdviceError('Gửi bản nháp và ảnh bằng biểu mẫu hợp lệ.',415);
  if(Number(request.headers.get('content-length')||0)>maxAdviceRequestBytes)throw new ListingAdviceError('Ảnh góp ý quá lớn. Vui lòng chọn lại ảnh để thu nhỏ trước khi gửi.',413);
  if(!request.body)throw new ListingAdviceError('Bản nháp đang trống.');
  const reader=request.body.getReader(),chunks:Uint8Array[]=[];let bytes=0;
  try{while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>maxAdviceRequestBytes)throw new ListingAdviceError('Ảnh góp ý quá lớn.',413);chunks.push(part.value);}}
  finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
  try{return await new Response(Buffer.concat(chunks),{headers:{'Content-Type':contentType}}).formData();}catch{throw new ListingAdviceError('Biểu mẫu góp ý không hợp lệ.');}
}
export async function POST(request:NextRequest){
  const {user,errorResponse}=await requireAuth(request);if(errorResponse)return errorResponse;
  if(user!.role!=='student')return NextResponse.json({error:'Góp ý tin đăng dành cho sinh viên đã xác minh.'},{status:403});
  if(!adviceConfig().key)return NextResponse.json({error:'AI góp ý chưa được cấu hình. Bạn vẫn có thể tiếp tục đăng tin.'},{status:503});
  if(activeRequests>=3)return NextResponse.json({error:'AI đang bận. Bạn thử lại sau ít giây nhé.'},{status:429,headers:{'Retry-After':'30'}});
  activeRequests++;
  try{
    if(!await allowEmailRequest('listing-advice:minute:'+user!.pgUserId,3,60000)||!await allowEmailRequest('listing-advice:hour:'+user!.pgUserId,10,3600000))return NextResponse.json({error:'Bạn đã dùng hết lượt góp ý tạm thời. Vui lòng thử lại sau.'},{status:429,headers:{'Retry-After':'60'}});
    const form=await readForm(request),body:Record<string,unknown>={};
    for(const [key,value] of form.entries())if(key!=='imageFiles'){if(typeof value!=='string')throw new ListingAdviceError('Dữ liệu bản nháp không hợp lệ.');body[key]=value;}
    const input=adviceInput(body),files=form.getAll('imageFiles');
    if(files.length>maxAdviceImages||files.some(file=>!(file instanceof File)))throw new ListingAdviceError('Chọn tối đa 8 ảnh hợp lệ.');
    const images:AdviceImage[]=[];
    for(const file of files as File[]){
      if(file.size<1||file.size>maxAdviceImageBytes)throw new ListingAdviceError('Ảnh góp ý cần được thu nhỏ dưới 1 MB mỗi ảnh.',413);
      const bytes=Buffer.from(await file.arrayBuffer()),extension=imageExtension(bytes);
      if(!extension||file.type!==productImageMime('image.'+extension))throw new ListingAdviceError('Chỉ chọn ảnh JPG, PNG hoặc WebP hợp lệ.');
      images.push({mimeType:file.type,data:bytes.toString('base64')});
    }
    if(!input.title&&!input.description&&!images.length)throw new ListingAdviceError('Thêm tiêu đề, mô tả hoặc ảnh trước khi nhờ AI góp ý.');
    const advice=await suggestListing(input,images,{signal:request.signal});
    return NextResponse.json({advice},{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){if(error instanceof ListingAdviceError)return NextResponse.json({error:error.message},{status:error.status,headers:{'Cache-Control':'no-store',...(error.status===503?{'Retry-After':'60'}:{})}});return apiError(error);}
  finally{activeRequests--;}
}
