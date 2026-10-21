"use client";
import { useEffect,useRef,useState } from 'react';
import { comparisonDuration,promotionDate,type PromotionPerformance,type PromotionSummary,type PromotionMetrics } from '@/lib/promotion-analytics-types';
import styles from './PromotionPerformanceDialog.module.css';

const labels:Record<string,string>={ACTIVE:'Đang đẩy tin',EXPIRED:'Đã hết hạn',CANCELLED:'Đã dừng',PENDING:'Chưa kích hoạt'};
const metrics:{key:keyof PromotionMetrics;label:string}[]=[{key:'views',label:'Lượt xem'},{key:'favorites',label:'Người lưu tin'},{key:'contacts',label:'Người nhắn tin'}];
export default function PromotionPerformanceDialog({listingId,title,onClose}:{listingId:string;title:string;onClose:()=>void}) {
  const dialog=useRef<HTMLDialogElement>(null);
  const [promotions,setPromotions]=useState<PromotionSummary[]>([]),[selected,setSelected]=useState('');
  const [data,setData]=useState<PromotionPerformance|null>(null);
  const [listError,setListError]=useState(''),[error,setError]=useState('');
  const [loading,setLoading]=useState(true),[listLoading,setListLoading]=useState(true);
  const [refresh,setRefresh]=useState(0);
  useEffect(()=>{
    const element=dialog.current,opener=document.activeElement;
    element?.showModal();const previous=document.body.style.overflow;document.body.style.overflow='hidden';
    return ()=>{element?.close();document.body.style.overflow=previous;if(opener instanceof HTMLElement&&opener.isConnected)opener.focus();};
  },[]);
  useEffect(()=>{
    const controller=new AbortController();
    void fetch('/api/my-promotions?listingId='+encodeURIComponent(listingId),{cache:'no-store',signal:controller.signal})
      .then(async response=>{const result=await response.json();if(!response.ok)throw new Error(result.error||'Không tải được lịch sử gói.');return result.promotions as PromotionSummary[];})
      .then(rows=>{if(!controller.signal.aborted){setPromotions(rows);setListError('');setSelected(current=>rows.some(row=>row.id===current)?current:rows[0]?.id||'');}})
      .catch(e=>{if(!controller.signal.aborted)setListError(e instanceof Error?e.message:'Không tải được lịch sử gói.');})
      .finally(()=>{if(!controller.signal.aborted)setListLoading(false);});
    return ()=>controller.abort();
  },[listingId,refresh]);
  useEffect(()=>{
    if(!selected)return;
    const controller=new AbortController();
    void Promise.resolve().then(()=>{if(!controller.signal.aborted){setLoading(true);setError('');}});
    void fetch('/api/my-promotions/'+selected+'/analytics',{cache:'no-store',signal:controller.signal})
      .then(async response=>{const result=await response.json();if(!response.ok)throw new Error(result.error||'Chưa tải được thống kê.');return result as PromotionPerformance;})
      .then(result=>{if(!controller.signal.aborted)setData(result);})
      .catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Chưa tải được thống kê.');})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[selected,refresh]);
  useEffect(()=>{
    const update=()=>{if(document.visibilityState==='visible')setRefresh(value=>value+1);};
    const timer=data?.status==='ACTIVE'?setInterval(update,30000):null;
    window.addEventListener('focus',update);
    return ()=>{if(timer)clearInterval(timer);window.removeEventListener('focus',update);};
  },[data?.status]);
  const current=data?.promotionId===selected?data:null;
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="promotion-performance-title" onCancel={event=>{event.preventDefault();onClose();}} onClick={event=>{if(event.target===dialog.current)onClose();}}>
    <div className={styles.content}>
      <header className={styles.header}><div><span className={styles.kicker}>GÓC THỐNG KÊ CỦA NGƯỜI BÁN</span><h2 id="promotion-performance-title">Hiệu quả đẩy tin</h2><p>{title}</p></div><button className="figma-button" aria-label="Đóng thống kê" onClick={onClose}>✕</button></header>
      {listError?<div className={styles.error} role="alert">{listError}<button className="figma-button" onClick={()=>setRefresh(value=>value+1)}>Thử lại</button></div>:listLoading?<p role="status">Đang tải lịch sử gói…</p>:!promotions.length?<p>Chưa có gói đẩy tin đã kích hoạt cho tin này.</p>:<>
        <div className={styles.toolbar}><label>Gói đã mua<select value={selected} onChange={event=>setSelected(event.target.value)}>{promotions.map(p=><option key={p.id} value={p.id}>{p.packageName} · {promotionDate(p.startAt)} · {labels[p.status]||p.status}</option>)}</select></label><button className="figma-button" disabled={loading} onClick={()=>setRefresh(value=>value+1)}>Làm mới thống kê</button></div>
        {error?<div className={styles.error} role="alert">{error}<button className="figma-button" onClick={()=>setRefresh(value=>value+1)}>Thử lại</button></div>:loading?<p role="status">Đang tải số liệu thực tế…</p>:current&&<>
          <section className={styles.summary} aria-label="Thời hạn gói đẩy tin"><div className={styles.header}><strong>{current.packageName}</strong><span className={styles.badge}>{labels[current.status]||current.status}</span></div><dl><div><dt>Bắt đầu</dt><dd>{promotionDate(current.startAt)}</dd></div><div><dt>Hết hạn lúc</dt><dd>{promotionDate(current.endAt)}</dd></div></dl><small>Tất cả thời gian theo giờ Việt Nam.</small></section>
          <p className={styles.description}>So sánh <strong>hai khoảng dài bằng nhau: {comparisonDuration(current.durationSeconds)}</strong>. Gói đang chạy được tính đến lúc cập nhật; gói đã hết hạn được chốt tại thời điểm kết thúc.</p>
          <div className={styles.periods}><div><strong>Trước khi đẩy</strong><small>{promotionDate(current.before.from)} → {promotionDate(current.before.to)}</small></div><div><strong>Trong thời gian đẩy</strong><small>{promotionDate(current.during.from)} → {promotionDate(current.during.to)}</small></div></div>
          <div className={styles.tableWrap}><table aria-label="So sánh hiệu quả trước và trong thời gian đẩy"><thead><tr><th>Chỉ số</th><th>Trước đẩy</th><th>Trong đẩy</th><th>Thay đổi</th></tr></thead><tbody>{metrics.map(({key,label})=>{
            const delta=current.change[key];const partial=current.coverage.shortHistory||current.coverage.previousPromotion||(key==='favorites'&&current.coverage.favoritesPartial);
            return <tr key={key}><th scope="row">{label}</th><td>{current.before.metrics[key].toLocaleString('vi-VN')}</td><td><strong>{current.during.metrics[key].toLocaleString('vi-VN')}</strong></td><td>{partial?<small>Chưa đủ dữ liệu so sánh</small>:<><span>{delta.difference>0?'+':''}{delta.difference.toLocaleString('vi-VN')}</span><small>{delta.percent===null?'Chưa có nền tính %':`${delta.percent>0?'+':''}${delta.percent.toLocaleString('vi-VN')}%`}</small></>}</td></tr>;
          })}</tbody></table></div>
          {(current.coverage.shortHistory||current.coverage.previousPromotion||current.coverage.favoritesPartial)&&<div className={styles.warning} role="note">{current.coverage.shortHistory&&<p>Tin mới đăng, chưa có đủ lịch sử cho khoảng trước đẩy.</p>}{current.coverage.previousPromotion&&<p>Khoảng trước đẩy có một gói đẩy tin khác; không dùng khoảng này để tính tỷ lệ thay đổi.</p>}{current.coverage.favoritesPartial&&<p>Lịch sử lưu tin trước {promotionDate(current.coverage.favoritesTrackingSince)} có thể chưa đầy đủ vì những lượt lưu đã bị bỏ trước khi bật theo dõi không khôi phục được.</p>}</div>}
          <details className={styles.definitions}><summary>Các chỉ số được tính thế nào?</summary><ul><li>Lượt xem: sự kiện mở tin đã được ghi nhận, bỏ lượt xem của chủ tin; xem lặp trong 30 giây được gộp.</li><li>Người lưu tin: số người lưu khác nhau trong từng khoảng. Bỏ lưu không xóa lịch sử; lưu nhiều lần trong một khoảng chỉ tính một người.</li><li>Người nhắn tin: số người mua khác nhau thực sự gửi tin trong từng khoảng, không tính người bán trả lời hoặc chỉ mở hộp chat.</li><li>Chỉ tính dữ liệu có thời điểm ghi nhận. Số tổng cũ không được chia ngược vào từng gói. Chênh lệch không chứng minh gói đẩy tin là nguyên nhân.</li></ul></details>
          <p className={styles.updated}>Cập nhật {promotionDate(current.asOf)} · Tự làm mới mỗi 30 giây khi gói đang chạy.</p>
        </>}
      </>}
    </div>
  </dialog>;
}
