"use client";
/* Native images preserve Figma asset geometry and authenticated image URLs. */
/* eslint-disable @next/next/no-img-element */
import { useState, useEffect, type FormEvent, type ChangeEvent, type RefObject } from "react";
import Link from "@/components/TransitionLink";
import type { Conversation, Viewer } from "@/lib/types";
import Icon from "./FigmaIcon";
import { CardSkeletons, EmptyState, PageIntro, SafetyNote } from "./FigmaStates";
import { formatPrice } from "@/lib/storage";
import { MeetingMapLinks } from "./LocationMap";
import { meetingLocation } from "@/lib/google-maps";
import ReservationsPanel from "./ReservationsPanel";

export default function MarketplaceChat({viewer,pgUserId,conversations,activeId,onActive,filter,onFilter,input,onInput,onSend,loading,error,onRetry,partnerOnline,partnerTyping,connectionStatus,onReport,endRef,notice,onNotice}:{viewer:Viewer|null;pgUserId:string;conversations:Conversation[];activeId:string;onActive:(id:string)=>void;filter:"all"|"buying"|"selling";onFilter:(v:"all"|"buying"|"selling")=>void;input:string;onInput:(e:ChangeEvent<HTMLInputElement>)=>void;onSend:(e:FormEvent)=>void;loading:boolean;error:string;onRetry:()=>void;partnerOnline:boolean;partnerTyping:string|null;connectionStatus:string;onReport:(id:string,label:string)=>void;endRef:RefObject<HTMLDivElement|null>;notice:string;onNotice:(text:string)=>void}) {
  const [query,setQuery]=useState("");
  const [unread,setUnread]=useState(false);
  const [mobileOpen,setMobileOpen]=useState(false);
  const [uploading,setUploading]=useState(false);
  const active=conversations.find(c=>c.id===activeId);
  const other=(c:Conversation)=>String(c.buyerId)===pgUserId?c.sellerName:c.buyerName;
  const otherSchool=(c:Conversation)=>String(c.buyerId)===pgUserId?c.sellerSchool:c.buyerSchool;
  const filtered=conversations.filter(c=>(filter==="all"||(filter==="buying"?String(c.buyerId)===pgUserId:String(c.sellerId)===pgUserId))&&(!unread||Boolean(c.unreadCount))&&(!query||(other(c)+" "+c.listingTitle).toLocaleLowerCase("vi").includes(query.toLocaleLowerCase("vi"))));
  const compose=(value:string)=>onInput({target:{value}} as ChangeEvent<HTMLInputElement>);
  const select=(id:string)=>{onActive(id);setMobileOpen(true);onNotice("");};
  useEffect(()=>{if(new URLSearchParams(window.location.search).get("listingId")) { const timer=setTimeout(()=>setMobileOpen(true),0);return ()=>clearTimeout(timer);}},[activeId]);
  const isMobileOpen=mobileOpen;
  async function upload(file:File) {
    if(!active) return;
    setUploading(true);
    try {
      const body=new FormData();body.append("image",file);
      const res=await fetch("/api/conversations/"+active.id+"/attachments",{method:"POST",body});
      const data=await res.json();
      if(!res.ok) throw new Error(data.error||"Không tải được ảnh.");
      compose("[Ảnh] "+data.url);
      onNotice("Ảnh đã được đính kèm. Nhấn Gửi để gửi cho người nhận.");
    }catch(e){onNotice(e instanceof Error?e.message:"Không tải được ảnh.");}
    finally{setUploading(false);}
  }
  return <section className="figma-screen"><PageIntro title="Tin nhắn">Nhắn một câu, trao một món đồ, kết nối thêm một người bạn.</PageIntro>
    {loading?<CardSkeletons count={2}/>:error?<EmptyState title="Chưa tải được hộp thư" action="Thử lại" onAction={onRetry}>{error}</EmptyState>:!viewer?<EmptyState title="Đăng nhập để xem tin nhắn" action="Đăng nhập" href="/explore?auth=login">Mọi cuộc trò chuyện mua bán của bạn sẽ được lưu tại đây.</EmptyState>:conversations.length===0?<EmptyState title="Hộp thư đang chờ câu chuyện đầu tiên" action="Khám phá món đồ" href="/explore">Nhấn “Nhắn người bán” tại một món đồ để bắt đầu trò chuyện.</EmptyState>:
    <div className={"figma-chat-layout"+(isMobileOpen?" conversation-open":"")}>
      <aside className="figma-chat-sidebar"><h2>Hộp thư của bạn</h2><label className="figma-chat-search"><Icon name="search"/><input aria-label="Tìm cuộc trò chuyện" placeholder="Tìm tên hoặc món đồ..." value={query} onChange={e=>setQuery(e.target.value)}/></label>
        <div className="figma-tabs compact">{(["all","buying","selling"] as const).map(key=><button key={key} className={key===filter?"active":""} onClick={()=>onFilter(key)}>{{all:"Tất cả",buying:"Đang mua",selling:"Đang bán"}[key]}</button>)}</div>
        <label className="figma-small figma-row"><input type="checkbox" checked={unread} onChange={e=>setUnread(e.target.checked)}/>Chỉ tin chưa đọc</label>
        <div className="figma-conversation-list">{filtered.length===0?<p className="figma-small">Không có cuộc trò chuyện phù hợp.</p>:filtered.map(c=><button key={c.id} className={"figma-conversation"+(c.id===activeId?" active":"")} onClick={()=>select(c.id)}><span className="figma-avatar">{other(c)?.charAt(0)||"S"}</span><span className="figma-conversation-copy"><strong>{other(c)}</strong><small>{c.listingTitle}</small><span>{c.lastMessage?.startsWith("[Ảnh] ")?"Đã gửi một ảnh":c.lastMessage||"Bắt đầu trò chuyện"}</span></span>{Boolean(c.unreadCount)&&<span className="figma-unread">{c.unreadCount}</span>}</button>)}</div>
        <SafetyNote>Hẹn gặp ở nơi công cộng và kiểm tra món đồ trước khi thanh toán.</SafetyNote>
      </aside>
      <section className="figma-chat-room">{active?<>
        <header className="figma-chat-header"><button className="figma-chat-back figma-button" onClick={()=>setMobileOpen(false)} aria-label="Quay về hộp thư"><Icon name="back"/></button><span className="figma-avatar">{other(active)?.charAt(0)}</span><div><strong>{other(active)}</strong><small>{partnerOnline?"Đang trực tuyến":otherSchool(active)||"Thành viên SangTay"}</small></div><button className="figma-button" onClick={()=>onReport(active.id,other(active))} aria-label="Báo cáo cuộc trò chuyện"><Icon name="more"/></button></header>
        <Link href={"/listing/"+active.listingId} className="figma-chat-product"><img src={active.listingImage} alt={active.listingTitle}/><div><span className="figma-small">Đang trao đổi về</span><h3>{active.listingTitle}</h3><strong>{formatPrice(active.listingPrice)}</strong></div><Icon name="arrowUp"/></Link>
        <div className="figma-chat-messages" aria-label="Nội dung cuộc trò chuyện" aria-live="polite">
          <ReservationsPanel key={active.id} viewer={viewer} listingId={String(active.listingId)} sellerId={String(active.sellerId)} available={active.listingStatus==='Active'}/>
          {active.messages.length===0&&<EmptyState title="Một lời chào là khởi đầu tốt">Hỏi về tình trạng món đồ hoặc chọn một câu trả lời nhanh bên dưới.</EmptyState>}
          {active.messages.map(m=>{
            const mine=String(m.senderId)===pgUserId;
            const imagePath=m.content.startsWith("[Ảnh] ")?m.content.slice(6).trim():"";
            const safeImage=imagePath.startsWith("/api/conversations/"+active.id+"/attachments/")&&/^[\w/.-]+$/.test(imagePath);
            return <div className={"figma-message"+(mine?" mine":"")} key={m.id}><div className="figma-message-bubble">{safeImage?<a href={imagePath} target="_blank" rel="noreferrer"><img src={imagePath} alt="Ảnh được chia sẻ trong cuộc trò chuyện"/></a>:m.content.startsWith("📅 Đề xuất hẹn gặp")?<div className="figma-meeting-card"><strong>Đề xuất hẹn gặp</strong><p>{m.content.slice("📅 Đề xuất hẹn gặp".length).trim()}</p><MeetingMapLinks location={meetingLocation(m.content)}/>{!mine&&<button className="figma-button" onClick={()=>compose("Mình đồng ý với lịch hẹn: "+m.content.slice("📅 Đề xuất hẹn gặp".length).trim())}>Soạn xác nhận</button>}</div>:m.content}</div><small>{new Date(m.sentAt).toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"})}{mine?(m.isRead?" · Đã xem":" · Đã gửi"):""}</small></div>;
          })}
          {partnerTyping&&<p className="figma-small">{partnerTyping}</p>}<div ref={endRef}/>
        </div>
        <div className="figma-quick-replies">{["Món đồ còn không bạn?","Mình có thể xem thêm ảnh không?","Bạn tiện gặp ở đâu?"].map(text=><button key={text} onClick={()=>compose(text)}>{text}</button>)}</div>
        {notice&&<p className="figma-chat-notice" role="status">{notice}</p>}
        <form className="figma-chat-composer" onSubmit={onSend}><label className="figma-attachment" aria-label="Đính kèm ảnh" title="Đính kèm ảnh"><Icon name="attachment"/><input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={e=>{const file=e.target.files?.[0];if(file)void upload(file);e.target.value="";}}/></label><Link className="figma-attachment" aria-label="Xem lịch hẹn và giữ chỗ" href="/transactions"><Icon name="calendar"/></Link><input maxLength={5000} value={input} onChange={onInput} aria-label="Nhập tin nhắn" placeholder={uploading?"Đang tải ảnh...":"Nhắn một lời thân thiện..."}/><button className="figma-button primary" type="submit" disabled={!input.trim()||uploading} aria-label="Gửi tin nhắn"><Icon name="send"/><span>Gửi</span></button></form>
        <p className="figma-chat-connection">{connectionStatus==="connected"?"Đã kết nối trực tiếp":"Tin nhắn được đồng bộ mỗi 5 giây"} · Không chia sẻ mã OTP hoặc chuyển tiền đặt cọc.</p>
      </>:<EmptyState title="Chọn một cuộc trò chuyện">Những món đồ đáng yêu đang chờ bạn kết nối.</EmptyState>}</section>
    </div>}
  </section>;
}
