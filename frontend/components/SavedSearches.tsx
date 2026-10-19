"use client";
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import type {Viewer} from '@/lib/types';
import type {NeedFilters,SavedSearch} from '@/lib/saved-search-types';
import {formatPrice} from '@/lib/storage';
import styles from './SavedSearches.module.css';

function description(f:NeedFilters) {
  return [f.q&&`“${f.q}”`,f.category!=='Tất cả'&&f.category,f.kind==='sell'?'Mua bán':f.kind==='exchange'?'Trao đổi / miễn phí':'',f.condition,f.school,
    f.minPrice!==''&&'Từ '+formatPrice(Number(f.minPrice)),f.maxPrice!==''&&'Đến '+formatPrice(Number(f.maxPrice))].filter(Boolean).join(' · ');
}
export function SaveNeedButton({viewer,filters,invalid=false}:{viewer:Viewer|null;filters:NeedFilters;invalid?:boolean}) {
  const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  const text=description(filters);
  async function submit(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault();setBusy(true);setError('');setMessage('');
    const form=new FormData(event.currentTarget);
    try {
      const res=await fetch('/api/saved-searches',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:form.get('name'),filters})});
      const data=await res.json();if(!res.ok)throw Error(data.error||'Không lưu được nhu cầu.');
      setOpen(false);setMessage(data.message);
    }catch(e){setError(e instanceof Error?e.message:'Không lưu được nhu cầu.');}finally{setBusy(false);}
  }
  return <section className={styles.save} aria-label="Theo dõi nhu cầu mua">
    <div className={styles.row}><div><strong>Tìm đúng món, nhận tin khi có đồ phù hợp</strong><p>Lưu bộ lọc này để nhận cập nhật qua chuông thông báo.</p></div>
      {!viewer?<Link className="figma-button" href="/explore?auth=login">Đăng nhập để theo dõi</Link>:viewer.role==='student'&&viewer.status==='verified'?<button className="figma-button" disabled={invalid||busy||!text} aria-expanded={open} onClick={()=>{setOpen(v=>!v);setMessage('');setError('');}}>{open?'Đóng biểu mẫu':'Theo dõi nhu cầu này'}</button>:<small>Cần tài khoản sinh viên đã xác minh.</small>}</div>
    {!text&&viewer?.role==='student'&&<small>Chọn từ khóa, danh mục, trường hoặc ngân sách trước khi lưu.</small>}
    {error&&<p role="alert" className={styles.error}>{error}</p>}{message&&<p role="status" className={styles.success}>{message} <Link href="/saved#needs">Quản lý nhu cầu</Link></p>}
    {open&&<form className={styles.form} onSubmit={submit}><p>{text}</p><label>Tên nhu cầu<input name="name" key={text} defaultValue={text.slice(0,100)} maxLength={100} required disabled={busy}/></label><small>Nhận tin mới từ lúc lưu. Những tin đang có không tạo thông báo cũ.</small><button className="figma-button primary" disabled={busy||invalid}>{busy?'Đang lưu…':'Lưu & bật thông báo'}</button></form>}
  </section>;
}
export default function SavedSearches({viewer}:{viewer:Viewer|null}) {
  const [items,setItems]=useState<SavedSearch[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState('');
  const [error,setError]=useState(''),[notice,setNotice]=useState(''),[remove,setRemove]=useState('');
  const load=useCallback(async()=>{
    if(viewer?.role!=='student')return;
    try{const res=await fetch('/api/saved-searches',{cache:'no-store'});const data=await res.json();if(!res.ok)throw Error(data.error||'Không tải được nhu cầu.');setItems(data.searches);setError('');}
    catch(e){setError(e instanceof Error?e.message:'Không tải được nhu cầu.');}finally{setLoading(false);}
  },[viewer?.role]);
  useEffect(()=>{void Promise.resolve().then(load);},[load]);
  async function change(item:SavedSearch,deleting=false) {
    setBusy(item.id);setError('');setNotice('');
    try{const res=await fetch('/api/saved-searches/'+item.id,{method:deleting?'DELETE':'PATCH',headers:{'Content-Type':'application/json'},...(deleting?{}:{body:JSON.stringify({enabled:!item.enabled})})});
      const data=await res.json();if(!res.ok)throw Error(data.error||'Không cập nhật được nhu cầu.');await load();setNotice(data.message);setRemove('');
    }catch(e){setError(e instanceof Error?e.message:'Không cập nhật được nhu cầu.');}finally{setBusy('');}
  }
  if(viewer?.role!=='student')return null;
  return <section className={styles.panel} id="needs" aria-label="Nhu cầu đang theo dõi">
    <div className={styles.row}><div><span className={styles.kicker}>ĐỢI ĐÚNG MÓN ĐỒ BẠN CẦN</span><h2>Nhu cầu đang theo dõi</h2></div><Link className="figma-button" href="/explore#marketplace-grid">Thêm nhu cầu</Link></div>
    <p className={styles.muted}>Tối đa 10 nhu cầu. Khi có tin phù hợp được duyệt, SangTay sẽ báo qua chuông trên website.</p>
    {error&&<p role="alert" className={styles.error}>{error} <button className="figma-button" onClick={()=>void load()}>Thử lại</button></p>}{notice&&<p role="status" className={styles.success}>{notice}</p>}
    {loading?<p>Đang tải nhu cầu…</p>:!items.length?<p className={styles.muted}>Chưa lưu nhu cầu nào. Vào Khám phá, chọn bộ lọc rồi bấm “Theo dõi nhu cầu này”.</p>:<div className={styles.grid}>{items.map(item=><article className={styles.card} key={item.id} aria-label={'Nhu cầu '+item.name}>
      <div className={styles.row}><h3>{item.name}</h3><span className={styles.badge}>{item.enabled?'Đang theo dõi':'Đã tạm dừng'}</span></div><p>{description(item.filters)}</p>
      <div className={styles.actions}><Link className="figma-button primary" href={item.href}>Xem món phù hợp</Link><button className="figma-button" disabled={!!busy} onClick={()=>void change(item)}>{item.enabled?'Tạm dừng':'Bật lại'}</button><button className="figma-button" disabled={!!busy} onClick={()=>setRemove(item.id)}>Xóa nhu cầu</button></div>
      {remove===item.id&&<div className={styles.confirm}><p>Xóa nhu cầu và các thông báo tương ứng?</p><div className={styles.actions}><button className="figma-button" disabled={!!busy} onClick={()=>void change(item,true)}>Đồng ý xóa</button><button className="figma-button" disabled={!!busy} onClick={()=>setRemove('')}>Giữ lại</button></div></div>}
    </article>)}</div>}
  </section>;
}
