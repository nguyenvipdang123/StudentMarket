"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import Link from "@/components/TransitionLink";
import type { Listing, Viewer } from "@/lib/types";
import { formatPrice } from "@/lib/storage";
import Icon from "./FigmaIcon";
import MarketplaceCard from "./MarketplaceCard";
import { SafetyNote } from "./FigmaStates";
import LocationMap from "./LocationMap";
import ReservationsPanel from "./ReservationsPanel";
type SellerSummary = { verified: boolean; reviews: { rating: number }[] };
export default function ListingDetailView({ listing, viewer, saved, onSave, onContact, onReview, onReport, onNotice }: {
  listing: Listing; viewer: Viewer | null; saved: boolean; onSave: () => void; onContact: () => void; onReview: () => void; onReport: () => void; onNotice: (message: string) => void;
}) {
  const [related,setRelated] = useState<Listing[]>([]);
  const [summary,setSummary] = useState<SellerSummary | null>(null);
  const [photo,setPhoto] = useState(0);
  const [relatedSaved,setRelatedSaved] = useState<string[]>([]);
  const zoom = useRef<HTMLDialogElement>(null);
  const images = listing.images?.length ? listing.images : [listing.image];
  const own = viewer?.pgUserId === listing.sellerId;
  useEffect(() => {
    let cancelled=false;
    const relatedQuery = new URLSearchParams({ category: listing.category, exclude: listing.id, pageSize: "3" });
    fetch("/api/products?" + relatedQuery).then(r=>r.ok?r.json():null).then(data=>{if(data&&!cancelled) setRelated(data.products);}).catch(()=>{});
    if(listing.sellerId) fetch(`/api/sellers/${listing.sellerId}`).then(r=>r.ok?r.json():null).then(data=>{if(data&&!cancelled) setSummary({verified:data.seller.verified,reviews:data.reviews});}).catch(()=>{});
    return ()=>{cancelled=true;};
  },[listing.id,listing.category,listing.school,listing.sellerId]);
  const rating = summary?.reviews.length ? (summary.reviews.reduce((sum,r)=>sum+r.rating,0)/summary.reviews.length).toFixed(1) : null;
  useEffect(()=>{if(!viewer)return;void fetch("/api/favorites",{cache:"no-store"}).then(r=>r.ok?r.json():null).then(data=>{if(data)setRelatedSaved((data.favorites||[]).map((f:{productId:string})=>String(f.productId)));}).catch(()=>{});},[viewer]);
  async function saveRelated(item: Listing) {
    if(!viewer) { onNotice("Vui lòng đăng nhập để lưu tin."); return; }
    try { const r=await fetch("/api/favorites",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({productId:item.id})}); const data=await r.json(); if(!r.ok) throw new Error(data.error || "Không lưu được tin."); setRelatedSaved(ids=>data.isSaved?[...ids,item.id]:ids.filter(id=>id!==item.id)); window.dispatchEvent(new Event("sangtay_saved_changed")); onNotice(data.isSaved?"Đã lưu tin.":"Đã bỏ lưu tin."); } catch(error){onNotice(error instanceof Error?error.message:"Không lưu được tin.");}
  }
  return <>
    <nav className="figma-breadcrumb" aria-label="Đường dẫn"><Link href="/explore">Khám phá</Link><span>/</span><Link href="/explore">{listing.category}</Link><span>/</span><span>{listing.title}</span></nav>
    <div className="figma-product-overview">
      <div className="figma-stack"><div className="figma-gallery-cover"><img src={images[photo]} alt={listing.title}/><span className="figma-gallery-counter">{photo+1} / {images.length}</span><button className="figma-button figma-gallery-zoom" onClick={()=>zoom.current?.showModal()}><Icon name="expand"/>Phóng to</button></div><div className="figma-gallery-thumbs">{images.map((src,i)=><button key={`${src}-${i}`} className={photo===i?"active":""} aria-label={`Xem ảnh ${i+1}`} aria-pressed={photo===i} onClick={()=>setPhoto(i)}><img src={src} alt={`Ảnh ${i+1} của ${listing.title}`}/></button>)}</div><small className="figma-small">Ảnh do người đăng cung cấp. Kiểm tra món đồ trực tiếp trước khi quyết định.</small></div>
      <div className="figma-stack figma-product-facts"><div className="figma-row"><span className="figma-badge peach">{listing.status==="Sold"?"Đã bán":listing.price===0?(listing.description.startsWith("Tặng miễn phí.")?"Tặng miễn phí":"Trao đổi"):"Bán"}</span><span className="figma-badge">{listing.condition}</span></div><h1>{listing.title}</h1><strong className="figma-detail-price">{listing.price===0&&listing.description.startsWith("Tặng miễn phí.")?"Tặng miễn phí":formatPrice(listing.price)}</strong><small className="figma-small">{listing.createdAt ? `Đăng ${new Date(listing.createdAt).toLocaleDateString("vi-VN")}` : "Tin đăng trên SangTay"}</small><div className="figma-panel figma-stack"><strong>Thông tin món đồ</strong><p>Tình trạng: {listing.condition}</p><p>Danh mục: {listing.category}</p><p>Trường: {listing.school}</p><p>Khu vực: {listing.location}</p></div><div className="figma-row">{own ? <Link className="figma-button primary" href="/my-listings">Quản lý tin đăng</Link> : <button className="figma-button primary" style={{flex:1}} onClick={onContact}><Icon name="chatWhite"/>Nhắn người bán</button>}<button className="figma-button" aria-pressed={saved} onClick={onSave}><Icon name="heart"/>{saved?"Đã lưu":"Lưu tin"}</button></div><SafetyNote>Hẹn xem đồ ở nơi công cộng. Kiểm tra món đồ trực tiếp, không chuyển tiền trước khi hiểu rõ người bán.</SafetyNote></div>
    </div>
    <div className="figma-description-layout"><div><h2>Một món đồ, thêm một hành trình mới.</h2><div className="figma-panel figma-stack"><strong>Mô tả sản phẩm</strong><p>{listing.description}</p><strong>Điều cần kiểm tra khi gặp</strong><p>Thử món đồ, xác nhận phụ kiện và tình trạng thực tế cùng người bán trước khi nhận.</p><strong>Nhận đồ gần trường</strong><p>Liên hệ {listing.seller} để trao đổi địa điểm và thời gian. Ưu tiên sân thư viện hoặc khu vực công cộng có người qua lại.</p></div></div><aside className="figma-stack"><div className="figma-panel figma-stack"><span className="section-kicker">NGƯỜI ĐĂNG TIN</span><div className="figma-row"><span className="figma-avatar large">{(listing.seller||"S").charAt(0)}</span><div><strong>{listing.seller}</strong><p className="figma-small">{listing.school}</p><small className="figma-small">{rating?`★ ${rating}/5 · ${summary?.reviews.length} đánh giá`:"Chưa có đánh giá"}{summary?.verified?" · Đã xác minh":""}</small></div></div>{listing.sellerId && <Link href={`/seller/${listing.sellerId}`} className="figma-button"><Icon name="arrowUp"/>Xem hồ sơ người bán</Link>}<small className="figma-small">Thông tin người bán và đánh giá từ giao dịch trên SangTay.</small></div>{viewer&&!own&&<button className="figma-button" onClick={onReview}>Đánh giá sau giao dịch</button>}{viewer?.role==="student"&&!own&&<button className="figma-button" onClick={onReport}>Báo cáo tin đăng · Nội dung không phù hợp?</button>}</aside></div>
    <ReservationsPanel key={listing.id} listingId={listing.id} sellerId={listing.sellerId} viewer={viewer} location={`${listing.location}, ${listing.school}`} available={listing.status==='Active' && listing.moderationStatus==='APPROVED'}/>
    <LocationMap location={listing.location || listing.school} school={listing.school}/>
    {related.length>0&&<section className="figma-detail-related"><h2>Có thể bạn cũng cần</h2><p className="figma-small">Những món đồ học tập khác quanh trường.</p><div className="figma-card-grid">{related.map(item=><MarketplaceCard key={item.id} item={item} saved={relatedSaved.includes(item.id)} onSave={saveRelated}/>)}</div></section>}
    <div className="figma-detail-mobile-actions"><strong>{formatPrice(listing.price)}</strong><button className="figma-button primary" onClick={own?()=>onNotice("Quản lý tin này trong mục Tin của tôi."):onContact}><Icon name="chatWhite"/>{own?"Tin của bạn":"Nhắn người bán"}</button><button className="figma-button icon-only" aria-label={saved?"Bỏ lưu tin":"Lưu tin"} aria-pressed={saved} onClick={onSave}><Icon name="heart"/></button></div>
    <dialog ref={zoom} className="figma-photo-dialog" aria-label="Xem ảnh sản phẩm"><div className="figma-row"><strong>{listing.title}</strong><button className="figma-button icon-only" aria-label="Đóng ảnh" onClick={()=>zoom.current?.close()}><Icon name="close"/></button></div><img className="photo" src={images[photo]} alt={listing.title}/><div className="figma-row"><button className="figma-button" disabled={images.length<2} onClick={()=>setPhoto(i=>(i+images.length-1)%images.length)}>Ảnh trước</button><span>{photo+1} / {images.length}</span><button className="figma-button" disabled={images.length<2} onClick={()=>setPhoto(i=>(i+1)%images.length)}>Ảnh tiếp</button></div></dialog>
  </>;
}
