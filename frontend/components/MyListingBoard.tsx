/* Native images preserve Figma asset geometry. */
/* eslint-disable @next/next/no-img-element */
import Link from "@/components/TransitionLink";
import Icon from "./FigmaIcon";
import { CardSkeletons, EmptyState, PageIntro, SafetyNote } from "./FigmaStates";
import { formatPrice } from "@/lib/storage";
import type { Viewer } from "@/lib/types";

export type OwnedListing = {
  hasPromotions?:boolean;
  id:string; title:string; price:number; status:string; moderationStatus:"PENDING"|"APPROVED"|"REJECTED"; rejectionReason?:string; condition:string; location:string; views:number; likes:number; chats:number; image:string; description:string; createdAt:string;
  promotion?:{id:string; name:string; priority:number; badge:string; startAt?:string|null;endAt?:string|null}|null;
};
export type OwnedFilter = "All"|"Active"|"Promoted"|"Sold"|"Hidden"|"Pending"|"Rejected";
export function matchesOwned(item:OwnedListing,key:OwnedFilter) {
  return key==="All" || (key==="Pending"?item.moderationStatus==="PENDING":key==="Rejected"?item.moderationStatus==="REJECTED":key==="Promoted"?Boolean(item.promotion):key==="Active"?item.status==="Active"&&item.moderationStatus==="APPROVED":item.status===key);
}
export default function MyListingBoard({viewer,listings,loading,error,filter,onFilter,onRetry,onSold,onPerformance,remaining}:{viewer:Viewer|null;listings:OwnedListing[];loading:boolean;error:string;filter:OwnedFilter;onFilter:(key:OwnedFilter)=>void;onRetry:()=>void;onSold:(item:OwnedListing)=>void;onPerformance:(item:OwnedListing)=>void;remaining:(date?:string|null)=>string}) {
  return <section className="figma-screen">
    <div className="figma-row" style={{justifyContent:"space-between",flexWrap:"wrap"}}><PageIntro title="Tin đăng của tôi">Một nơi để chăm chút những món đồ và theo dõi hành trình sang tay.</PageIntro><Link href="/create-listing" className="figma-button primary"><Icon name="plus"/>Đăng tin mới</Link></div>
    <div className="figma-panel figma-owned-account"><span className="figma-avatar">{viewer?.fullName.charAt(0)}</span><div><strong>{viewer?.fullName}</strong><small>{viewer?.university}</small></div><span className="figma-badge">{listings.length} tin đăng</span></div>
    <div className="figma-tabs" role="tablist" aria-label="Trạng thái tin đăng">{(["Active","Sold","Pending","Rejected","Promoted","Hidden","All"] as const).map(key=><button key={key} role="tab" aria-selected={key===filter} className={key===filter?"active":""} onClick={()=>onFilter(key)}>{{Active:"Đang hiển thị",Sold:"Đã bán",Pending:"Chờ duyệt",Rejected:"Bị từ chối",Promoted:"Đang đẩy",Hidden:"Đã ẩn",All:"Tất cả"}[key]} ({listings.filter(i=>matchesOwned(i,key)).length})</button>)}</div>
    <div className="figma-owned-layout"><div>
      {loading?<CardSkeletons count={2}/>:error?<EmptyState title="Chưa tải được tin đăng" action="Thử lại" onAction={onRetry}>{error}</EmptyState>:listings.filter(i=>matchesOwned(i,filter)).length===0?<EmptyState title="Chưa có tin đăng trong mục này" action="Đăng món đồ đầu tiên" href="/create-listing">Món đồ bạn không còn sử dụng có thể đang là thứ một bạn sinh viên khác cần.</EmptyState>:listings.filter(i=>matchesOwned(i,filter)).map(item=><article key={item.id} className="figma-owned-card">
        <div className="figma-owned-facts"><img src={item.image} alt={item.title}/><div style={{minWidth:0}}><span className="figma-badge">{item.moderationStatus==="PENDING"?"Chờ duyệt":item.moderationStatus==="REJECTED"?"Bị từ chối":item.status==="Sold"?"Đã bán":item.status==="Hidden"?"Đã ẩn":"Đang hiển thị"}</span>
          {item.promotion&&<span className="figma-badge">{item.promotion.badge} · {remaining(item.promotion.endAt)}</span>}
          <h3>{item.title}</h3><strong className="price">{item.price===0&&item.description.startsWith("Tặng miễn phí.")?"Tặng miễn phí":formatPrice(item.price)}</strong><p className="figma-small">{item.condition} · {item.location} · {new Date(item.createdAt).toLocaleDateString("vi-VN")}</p><div className="figma-row figma-small"><span>{item.views||0} lượt xem</span><span>{item.likes||0} lượt lưu</span><span>{item.chats||0} liên hệ</span></div>
        </div></div>
        {item.moderationStatus==="REJECTED"&&<p className="figma-error" role="status"><strong>Lý do từ chối:</strong> {item.rejectionReason||"Vui lòng chỉnh sửa thông tin tin đăng và gửi lại để được duyệt."}</p>}
        {item.moderationStatus==="PENDING"&&<SafetyNote>Tin đang chờ duyệt. Bạn vẫn có thể chỉnh sửa nội dung trước khi tin được công khai.</SafetyNote>}
        <div className="figma-owned-actions">
          {item.status!=="Sold"&&<Link className="figma-button" href={"/my-listings/"+item.id+"/edit"}><Icon name="pencil"/>Sửa tin</Link>}
          <Link className="figma-button" href={"/listing/"+item.id}><Icon name="eye"/>Xem tin</Link>
          {item.status==="Active"&&item.moderationStatus==="APPROVED"&&<button className="figma-button primary" onClick={()=>onSold(item)}><Icon name="check"/>Đánh dấu đã bán</button>}
          {(item.promotion||item.hasPromotions)&&<button className="figma-button" onClick={()=>onPerformance(item)}>Xem hiệu quả</button>}
          {!item.promotion&&item.moderationStatus==="APPROVED"&&item.status==="Active"&&<Link className="figma-button" href={"/my-listings/"+item.id+"/promote"}><Icon name="arrowUp"/>Đẩy tin</Link>}
        </div>
      </article>)}
    </div><aside><div className="figma-panel peach"><h2>Góc nhỏ của bạn</h2><p><strong>{listings.filter(i=>i.status==="Sold").length}</strong> món đồ đã sang tay<br/><strong>{listings.filter(i=>i.moderationStatus==="PENDING").length}</strong> tin đang chờ duyệt<br/><strong>{listings.reduce((n,i)=>n+(i.views||0),0)}</strong> lượt xem tin</p><SafetyNote>Ảnh rõ nét, mô tả trung thực và phản hồi nhanh giúp món đồ tìm được chủ mới.</SafetyNote><Link href="/messages" className="figma-button">Mở hộp thư<Icon name="chat"/></Link></div></aside></div>
  </section>;
}
