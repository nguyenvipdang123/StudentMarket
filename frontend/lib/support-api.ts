import {NextResponse,type NextRequest} from 'next/server';
import {requireAuth,type AuthenticatedUser} from './auth-pg';
import {query,transaction} from './db';
import {ApiError,apiError,isUUID} from './api-error';
import {supportCategories,supportStatuses} from './support-types';

const headers={'Cache-Control':'private, no-store'};
const columns=`t.id,t.subject,t.category,t.status,t.version,t.created_at AS "createdAt",t.updated_at AS "updatedAt",u.full_name AS "ownerName"`;
async function identity(request:NextRequest,admin:boolean){
  const auth=await requireAuth(request);if(auth.errorResponse)return {response:auth.errorResponse,user:null};
  if(auth.user!.role!==(admin?'admin':'student'))return {response:NextResponse.json({error:'Bạn không có quyền truy cập mục hỗ trợ này.'},{status:403}),user:null};
  return {response:null,user:auth.user!};
}
async function bodyOf(request:NextRequest){
  if(!request.headers.get('content-type')?.startsWith('application/json'))throw new ApiError('Vui lòng gửi dữ liệu JSON.',415);
  if(!request.body)throw new ApiError('Yêu cầu trống.');
  const reader=request.body.getReader(),chunks:Uint8Array[]=[];let size=0;
  try{while(true){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.length;if(size>24000)throw new ApiError('Nội dung hỗ trợ quá dài.',413);chunks.push(chunk.value);}}
  finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
  const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!data||typeof data!=='object'||Array.isArray(data))throw new ApiError('Dữ liệu hỗ trợ không hợp lệ.');return data as Record<string,unknown>;
}
function text(value:unknown,min:number,max:number){if(typeof value!=='string'||value.trim().length<min||value.length>max)throw new ApiError(`Vui lòng nhập nội dung từ ${min} đến ${max} ký tự.`);return value.trim();}
function filters(request:NextRequest){const p=request.nextUrl.searchParams,status=p.get('status')||'ALL',q=(p.get('q')||'').trim(),page=p.get('page')||'1';if(!(status==='ALL'||Object.hasOwn(supportStatuses,status))||q.length>100||!/^[1-9]\d{0,3}$/.test(page))throw new ApiError('Bộ lọc hỗ trợ không hợp lệ.');return {status,q,page:Number(page)};}
export async function supportList(request:NextRequest,admin=false){
  try{const {user,response}=await identity(request,admin);if(response)return response;
    const {status,q,page}=filters(request),scope=admin?'$1::uuid IS NOT NULL':'t.owner_id=$1::uuid';
    const where=`FROM support_tickets t JOIN users u ON u.id=t.owner_id WHERE ${scope} AND ($2='ALL' OR t.status=$2) AND ($3='' OR t.subject ILIKE '%'||$3||'%' OR t.id::text ILIKE '%'||replace($3,'HT-','')||'%' ${admin?"OR u.email ILIKE '%'||$3||'%' OR u.full_name ILIKE '%'||$3||'%'":''})`;
    const params=[user!.pgUserId,status,q];
    const [count,items,counts]=await Promise.all([
      query(`SELECT COUNT(*)::int total ${where}`,params),
      query(`SELECT ${columns}${admin?',u.email AS "ownerEmail"':''} ${where} ORDER BY t.updated_at DESC,t.id DESC LIMIT 20 OFFSET $4`,[...params,(page-1)*20]),
      query(`SELECT t.status,COUNT(*)::int count FROM support_tickets t WHERE ${scope} GROUP BY t.status`,[user!.pgUserId]),
    ]);
    return NextResponse.json({tickets:items,total:count[0].total,page,pageSize:20,counts:Object.fromEntries(counts.map(row=>[row.status,row.count]))},{headers});
  }catch(e){return apiError(e);}
}
export async function supportCreate(request:NextRequest){
  try{const {user,response}=await identity(request,false);if(response)return response;const body=await bodyOf(request);
    const subject=text(body.subject,5,160),content=text(body.content,20,4000),category=body.category;
    if(typeof category!=='string'||!Object.hasOwn(supportCategories,category))throw new ApiError('Chọn nhóm vấn đề cần hỗ trợ.');
    const id=await transaction(async client=>{
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['support:'+user!.accountId]);
      const {rows:[counts]}=await client.query(`SELECT COUNT(*) FILTER(WHERE created_at>NOW()-INTERVAL '1 hour')::int hourly,COUNT(*) FILTER(WHERE status<>'RESOLVED')::int active FROM support_tickets WHERE owner_id=$1`,[user!.pgUserId]);
      if(counts.hourly>=5||counts.active>=10)throw new ApiError('Bạn đã đạt giới hạn tạo phiếu. Hãy bổ sung vào phiếu đang có hoặc thử lại sau một giờ.',429);
      const {rows:[ticket]}=await client.query('INSERT INTO support_tickets(owner_id,subject,category) VALUES($1,$2,$3) RETURNING id',[user!.pgUserId,subject,category]);
      await client.query('INSERT INTO support_messages(ticket_id,author_account_id,author_role,author_name,content,new_status) VALUES($1,$2,$3,$4,$5,$6)',[ticket.id,user!.accountId,'student',user!.fullName,content,'OPEN']);return ticket.id;
    });return NextResponse.json({id},{status:201,headers});
  }catch(e){return apiError(e);}
}
async function visibleTicket(id:string,user:AuthenticatedUser,admin:boolean){
  if(!isUUID(id))throw new ApiError('Không tìm thấy phiếu hỗ trợ.',404);
  const rows=await query(`SELECT ${columns}${admin?',u.email AS "ownerEmail"':''} FROM support_tickets t JOIN users u ON u.id=t.owner_id WHERE t.id=$1 AND ($2::boolean OR t.owner_id=$3)`,[id,admin,user.pgUserId]);
  if(!rows[0])throw new ApiError('Không tìm thấy phiếu hỗ trợ.',404);return rows[0];
}
export async function supportRead(request:NextRequest,id:string,admin=false){
  try{const {user,response}=await identity(request,admin);if(response)return response;const ticket=await visibleTicket(id,user!,admin);
    const before=request.nextUrl.searchParams.get('before')||'9223372036854775807';if(!/^\d{1,19}$/.test(before)||BigInt(before)>BigInt('9223372036854775807'))throw new ApiError('Mốc phản hồi không hợp lệ.');
    const rows=await query(`SELECT id,author_role AS "authorRole",author_name AS "authorName",content,new_status AS "newStatus",created_at AS "createdAt" FROM support_messages WHERE ticket_id=$1 AND id<$2 ORDER BY id DESC LIMIT 41`,[id,before]);
    return NextResponse.json({ticket,messages:rows.slice(0,40).reverse(),hasMore:rows.length>40},{headers});
  }catch(e){return apiError(e);}
}
export async function supportReply(request:NextRequest,id:string,admin=false){
  try{const {user,response}=await identity(request,admin);if(response)return response;await visibleTicket(id,user!,admin);const body=await bodyOf(request);
    const content=text(body.content??'',admin?0:1,4000),status=body.status;
    if(!admin&&status!==undefined)throw new ApiError('Chỉ Admin được thay đổi trạng thái.',403);
    if(admin&&(typeof status!=='string'||!Object.hasOwn(supportStatuses,status)||!Number.isSafeInteger(body.version)))throw new ApiError('Trạng thái hoặc phiên bản phiếu không hợp lệ.');
    await transaction(async client=>{
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['support:'+user!.accountId]);
      const {rows:[ticket]}=await client.query('SELECT * FROM support_tickets WHERE id=$1 FOR UPDATE',[id]);
      if(!ticket||(!admin&&ticket.owner_id!==user!.pgUserId))throw new ApiError('Không tìm thấy phiếu hỗ trợ.',404);
      if(admin&&ticket.version!==body.version)throw new ApiError('Phiếu vừa được cập nhật. Bấm làm mới cuộc trao đổi rồi thử lại.',409);
      const nextStatus=admin?status:ticket.status==='RESOLVED'||ticket.status==='WAITING_USER'?'OPEN':ticket.status;
      if(!content&&nextStatus===ticket.status)throw new ApiError('Nhập phản hồi hoặc đổi trạng thái trước khi lưu.');
      const {rows:[rate]}=await client.query("SELECT COUNT(*)::int total FROM support_messages WHERE author_account_id=$1 AND created_at>NOW()-INTERVAL '1 hour'",[user!.accountId]);
      if(rate.total>=30)throw new ApiError('Bạn gửi phản hồi quá nhanh. Vui lòng thử lại sau.',429);
      await client.query('UPDATE support_tickets SET status=$2,version=version+1,updated_at=NOW() WHERE id=$1',[id,nextStatus]);
      await client.query('INSERT INTO support_messages(ticket_id,author_account_id,author_role,author_name,content,new_status) VALUES($1,$2,$3,$4,$5,$6)',[id,user!.accountId,user!.role,user!.fullName,content,nextStatus!==ticket.status?nextStatus:null]);
      if(admin)await client.query("INSERT INTO audit_logs(id,actor_id,action,target_type,target_id,description,created_at) VALUES(gen_random_uuid(),$1,'UPDATE_SUPPORT_TICKET','SUPPORT_TICKET',$2,$3,NOW())",[user!.pgUserId,id,`Cập nhật phiếu hỗ trợ: ${ticket.status} → ${nextStatus}${content?' · có phản hồi':''}`]);
    });return NextResponse.json({ok:true},{headers});
  }catch(e){return apiError(e);}
}
