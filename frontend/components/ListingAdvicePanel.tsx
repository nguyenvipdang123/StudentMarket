"use client";
import {useEffect,useRef,useState} from 'react';
import type {ListingDraft} from '@/lib/listing-draft';
import {adviceFieldLabels,type AdviceField,type ListingAdvice} from '@/lib/listing-advice-types';
import {advicePhoto} from '@/lib/listing-advice-photos';
import styles from './ListingAdvicePanel.module.css';

export default function ListingAdvicePanel({draft,onEdit,onApplyTitle,disabled=false}:{draft:ListingDraft;onEdit:(field:AdviceField)=>void;onApplyTitle:(title:string)=>void;disabled?:boolean}){
  const [result,setResult]=useState<{advice:ListingAdvice;key:string;files:File[]}|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const request=useRef<AbortController|null>(null);
  useEffect(()=>()=>request.current?.abort(),[]);
  const key=JSON.stringify([draft.title,draft.description,draft.category,draft.condition,draft.kind,draft.price,draft.location]);
  const stale=Boolean(result&&(result.key!==key||draft.files.length!==result.files.length||draft.files.some((file,index)=>file!==result.files[index])));
  async function analyse(){
    request.current?.abort();const controller=new AbortController();request.current=controller;setBusy(true);setError('');
    const snapshot={key,files:[...draft.files]};
    try{
      const form=new FormData();for(const field of ['title','description','category','condition','kind','price','location'] as const)form.set(field,draft[field]);
      for(const [index,file] of snapshot.files.entries())form.append('imageFiles',await advicePhoto(file,index,controller.signal));
      const response=await fetch('/api/listings/advice',{method:'POST',body:form,signal:controller.signal});const data=await response.json();
      if(!response.ok)throw new Error(data.error||'Chưa nhận được góp ý. Bạn thử lại sau nhé.');
      if(!controller.signal.aborted)setResult({advice:data.advice,...snapshot});
    }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Chưa chuẩn bị được ảnh hoặc nhận được góp ý. Bạn thử lại sau nhé.');}
    finally{if(request.current===controller){request.current=null;setBusy(false);}}
  }
  return <section className={styles.panel} aria-label="AI góp ý tin đăng">
    <div className={styles.header}><div><span className={styles.kicker}>ĐĂNG RÕ, SANG TAY DỄ</span><h2>AI góp ý tin đăng</h2></div><span className={styles.optional}>Tùy chọn</span></div>
    <p>Nhận gợi ý về ánh sáng ảnh, tiêu đề và thông tin nên bổ sung. Bạn chọn điều cần sửa trước khi gửi tin.</p>
    <small className={styles.privacy}>Khi bấm góp ý, nội dung tin và ảnh xem trước đã thu nhỏ được gửi tới Gemini. Góp ý tốt nhất sau khi bạn điền thông tin và chọn ảnh.</small>
    <div className={styles.actions}><button type="button" className="figma-button" disabled={disabled||busy||(!draft.title.trim()&&!draft.description.trim()&&!draft.files.length)} onClick={()=>void analyse()}>{busy?<><span className={styles.spinner} aria-hidden="true"/>Đang xem tin & ảnh…</>:result?'Nhờ AI góp ý lại':'Nhờ AI góp ý'}</button>{busy&&<button type="button" className="figma-button" onClick={()=>{request.current?.abort();request.current=null;setBusy(false);}}>Dừng góp ý</button>}</div>
    {busy&&<p className={styles.wait} role="status">Đang chuẩn bị ảnh và nhận góp ý, thường mất vài giây.</p>}
    {error&&<p className={styles.error} role="alert">{error}</p>}
    {result&&<div className={styles.result}>
      {stale&&<p className={styles.stale} role="status">Tin hoặc ảnh đã thay đổi. Góp ý bên dưới thuộc bản trước; bạn có thể nhờ AI xem lại.</p>}
      <p className={styles.summary}>{result.advice.summary}</p><small>{result.advice.imagesChecked?`Đã xem ${result.advice.imagesChecked} ảnh theo thứ tự hiện tại của bản đã gửi.`:'Góp ý nội dung; chưa có ảnh để xem.'}</small>
      {!!result.advice.issues.length&&<ul className={styles.issues}>{result.advice.issues.map((issue,index)=><li key={index}>
        <div className={styles.issueHeading}><strong>{issue.photoIndex?`Ảnh ${issue.photoIndex}`:adviceFieldLabels[issue.field]}</strong><button type="button" className={styles.edit} disabled={disabled||busy||stale} onClick={()=>onEdit(issue.field)}>Sửa mục này →</button></div><p>{issue.message}</p><small>{issue.suggestion}</small>
      </li>)}</ul>}
      {result.advice.suggestedTitle&&result.advice.suggestedTitle!==draft.title.trim()&&<div className={styles.titleSuggestion}><strong>Tiêu đề gợi ý</strong><p>{result.advice.suggestedTitle}</p><button type="button" className="figma-button" disabled={disabled||busy||stale} onClick={()=>onApplyTitle(result.advice.suggestedTitle)}>Dùng tiêu đề này</button></div>}
      <p className={styles.footnote}>Góp ý AI chỉ để tham khảo. Bạn kiểm tra lại thông tin và chọn chỉnh sửa phù hợp; tin được kiểm duyệt sau khi gửi.</p>
    </div>}
  </section>;
}
