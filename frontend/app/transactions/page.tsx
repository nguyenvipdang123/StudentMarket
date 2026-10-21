"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "@/components/TransitionLink";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { formatPrice } from "@/lib/storage";
import { meetingTime } from "@/lib/reservation-types";
import ReservationsPanel from "@/components/ReservationsPanel";
import type { Viewer } from "@/lib/types";
import styles from "./transactions.module.css";

type Sale={id:string;listingId:string;listingTitle:string;listingPrice:number;sellerId:string;buyerId:string;sellerName:string;buyerName:string;isBuyer:boolean;status:string;
  sellerConfirmedAt:string|null;buyerConfirmedAt:string|null;completedAt:string|null;meetingAt:string|null;meetingLocation:string|null;myReviewId:string|null};

export default function TransactionsPage(){
  const [sales,setSales]=useState<Sale[]>([]);
  const [viewer,setViewer]=useState<Viewer|null>(null);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState("");
  const [confirming,setConfirming]=useState<{id:string;value:boolean}|null>(null);
  const load=useCallback(async()=>{
    try {
      const res=await fetch("/api/transactions",{cache:"no-store"});const data=await res.json();
      if(!res.ok) throw new Error(data.error||'Không tải được giao dịch.');
      setSales(data.transactions);
    }catch(e){setError(e instanceof Error?e.message:"Không tải được giao dịch.");}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{
    let disposed=false;
    const refresh=()=>{if(!disposed&&document.visibilityState==='visible')void load();};
    void Promise.resolve().then(refresh);
    void fetch('/api/auth/me',{cache:'no-store'}).then(r=>r.json()).then(data=>{if(!disposed)setViewer(data.user||null);}).catch(()=>{});
    const timer=setInterval(refresh,20000);
    window.addEventListener('sangtay_reservations_changed',refresh);window.addEventListener('focus',refresh);
    return ()=>{disposed=true;clearInterval(timer);window.removeEventListener('sangtay_reservations_changed',refresh);window.removeEventListener('focus',refresh);};
  },[load]);
  async function confirm(sale:Sale,value:boolean){
    setBusy(sale.id);setError("");setNotice("");
    try{
      const res=await fetch(`/api/transactions/${sale.id}/confirm`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({confirm:value})});
      const data=await res.json();if(!res.ok) throw new Error(data.error);
      setNotice(data.message);setConfirming(null);await load();
      window.dispatchEvent(new Event('sangtay_reservations_changed'));
    }catch(e){setError(e instanceof Error?e.message:"Không thể xác nhận.");}
    finally{setBusy("");}
  }
  async function review(sale:Sale,event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();const form=new FormData(event.currentTarget);setBusy(sale.id);setError("");setNotice("");
    try{
      const res=await fetch("/api/reviews",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        transactionId:sale.id,rating:Number(form.get("rating")),content:form.get("content")})});
      const data=await res.json();if(!res.ok) throw new Error(data.error);
      setNotice("Đã lưu đánh giá gắn với giao dịch đã hoàn tất.");await load();
    }catch(e){setError(e instanceof Error?e.message:"Không lưu được đánh giá.");}finally{setBusy("");}
  }
  const labels:Record<string,string>={SELLER_CONFIRMED:"Chờ người mua xác nhận",COMPLETED:"Hoàn tất",CANCELLED:"Đã hủy"};
  return <div className="site-shell"><Navbar/><main className={'container '+styles.page}>
    <span className="section-kicker">HẸN GẶP · XÁC NHẬN · ĐÁNH GIÁ</span>
    <h1>Giao dịch của tôi</h1><p>Quản lý lịch gặp, giữ chỗ và xác nhận nhận hàng tại một nơi.</p>
    <ReservationsPanel viewer={viewer} board/>
    <section aria-label="Xác nhận nhận hàng và đánh giá">
      <div className={styles.heading}><div><h2>Xác nhận nhận hàng & đánh giá</h2><p>Người bán xác nhận đã giao đồ, người mua xác nhận đã nhận. Đánh giá được mở khi cả hai hoàn tất.</p></div><button className="figma-button" disabled={!!busy} onClick={()=>void load()}>Làm mới giao dịch</button></div>
      {error&&<p className={styles.error} role="alert">{error}</p>}{notice&&<p className={styles.notice} role="status">{notice}</p>}
      {loading?<p>Đang tải…</p>:!sales.length?<p>Chưa có giao dịch. <Link href="/explore">Khám phá tin đăng</Link></p>:sales.map(sale=><article key={sale.id} id={'transaction-'+sale.id} aria-label={'Giao dịch '+sale.listingTitle} className={styles.card}>
        <div className={styles.heading}><div><small>{sale.isBuyer?'BẠN LÀ NGƯỜI MUA':'BẠN LÀ NGƯỜI BÁN'}</small><h3><Link href={'/listing/'+sale.listingId}>{sale.listingTitle}</Link></h3></div><span className={styles.badge} data-status={sale.status}>{labels[sale.status]||sale.status}</span></div>
        <p>{formatPrice(sale.listingPrice)} · Người bán: {sale.sellerName} · Người mua: {sale.buyerName}</p>
        {sale.meetingAt&&<p>Lịch hẹn: {meetingTime(sale.meetingAt)} · {sale.meetingLocation}</p>}
        <ol className={styles.steps} aria-label="Xác nhận của hai bên">
          <li><span aria-hidden="true">{sale.sellerConfirmedAt?'✓':'1'}</span><div><strong>Người bán xác nhận đã giao</strong><small>{sale.sellerConfirmedAt?meetingTime(sale.sellerConfirmedAt):'Chưa xác nhận'}</small></div></li>
          <li><span aria-hidden="true">{sale.buyerConfirmedAt?'✓':'2'}</span><div><strong>Người mua xác nhận đã nhận</strong><small>{sale.buyerConfirmedAt?meetingTime(sale.buyerConfirmedAt):sale.status==='CANCELLED'?'Không xác nhận giao dịch':'Đang chờ xác nhận'}</small></div></li>
        </ol>
        {sale.isBuyer&&sale.status==="SELLER_CONFIRMED"&&<div className={styles.actions}>
          <button className="figma-button primary" disabled={!!busy} onClick={()=>setConfirming({id:sale.id,value:true})}>Tôi đã nhận hàng</button>
          <button className="figma-button" disabled={!!busy} onClick={()=>setConfirming({id:sale.id,value:false})}>Tôi không mua món này</button>
        </div>}
        {!sale.isBuyer&&sale.status==='SELLER_CONFIRMED'&&<p className={styles.notice}>Bạn đã xác nhận giao đồ. Đang chờ người mua xác nhận nhận hàng để hoàn tất.</p>}
        {confirming?.id===sale.id&&sale.status==='SELLER_CONFIRMED'&&<div className={styles.confirm} role="alert"><p>{confirming.value?'Chỉ xác nhận khi bạn đã nhận và kiểm tra món đồ. Giao dịch sẽ hoàn tất và cả hai có thể đánh giá nhau.':'Bạn chưa nhận hoặc không mua món đồ này? Giao dịch sẽ bị hủy, tin được mở lại và không thể đánh giá từ giao dịch này.'}</p><div className={styles.actions}><button className="figma-button primary" disabled={!!busy} onClick={()=>void confirm(sale,confirming.value)}>{confirming.value?'Xác nhận đã nhận hàng':'Xác nhận không mua'}</button><button className="figma-button" disabled={!!busy} onClick={()=>setConfirming(null)}>Quay lại</button></div></div>}
        {sale.status==="COMPLETED"&&<>
          <p className={styles.notice}>✓ Hai bên đã xác nhận giao dịch hoàn tất{sale.completedAt?' · '+meetingTime(sale.completedAt):''}.</p>
          {sale.myReviewId?<p>Bạn đã đánh giá giao dịch này. <Link href="/account?tab=reviews">Xem đánh giá của tôi</Link></p>:<form onSubmit={e=>void review(sale,e)} className={styles.form}>
            <h4>Đánh giá {sale.isBuyer?'người bán':'người mua'}</h4><small>Mỗi bên được gửi một đánh giá, gắn với giao dịch đã được cả hai xác nhận.</small>
            <label>Đánh giá đối tác <select name="rating" defaultValue="5" disabled={!!busy}>{[5,4,3,2,1].map(n=><option key={n} value={n}>{n} sao</option>)}</select></label>
            <label>Nội dung đánh giá<textarea name="content" aria-label="Nội dung đánh giá" placeholder="Chia sẻ trải nghiệm giao dịch của bạn…" minLength={3} maxLength={2000} required disabled={!!busy}/></label>
            <button className="figma-button primary" disabled={!!busy}>{busy===sale.id?'Đang lưu…':'Gửi đánh giá'}</button>
          </form>}
        </>}
      </article>)}
    </section>
  </main><Footer/></div>;
}
