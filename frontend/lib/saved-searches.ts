import { createHash } from 'node:crypto';
import { query,transaction } from './db';
import { ApiError,isUUID } from './api-error';
import { parseListingQuery,ListingQueryError } from './listing-query';
import { normalizeSearch } from './listing-search';
import { findUniversity,normalizeUniversity } from './universities';
import { emptyNeedFilters,type NeedFilters,type SavedSearch } from './saved-search-types';

export function parseNeed(input:unknown) {
  if(!input || typeof input!=='object' || Array.isArray(input)) throw new ApiError('Bộ lọc nhu cầu không hợp lệ.');
  const record=input as Record<string,unknown>, params=new URLSearchParams();
  for(const [key,value] of Object.entries(emptyNeedFilters)) {
    if(record[key]!==undefined && typeof record[key]!=='string') throw new ApiError('Bộ lọc nhu cầu không hợp lệ.');
    params.set(key,record[key] as string ?? value);
  }
  let parsed;try{parsed=parseListingQuery(params);}catch(e){if(e instanceof ListingQueryError) throw new ApiError(e.message);throw e;}
  const university=findUniversity(parsed.school);
  const filters:NeedFilters={q:parsed.search,category:parsed.category,kind:parsed.kind,condition:parsed.condition,school:university?.name||parsed.school,
    minPrice:parsed.minPrice===null?'':String(parsed.minPrice),maxPrice:parsed.maxPrice===null?'':String(parsed.maxPrice)};
  if(!filters.q && filters.category==='Tất cả' && filters.kind==='all' && !filters.condition && !filters.school && !filters.minPrice && !filters.maxPrice)
    throw new ApiError('Chọn ít nhất một từ khóa hoặc bộ lọc để theo dõi.');
  const words=[...new Set(normalizeSearch(filters.q).split(/\s+/).filter(Boolean))].sort();
  const schools=[...new Set((university?[university.name,university.code,...university.aliases]:[filters.school]).map(normalizeUniversity))];
  const signature=createHash('sha256').update(JSON.stringify({...filters,q:words.join(' '),school:normalizeUniversity(filters.school)})).digest('hex');
  return {filters,words,schools,signature};
}
export async function listSavedSearches(userId:string):Promise<SavedSearch[]> {
  const rows=await query('SELECT * FROM saved_searches WHERE user_id=$1 ORDER BY created_at DESC,id',[userId]);
  return rows.map(r=>{
    const filters:NeedFilters={q:r.search_query,category:r.category,kind:r.kind,condition:r.condition,school:r.school,minPrice:r.min_price===null?'':String(Number(r.min_price)),maxPrice:r.max_price===null?'':String(Number(r.max_price))};
    return {id:r.id,name:r.name,enabled:r.enabled,filters,href:'/explore?'+new URLSearchParams({...filters,sort:'newest'})};
  });
}
async function baseline(client:import('pg').PoolClient,id:string) {
  await client.query(`INSERT INTO saved_search_matches(search_id,product_id)
    SELECT n.id,p.id FROM saved_searches n CROSS JOIN products p JOIN users u ON u.id=p.seller_id JOIN categories c ON c.id=p.category_id
    WHERE n.id=$1 AND market_saved_search_matches(n,p,u.university,u.full_name,c.name) ON CONFLICT DO NOTHING`,[id]);
}
export async function saveSearch(userId:string,input:{name?:unknown;filters?:unknown}) {
  const name=typeof input.name==='string'?input.name.trim():'';
  if(!name || name.length>100) throw new ApiError('Tên nhu cầu cần 1–100 ký tự.');
  const {filters,words,schools,signature}=parseNeed(input.filters);
  return transaction(async client=>{
    await client.query('SELECT pg_advisory_xact_lock(732619204)');
    const {rows:[count]}=await client.query('SELECT count(*)::int AS n FROM saved_searches WHERE user_id=$1',[userId]);
    if(count.n>=10) throw new ApiError('Bạn có thể lưu tối đa 10 nhu cầu. Xóa nhu cầu không dùng trước khi thêm.',409);
    const {rows:[r]}=await client.query(`INSERT INTO saved_searches(user_id,name,signature,search_query,search_words,category,kind,condition,school,school_names,min_price,max_price)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT(user_id,signature) DO NOTHING RETURNING id`,
      [userId,name,signature,filters.q,words,filters.category,filters.kind,filters.condition,filters.school,schools,filters.minPrice||null,filters.maxPrice||null]);
    if(!r) throw new ApiError('Bạn đã lưu nhu cầu có cùng bộ lọc này. Quản lý trong mục Yêu thích.',409);
    await baseline(client,r.id);
    return {id:r.id,message:'Đã lưu nhu cầu. Bạn sẽ nhận thông báo khi có tin mới phù hợp được duyệt.'};
  });
}
export async function changeSavedSearch(id:string,userId:string,enabled:boolean) {
  if(!isUUID(id)) throw new ApiError('Không tìm thấy nhu cầu.',404);
  return transaction(async client=>{
    await client.query('SELECT pg_advisory_xact_lock(732619204)');
    const {rows:[r]}=await client.query('SELECT enabled FROM saved_searches WHERE id=$1 AND user_id=$2 FOR UPDATE',[id,userId]);
    if(!r) throw new ApiError('Không tìm thấy nhu cầu.',404);
    if(enabled&&!r.enabled) await baseline(client,id);
    await client.query('UPDATE saved_searches SET enabled=$3 WHERE id=$1 AND user_id=$2',[id,userId,enabled]);
    return {message:enabled?'Đã bật theo dõi các tin mới từ bây giờ.':'Đã tạm dừng theo dõi nhu cầu.'};
  });
}
export async function deleteSavedSearch(id:string,userId:string) {
  if(!isUUID(id)) throw new ApiError('Không tìm thấy nhu cầu.',404);
  return transaction(async client=>{
    await client.query('SELECT pg_advisory_xact_lock(732619204)');
    const {rows}=await client.query('DELETE FROM saved_searches WHERE id=$1 AND user_id=$2 RETURNING id',[id,userId]);
    if(!rows.length) throw new ApiError('Không tìm thấy nhu cầu.',404);
    return {message:'Đã xóa nhu cầu theo dõi.'};
  });
}
