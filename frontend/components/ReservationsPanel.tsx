"use client";
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { Viewer } from '@/lib/types';
import { meetingTime, reservationLabels, type Reservation } from '@/lib/reservation-types';
import { MeetingMapLinks } from './LocationMap';
import styles from './ReservationsPanel.module.css';

export default function ReservationsPanel({viewer,listingId,sellerId,location='',available=true,board=false}:{
  viewer:Viewer|null;listingId?:string;sellerId?:string;location?:string;available?:boolean;board?:boolean;
}) {
  const [items,setItems]=useState<Reservation[]>([]);
  const [loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [busy,setBusy]=useState(''),[open,setOpen]=useState(false),[held,setHeld]=useState<string|null>(null);
  const [confirming,setConfirming]=useState<{id:string;action:string}|null>(null);
  const [filter,setFilter]=useState('active');
  const own=viewer?.pgUserId===sellerId;
  const student=viewer?.role==='student' && viewer.status==='verified';
  const load=useCallback(async()=>{
    if(!student) {setLoading(false);return;}
    try {
      const res=await fetch('/api/reservations'+(listingId?'?listingId='+encodeURIComponent(listingId):''),{cache:'no-store'});
      const data=await res.json(); if(!res.ok) throw new Error(data.error||'Chưa tải được lịch hẹn.');
      setItems(data.reservations);setHeld(data.heldUntil);setError('');
    } catch(e) {setError(e instanceof Error?e.message:'Chưa tải được lịch hẹn.');} finally {setLoading(false);}
  },[listingId,student]);
  useEffect(()=>{
    let disposed=false;
    const refresh=()=>{if(!disposed && document.visibilityState==='visible') void load();};
    void Promise.resolve().then(refresh);const timer=setInterval(refresh,20000);window.addEventListener('focus',refresh);
    return ()=>{disposed=true;clearInterval(timer);window.removeEventListener('focus',refresh);};
  },[load]);
  async function create(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault();setBusy('create');setError('');setNotice('');
    const form=new FormData(event.currentTarget);
    try {
      const value=String(form.get('meetingAt'));
      const meetingAt=new Date(value+':00+07:00').toISOString();
      const res=await fetch('/api/reservations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({listingId,meetingAt,location:form.get('location'),note:form.get('note')})});
      const data=await res.json();if(!res.ok) throw new Error(data.error||'Không gửi được yêu cầu.');
      setOpen(false);setNotice(data.message);await load();
    } catch(e){setError(e instanceof Error?e.message:'Không gửi được yêu cầu.');} finally{setBusy('');}
  }
  async function act(id:string,action:string) {
    setBusy(id);setError('');setNotice('');
    try {
      const res=await fetch('/api/reservations/'+id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({action})});
      const data=await res.json();if(!res.ok) throw new Error(data.error||'Không cập nhật được lịch hẹn.');
      setNotice(data.message);setConfirming(null);await load();
      window.dispatchEvent(new Event('sangtay_reservations_changed'));
    } catch(e){await load();setError(e instanceof Error?e.message:'Không cập nhật được lịch hẹn.');} finally{setBusy('');}
  }
  const active=(r:Reservation)=>r.status==='PENDING'||r.status==='CONFIRMED';
  const mine=items.some(active);
  const shown=board?items.filter(r=>filter==='all'||filter==='active'&&active(r)||filter==='buying'&&!r.isSeller||filter==='selling'&&r.isSeller):items.slice(0,5);
  return <section className={styles.panel} aria-label="Giữ chỗ và lịch hẹn">
    <div className={styles.heading}><div><span className={styles.kicker}>HẸN GẶP ĐỂ SANG TAY</span><h2>{board?'Giữ chỗ & lịch giao dịch':'Giữ chỗ & đặt lịch gặp'}</h2></div>{student&&<button className="figma-button" onClick={()=>void load()} disabled={!!busy}>Làm mới lịch</button>}</div>
    <p className={styles.description}>Chọn giờ và địa điểm công cộng. Sản phẩm chỉ được giữ sau khi người bán xác nhận.</p>
    {!viewer?<Link className="figma-button" href="/explore?auth=login">Đăng nhập để đặt lịch</Link>:!student?<p>Lịch hẹn dành cho tài khoản sinh viên đã xác minh.</p>:<>
      {error&&<p className={styles.error} role="alert">{error}</p>}{notice&&<p className={styles.notice} role="status">{notice}</p>}
      {board&&<div className={styles.tabs} role="group" aria-label="Lọc lịch hẹn">{[['active','Đang chờ / đã xác nhận'],['buying','Tôi mua'],['selling','Tôi bán'],['all','Tất cả']].map(([key,label])=><button key={key} className="figma-button" aria-pressed={filter===key} onClick={()=>setFilter(key)}>{label}</button>)}</div>}
      {loading?<p>Đang tải lịch hẹn…</p>:<>
        {!board && !own && listingId && available && !mine && !held && <button className="figma-button primary" aria-expanded={open} onClick={()=>setOpen(v=>!v)}>{open?'Đóng biểu mẫu':'Yêu cầu giữ chỗ & đặt lịch'}</button>}
        {!board && held && !items.some(r=>r.status==='CONFIRMED') && <p className={styles.notice}>Món đồ đang được giữ cho người mua khác đến {meetingTime(held)}.</p>}
        {!board && !available && <p>Tin hiện không nhận lịch hẹn mới.</p>}
        {open && !mine && !held && available && <form className={styles.form} onSubmit={create}>
          <label>Thời gian gặp (giờ Việt Nam)<input name="meetingAt" type="datetime-local" required disabled={!!busy}/></label>
          <small>Cách hiện tại ít nhất 15 phút, trong vòng 7 ngày. Yêu cầu chờ tối đa 24 giờ hoặc đến giờ gặp.</small>
          <label>Địa điểm công cộng<input name="location" defaultValue={location} minLength={5} maxLength={240} required placeholder="Ví dụ: Sảnh thư viện DNTU" disabled={!!busy}/></label>
          <label>Ghi chú cho người bán<textarea name="note" maxLength={500} rows={2} placeholder="Ví dụ: Mình muốn kiểm tra máy và phụ kiện." disabled={!!busy}/></label>
          <button className="figma-button primary" disabled={!!busy}>{busy==='create'?'Đang gửi…':'Gửi yêu cầu giữ chỗ'}</button>
        </form>}
        {!shown.length&&<p className={styles.empty}>{own?'Chưa có yêu cầu giữ chỗ cho món đồ này.':board?'Chưa có lịch hẹn trong mục này.':'Lịch hẹn của bạn sẽ xuất hiện ở đây.'}</p>}
        <div className={styles.list}>{shown.map(r=><article key={r.id} className={styles.card} aria-label={'Lịch hẹn '+r.listingTitle}>
          <div className={styles.cardHeader}><Link href={'/listing/'+r.listingId}>{r.listingTitle}</Link><span className={styles.badge} data-status={r.status}>{reservationLabels[r.status]}</span></div>
          <p>{r.isSeller?'Người mua: '+r.buyerName:'Người bán: '+r.sellerName}</p>
          <strong>Gặp lúc {meetingTime(r.meetingAt)} (giờ Việt Nam)</strong><p>{r.location}</p>{r.note&&<p className={styles.note}>{r.note}</p>}
          {active(r)&&<small>{r.status==='PENDING'?'Chờ xác nhận đến ':'Giữ chỗ đến '}{meetingTime(r.expiresAt)}</small>}
          <MeetingMapLinks location={r.location}/>
          <div className={styles.actions}>
            <Link className="figma-button" href={'/messages?listingId='+r.listingId}>Nhắn đối tác</Link>
            {r.isSeller&&r.status==='PENDING'&&<><button className="figma-button primary" disabled={!!busy} onClick={()=>void act(r.id,'accept')}>Xác nhận & giữ chỗ</button><button className="figma-button" disabled={!!busy} onClick={()=>void act(r.id,'reject')}>Từ chối</button></>}
            {active(r)&&<button className="figma-button" disabled={!!busy} onClick={()=>setConfirming({id:r.id,action:'cancel'})}>{r.status==='PENDING'?'Hủy yêu cầu':'Hủy lịch'}</button>}
            {r.isSeller&&r.status==='CONFIRMED'&&<button className="figma-button primary" disabled={!!busy} onClick={()=>setConfirming({id:r.id,action:'complete'})}>Đã giao cho người mua</button>}
          </div>
          {confirming?.id===r.id&&<div className={styles.confirm} role="alert"><p>{confirming.action==='complete'?'Chỉ xác nhận khi đã giao đồ. Tin sẽ được đánh dấu đã bán và người mua cần xác nhận nhận hàng trong mục giao dịch.':'Hủy lịch này và bỏ giữ chỗ để người khác có thể đặt lại?'}</p><div className={styles.actions}><button className="figma-button primary" disabled={!!busy} onClick={()=>void act(r.id,confirming.action)}>Đồng ý xác nhận</button><button className="figma-button" disabled={!!busy} onClick={()=>setConfirming(null)}>Quay lại</button></div></div>}
        </article>)}</div>
        {!board&&<Link className={styles.more} href="/transactions">Xem tất cả lịch hẹn & giao dịch →</Link>}
      </>}
    </>}
  </section>;
}
