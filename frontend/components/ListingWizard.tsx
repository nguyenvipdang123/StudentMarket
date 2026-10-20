"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import Link from "@/components/TransitionLink";
import { useRouter } from "next/navigation";
import Navbar from "./Navbar";
import Footer from "./Footer";
import Icon from "./FigmaIcon";
import { ProductPhotosPicker } from "./ProductImagePicker";
import { PageIntro, SafetyNote, EmptyState } from "./FigmaStates";
import type { Viewer } from "@/lib/types";
import { listingDraft, type ListingDraft } from "@/lib/listing-draft";
import { formatPrice } from "@/lib/storage";
import LocationMap from "./LocationMap";
const initial: ListingDraft={title:"",description:"",category:"Học tập",condition:"Như mới",price:"",kind:"Sell",location:"Khuôn viên trường",step:1,files:[]};
const steps=["Ảnh","Thông tin","Giá & nơi","Xem lại"];
const guidance=["Chụp toàn bộ món đồ trong ánh sáng tự nhiên. Thêm góc cận để người mua nhìn thấy tình trạng.","Mô tả rõ tình trạng, phụ kiện và lý do sang tay để người mua hiểu hơn.","Chọn mức giá phù hợp và một địa điểm công cộng dễ hẹn gặp.","Kiểm tra lại thông tin và ảnh trước khi gửi tin để được duyệt."];
export default function ListingWizard(){
  const router=useRouter();
  const [viewer,setViewer]=useState<Viewer | null>(null),[loading,setLoading]=useState(true),[data,setData]=useState<ListingDraft>(initial);
  const [error,setError]=useState(""),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false),[created,setCreated]=useState(""),[dirty,setDirty]=useState(false),[cover,setCover]=useState("");
  const discard=useRef<HTMLDialogElement>(null);
  function change<K extends keyof ListingDraft>(key:K,value:ListingDraft[K]){setData(d=>({...d,[key]:value}));setDirty(true);setError("");}
  useEffect(()=>{let cancelled=false;async function load(){try{const r=await fetch("/api/auth/me");const result=await r.json();if(!cancelled){setViewer(result.user||null);if(result.user){try{const draft=await listingDraft(result.user.pgUserId || String(result.user.id),"read");if(draft&&!cancelled)setData({...initial,...draft,step:Math.min(4,Math.max(1,draft.step))});}catch{}}}}catch{if(!cancelled)setError("Không kiểm tra được tài khoản. Vui lòng thử lại.");}finally{if(!cancelled)setLoading(false);}}void load();return ()=>{cancelled=true;};},[]);
  useEffect(()=>{if(!data.files[0])return;const url=URL.createObjectURL(data.files[0]);void Promise.resolve().then(()=>setCover(url));return ()=>URL.revokeObjectURL(url);},[data.files]);
  useEffect(()=>{if(!dirty||created)return;const leave=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue="";};window.addEventListener("beforeunload",leave);return ()=>window.removeEventListener("beforeunload",leave);},[dirty,created]);
  const owner=viewer?.pgUserId || String(viewer?.id || "");
  const shownPrice=data.kind==="Gift"?"Tặng miễn phí":data.kind==="Exchange"?"Trao đổi":data.price?formatPrice(Number(data.price)):"Chưa đặt giá";
  async function saveDraft(exit=false){try{await listingDraft(owner,"write",data);setDirty(false);setNotice("Đã lưu bản nháp trên thiết bị này.");if(exit)router.push("/my-listings");}catch{setError("Không lưu được bản nháp trên thiết bị. Thông tin vẫn còn trong biểu mẫu.");}}
  function next(){
    if(data.step===2 && (data.title.trim().length<3||data.title.trim().length>200||data.description.trim().length<10||data.description.length>10000)){setError("Tên món đồ cần 3–200 ký tự, mô tả cần 10–10000 ký tự.");return;}
    if(data.step===3 && (data.location.trim().length<2||data.location.length>200||(data.kind==="Sell"&&(!data.price||!Number.isFinite(Number(data.price))||Number(data.price)<=0||Number(data.price)>9999999999)))){setError("Nhập giá bán lớn hơn 0 và địa điểm từ 2–200 ký tự.");return;}
    setError("");setData(d=>({...d,step:Math.min(4,d.step+1)}));
  }
  async function submit(){
    if(busy)return;setBusy(true);setError("");
    try{const form=new FormData();form.set("title",data.title.trim());form.set("description",(data.kind==="Gift"?"Tặng miễn phí. ":"")+data.description.trim());form.set("price",data.kind==="Sell"?data.price:"0");form.set("category",data.category);form.set("condition",data.condition);form.set("location",data.location.trim());data.files.forEach(file=>form.append("imageFiles",file));const response=await fetch("/api/products",{method:"POST",body:form});const result=await response.json();if(!response.ok)throw new Error(result.error||"Không đăng được tin lúc này.");setCreated(result.product.id);setDirty(false);await listingDraft(owner,"delete").catch(()=>{});}catch(e){setError(e instanceof Error?e.message:"Không đăng được tin lúc này.");}finally{setBusy(false);}
  }
  return <div className="site-shell"><Navbar/><main className="figma-screen">
    <PageIntro title="Sang tay món đồ của bạn">Đăng tin miễn phí, mô tả rõ ràng và kết nối với sinh viên quanh trường.</PageIntro>
    {loading?<p className="figma-small">Đang kiểm tra tài khoản…</p>:!viewer?<EmptyState title="Đăng nhập để đăng tin" action="Đăng nhập" href="/explore?auth=login">Dùng tài khoản sinh viên của bạn để đăng và quản lý món đồ.</EmptyState>:<>
    {!created&&<><div className="figma-post-progress" aria-label="Tiến trình đăng tin">{steps.map((label,i)=><button type="button" key={label} className={data.step===i+1?"active":data.step>i+1?"done":""} disabled={i+1>data.step} aria-current={data.step===i+1?"step":undefined} onClick={()=>setData(d=>({...d,step:i+1}))}>{i+1} &nbsp;{label}</button>)}</div><div className="figma-draft-context">{data.files[0]&&cover?<img src={cover} alt="Ảnh bìa bản nháp"/>:<Icon name="image" size={36}/>}<div><strong>{data.title||"Món đồ của bạn"}</strong><p className="figma-small">{shownPrice} · {data.condition} · {data.category}</p><small className="figma-small">{viewer.fullName} · {viewer.university} · Bản nháp</small></div></div></>}
    <div className="figma-post-workspace"><div>
      {created?<div className="figma-panel figma-stack"><Icon name="check" size={48}/><span className="figma-badge">Chờ duyệt</span><h2>Tin của bạn đã được gửi!</h2><p>Món đồ sẽ xuất hiện trên chợ sau khi được duyệt. Bạn có thể theo dõi trong Tin của tôi.</p><div className="figma-draft-context">{data.files[0]&&cover&&<img src={cover} alt={data.title}/>}<div><strong>{data.title}</strong><p>{shownPrice}</p></div></div><Link className="figma-button primary" href="/my-listings">Xem Tin của tôi <Icon name="arrowWhite"/></Link><Link className="figma-button" href={`/listing/${created}`}>Xem lại tin vừa đăng</Link></div>:<>
      <form className="figma-panel figma-stack" onSubmit={e=>{e.preventDefault();if(data.step===4)void submit();else next();}} id="posting-form">
        <span className="figma-badge">BƯỚC {data.step} / 4</span><h2>{["Thêm ảnh món đồ","Kể một chút về món đồ","Giá phù hợp, hẹn gần bạn","Món đồ đã sẵn sàng sang tay"][data.step-1]}</h2>
        {data.step===1&&<><p>Ảnh rõ giúp người mua dễ hiểu món đồ. Thêm tối đa 8 ảnh, chọn ảnh bìa và sắp xếp theo thứ tự.</p><ProductPhotosPicker files={data.files} onChange={files=>change("files",files)} onError={setError}/><SafetyNote>Chỉ đăng ảnh món đồ thật của bạn, không dùng ảnh chứa thông tin cá nhân.</SafetyNote></>}
        {data.step===2&&<div className="figma-form-grid"><label className="figma-field full">Tên món đồ *<input value={data.title} onChange={e=>change("title",e.target.value)} maxLength={200} placeholder="Ví dụ: Đèn bàn học màu kem"/></label><label className="figma-field">Danh mục *<select value={data.category} onChange={e=>change("category",e.target.value)}>{["Học tập","Công nghệ","Nội thất","Thời trang","Khác"].map(c=><option key={c}>{c}</option>)}</select></label><label className="figma-field">Tình trạng *<select value={data.condition} onChange={e=>change("condition",e.target.value)}>{["Mới 100%","Như mới","Tốt","Đã qua sử dụng"].map(c=><option key={c}>{c}</option>)}</select></label><label className="figma-field full">Mô tả món đồ *<textarea rows={6} value={data.description} maxLength={10000} onChange={e=>change("description",e.target.value)} placeholder="Mô tả tình trạng, phụ kiện đi kèm và lý do sang tay…"/><small>{data.description.length} / 10000 ký tự. Mô tả tối thiểu 10 ký tự.</small></label></div>}
        {data.step===3&&<><div className="figma-choices" role="group" aria-label="Hình thức giao dịch">{([{id:"Sell",label:"Bán lại",icon:"money"},{id:"Exchange",label:"Trao đổi",icon:"exchange"},{id:"Gift",label:"Tặng miễn phí",icon:"gift"}] as const).map(k=><button key={k.id} type="button" className={data.kind===k.id?"active":""} aria-pressed={data.kind===k.id} onClick={()=>change("kind",k.id)}><Icon name={k.icon}/>{k.label}</button>)}</div>{data.kind==="Sell"&&<label className="figma-field">Giá mong muốn (đ) *<input type="number" min="1" max="9999999999" value={data.price} onChange={e=>change("price",e.target.value)} placeholder="120000"/></label>}<label className="figma-field">Trường đại học<input value={viewer.university} readOnly/></label><label className="figma-field">Khu vực hẹn gặp *<input value={data.location} maxLength={200} onChange={e=>change("location",e.target.value)} placeholder="Sân thư viện, KTX, khuôn viên trường…"/></label><LocationMap location={data.location} school={viewer.university} preview/><SafetyNote>Ưu tiên địa điểm công cộng, có người qua lại. Thỏa thuận thời gian và kiểm tra đồ trước khi trao đổi.</SafetyNote></>}
        {data.step===4&&<>{data.files[0]&&cover&&<img src={cover} alt={data.title} style={{width:"100%",height:280,objectFit:"cover",borderRadius:16}}/>}<div className="figma-row"><span className="figma-badge peach">{data.kind==="Sell"?"Bán lại":data.kind==="Gift"?"Tặng miễn phí":"Trao đổi"}</span><span className="figma-badge">{data.condition}</span></div><h2>{data.title}</h2><strong className="figma-detail-price">{shownPrice}</strong><p style={{whiteSpace:"pre-line"}}>{data.description}</p><p>{data.category} · {viewer.university} · {data.location}</p><SafetyNote>Tin đăng được kiểm tra trước khi xuất hiện trên chợ. Bạn có thể chỉnh sửa thông tin trong Tin của tôi.</SafetyNote></>}
        {error&&<div className="figma-error" role="alert">{error}</div>}
      </form><div className="figma-post-actions"><button className="figma-button" disabled={busy} onClick={()=>{if(data.step>1)setData(d=>({...d,step:d.step-1}));else if(dirty)discard.current?.showModal();else router.push("/my-listings");}}><Icon name="back"/>Quay lại</button><button className="figma-button" disabled={busy} onClick={()=>void saveDraft()}>Lưu bản nháp</button><button className="figma-button primary" type="submit" form="posting-form" disabled={busy}>{busy?"Đang gửi tin…":data.step===4?"Gửi tin đăng":"Tiếp tục"}<Icon name="arrowWhite"/></button></div>
      </>}
    </div><aside className="figma-post-help"><div className="figma-panel peach"><img src="/figma/27-64744-imgPostingIllustration.png" alt="Góc bàn học với đèn và sách"/><h2>Đăng rõ, sang tay dễ.</h2><p>{guidance[data.step-1]}</p></div><p className="figma-small" style={{marginTop:24}}>Đăng bởi {viewer.fullName}<br/>{viewer.university}</p></aside></div>
    </>}
    <dialog className="figma-photo-dialog" ref={discard} aria-label="Bỏ bản nháp"><h2>Rời khỏi bản nháp?</h2><p>Bạn có thể lưu lại để tiếp tục đăng tin sau.</p><div className="figma-tabs"><button onClick={()=>discard.current?.close()}>Tiếp tục chỉnh sửa</button><button onClick={()=>void saveDraft(true)}>Lưu và rời đi</button><button onClick={()=>{void listingDraft(owner,"delete").finally(()=>{setDirty(false);router.push("/my-listings");});}}>Bỏ bản nháp</button></div></dialog>
    {notice&&<div className="figma-toast" role="status" onClick={()=>setNotice("")}>{notice}</div>}
  </main><Footer/></div>;
}
