"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "@/components/TransitionLink";
import { useEffect, useRef, useState } from "react";
import { observeProductReveal } from "@/lib/product-scroll-reveal";
import type { Listing } from "@/lib/types";
import { formatPrice } from "@/lib/storage";
import Icon from "./FigmaIcon";
import SellerProfileIcon from "./SellerProfileIcon";

export default function MarketplaceCard({ item, saved = false, onSave, onContact, motionId, variant = "default" }: {
  item: Listing; saved?: boolean; onSave?: (item: Listing) => void; onContact?: (item: Listing) => void; motionId?: string; variant?: "default" | "seller";
}) {
  const [failed, setFailed] = useState(false);
  const [expiredHold, setExpiredHold] = useState('');
  useEffect(()=>{
    const until=item.reservedUntil;
    if(!until) return;
    const timer=setTimeout(()=>setExpiredHold(until),Math.max(0,Date.parse(until)-Date.now()+20));
    return ()=>clearTimeout(timer);
  },[item.reservedUntil]);
  const reserved=Boolean(item.reservedUntil && item.reservedUntil!==expiredHold);
  const cardRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (cardRef.current) return observeProductReveal(cardRef.current);
  }, [item.id]);
  const compact = variant === "seller";
  const compactSold = compact && item.status === "Sold";
  return <article ref={cardRef} className={`figma-product-card product-scroll-reveal${compact ? " seller-product-card" : ""}${compactSold ? " seller-product-sold" : ""}`} data-motion-id={motionId}>
    <Link href={`/listing/${item.id}`} className="figma-card-image" aria-label={`Xem chi tiết ${item.title}`}>
      {!failed && item.image ? <img src={item.image} alt={item.title} loading="lazy" decoding="async" onError={() => setFailed(true)} /> : <span className="image-fallback">{item.emoji || "📦"}</span>}
      {(reserved || (!compact && (item.promotion || item.status === "Sold"))) && <span className="figma-badge image-badge">{item.status === "Sold" ? "Đã bán" : reserved ? "Đang giữ chỗ" : item.promotion?.badge}</span>}
    </Link>
    {onSave && !compactSold && <button type="button" className={`figma-card-save ${saved ? "is-saved" : ""}`} aria-pressed={saved} aria-label={`${saved ? "Bỏ lưu" : "Lưu"} ${item.title}`} onClick={() => onSave(item)}>{compact ? <SellerProfileIcon name="heart" /> : <Icon name="heart" size={18} />}</button>}
    <div className="figma-card-body">
      <div className="figma-card-meta"><span className="figma-badge">{compactSold ? "Đã bán" : item.condition}</span>{!compact && <><span>·</span><span>{item.posted || "Gần đây"}</span></>}</div>
      <Link href={`/listing/${item.id}`} className="figma-card-title">{item.title}</Link>
      <strong className="figma-card-price">{item.price===0&&item.description.startsWith("Tặng miễn phí.")?"Tặng miễn phí":formatPrice(item.price)}</strong>
      {compact ? <p className="seller-product-posted">{compactSold ? "Đã hoàn tất giao dịch" : item.posted || "Tin đăng trên SangTay"}</p> : <>
        <div className="figma-card-location"><Icon name="pin" size={15} /><span>{item.school || item.location}</span></div>
        <div className="figma-card-seller"><span className="figma-avatar">{(item.seller || "S").charAt(0)}</span><div><strong>{item.seller}</strong><small>{item.school}</small></div></div>
      </>}
      <div className="figma-card-actions"><Link href={`/listing/${item.id}`} className="figma-button soft" aria-label={compact ? `Xem chi tiết ${item.title}` : undefined}>Xem chi tiết {!compact && <Icon name="arrow" size={18} />}</Link>{!compact && (onContact ? <button className="figma-button icon-only" aria-label={`Nhắn tin cho ${item.seller}`} onClick={() => onContact(item)}><Icon name="chat" size={18} /></button> : <Link href={`/messages?listingId=${item.id}`} className="figma-button icon-only" aria-label={`Nhắn tin cho ${item.seller}`}><Icon name="chat" size={18} /></Link>)}</div>
    </div>
  </article>;
}
