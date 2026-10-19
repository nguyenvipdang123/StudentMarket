"use client";

import { useEffect, useId, useRef, useState } from "react";
import { maxProductImageBytes } from "@/lib/product-image-config";
import Icon from "./FigmaIcon";

type Props = {
  file: File | null;
  currentImage?: string;
  onChange: (file: File | null) => void;
  onError: (message: string) => void;
};

export default function ProductImagePicker({ file, currentImage, onChange, onError }: Props) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function choose(file: File | undefined) {
    if (!file) return;
    if ((file.type && !["image/jpeg", "image/png", "image/webp"].includes(file.type)) || file.size < 1 || file.size > maxProductImageBytes) {
      onError("Chọn ảnh JPG, PNG hoặc WebP nhỏ hơn 5 MB.");
      if (input.current) input.current.value = "";
      return;
    }
    setPreview(URL.createObjectURL(file));
    onChange(file);
    onError("");
  }

  function clear() {
    if (input.current) input.current.value = "";
    setPreview(null);
    onChange(null);
  }

  const shownImage = file ? preview : currentImage;
  return (
    <div className="form-field full product-image-picker">
      <label htmlFor={inputId}>Hình ảnh sản phẩm</label>
      <input ref={input} id={inputId} type="file" accept="image/jpeg,image/png,image/webp"
        className="product-image-file-input" onChange={event => choose(event.target.files?.[0])} />
      <div className="product-image-actions">
        <button type="button" className="product-image-pick-button" onClick={() => input.current?.click()}>
          Chọn ảnh từ thiết bị
        </button>
        {file && <button type="button" className="product-image-clear-button" onClick={clear}>Bỏ ảnh đã chọn</button>}
        <span>{file ? file.name : currentImage ? "Ảnh hiện tại" : "Chưa chọn ảnh"}</span>
      </div>
      <small>JPG, PNG hoặc WebP · tối đa 5 MB. {currentImage ? "Để trống để giữ ảnh hiện tại." : "Nếu không chọn ảnh, tin sẽ dùng ảnh minh họa."}</small>
      {shownImage && <div className="product-image-preview">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={shownImage} alt="Xem trước ảnh sản phẩm" />
      </div>}
    </div>
  );
}

export function ProductPhotosPicker({ files, onChange, onError }: { files: File[]; onChange: (files: File[]) => void; onError: (message: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [previews,setPreviews] = useState<string[]>([]);
  const [dragged,setDragged] = useState<number | null>(null);
  useEffect(()=>{const urls=files.map(file=>URL.createObjectURL(file));void Promise.resolve().then(()=>setPreviews(urls));return ()=>urls.forEach(URL.revokeObjectURL);},[files]);
  function choose(candidates: FileList | null) {
    if(!candidates) return;
    const added=Array.from(candidates);
    if(files.length+added.length>8) { onError("Chọn tối đa 8 ảnh."); return; }
    if(added.some(file=>!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size<1||file.size>maxProductImageBytes)){onError("Chọn ảnh JPG, PNG hoặc WebP nhỏ hơn 5 MB.");return;}
    onChange([...files,...added]);onError("");if(input.current) input.current.value="";
  }
  function move(from: number,to: number){const next=[...files];const [file]=next.splice(from,1);next.splice(to,0,file);onChange(next);}
  return <div className="figma-stack"><input ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp" hidden aria-label="Chọn ảnh sản phẩm" onChange={e=>choose(e.target.files)}/><div className="figma-upload" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();choose(e.dataTransfer.files);}}><Icon name="image" size={36}/><strong>Thả ảnh vào đây hoặc chọn ảnh</strong><small>JPG, PNG, WebP · Tối đa 5 MB / ảnh</small><button type="button" className="figma-button" disabled={files.length>=8} onClick={()=>input.current?.click()}><Icon name="upload"/>Chọn ảnh từ thiết bị</button></div><strong style={{fontSize:14}}>Ảnh đã chọn · {files.length} / 8</strong><div className="figma-upload-photos">{files.map((file,i)=><div key={`${file.name}-${file.size}-${i}`} className="figma-upload-photo" draggable onDragStart={()=>setDragged(i)} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(dragged!==null)move(dragged,i);setDragged(null);}}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {previews[i]&&<img src={previews[i]} alt={`Ảnh ${i+1} của món đồ`}/>}<div className="figma-row"><span aria-hidden="true"><Icon name="grip"/></span><button type="button" onClick={()=>move(i,0)} className="figma-badge">{i===0?"Ảnh bìa":"Đặt làm ảnh bìa"}</button><button type="button" aria-label={`Xóa ảnh ${i+1}`} onClick={()=>onChange(files.filter((_,n)=>n!==i))}><Icon name="trash"/></button></div><small className="figma-small">{file.name}</small></div>)}</div><small className="figma-small">Kéo ảnh để sắp xếp. Chọn “Đặt làm ảnh bìa” để ảnh đó xuất hiện đầu tiên.</small></div>;
}
