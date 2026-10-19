"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { formatPrice } from "@/lib/storage";
import ReservationsPanel from "@/components/ReservationsPanel";
import type { Viewer } from "@/lib/types";
type Sale={id:string;listingId:string;listingTitle:string;listingPrice:number;sellerId:string;buyerId:string;sellerName:string;buyerName:string;isBuyer:boolean;status:string};
export default function TransactionsPage(){
  const [sales,setSales]=useState<Sale[]>([]);
  const [viewer,setViewer]=useState<Viewer|null>(null);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState("");
  async function load(){
    try {
      const res=await fetch("/api/transactions",{cache:"no-store"});const data=await res.json();
      if(!res.ok) throw new Error(data.error);
      setSales(data.transactions);
    }catch(e){setError(e instanceof Error?e.message:"Không tải được giao dịch.");}
    finally{setLoading(false);}
  }
  useEffect(()=>{
    void Promise.resolve().then(load);
    void fetch('/api/auth/me',{cache:'no-store'}).then(r=>r.json()).then(data=>setViewer(data.user||null)).catch(()=>{});
    const refresh=()=>void load();window.addEventListener('sangtay_reservations_changed',refresh);
    return ()=>window.removeEventListener('sangtay_reservations_changed',refresh);
  },[]);
  async function confirm(sale:Sale,value:boolean){
    setBusy(sale.id);setError("");
    try{
      const res=await fetch(`/api/transactions/${sale.id}/confirm`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({confirm:value})});
      const data=await res.json();if(!res.ok) throw new Error(data.error);
      await load();
    }catch(e){setError(e instanceof Error?e.message:"Không thể xác nhận.");}
    finally{setBusy("");}
  }
  async function review(sale:Sale,event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();const form=new FormData(event.currentTarget);setBusy(sale.id);setError("");
    try{
      const res=await fetch("/api/reviews",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        productId:sale.listingId,targetUserId:sale.isBuyer?sale.sellerId:sale.buyerId,rating:Number(form.get("rating")),content:form.get("content")})});
      const data=await res.json();if(!res.ok) throw new Error(data.error);setError("Đã lưu đánh giá.");
    }catch(e){setError(e instanceof Error?e.message:"Không lưu được đánh giá.");}finally{setBusy("");}
  }
  const labels:Record<string,string>={SELLER_CONFIRMED:"Chờ người mua xác nhận",COMPLETED:"Hoàn tất",CANCELLED:"Đã hủy"};
  return <div className="site-shell"><Navbar/><main className="container" style={{padding:"40px 0",minHeight:"70vh"}}>
    <h1>Giao dịch của tôi</h1><p>Quản lý lịch gặp, giữ chỗ và xác nhận nhận hàng tại một nơi.</p>
    <ReservationsPanel viewer={viewer} board/>
    <h2>Xác nhận nhận hàng & đánh giá</h2><p>Chỉ xác nhận sau khi đã nhận hàng và kiểm tra sản phẩm.</p>
    {error&&<p role="status">{error}</p>}{loading?<p>Đang tải…</p>:!sales.length?<p>Chưa có giao dịch. <Link href="/explore">Khám phá tin đăng</Link></p>:sales.map(sale=><article key={sale.id} style={{border:"1px solid #ddd",borderRadius:12,padding:20,margin:"16px 0"}}>
      <h2>{sale.listingTitle}</h2><p>{formatPrice(sale.listingPrice)} · Người bán: {sale.sellerName} · Người mua: {sale.buyerName}</p><strong>{labels[sale.status]||sale.status}</strong>
      {sale.isBuyer&&sale.status==="SELLER_CONFIRMED"&&<div style={{display:"flex",gap:12,marginTop:16}}>
        <button disabled={busy===sale.id} onClick={()=>confirm(sale,true)}>Tôi đã nhận hàng</button>
        <button disabled={busy===sale.id} onClick={()=>confirm(sale,false)}>Tôi không mua món này</button>
      </div>}
      {sale.status==="COMPLETED"&&<form onSubmit={e=>review(sale,e)} style={{display:"grid",gap:10,marginTop:16}}>
        <label>Đánh giá đối tác <select name="rating" defaultValue="5">{[5,4,3,2,1].map(n=><option key={n} value={n}>{n} sao</option>)}</select></label>
        <textarea name="content" aria-label="Nội dung đánh giá" minLength={3} maxLength={2000} required/>
        <button disabled={busy===sale.id}>Gửi đánh giá</button>
      </form>}
    </article>)}
  </main><Footer/></div>;
}

