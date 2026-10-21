import {maxAdviceImageBytes} from './listing-advice-types';
// Decode and re-encode pixels locally: original files and EXIF metadata are not uploaded by this UI.
export async function advicePhoto(file:File,index:number,signal:AbortSignal){
  signal.throwIfAborted();const bitmap=await createImageBitmap(file);
  const canvas=document.createElement('canvas');
  try{
    const ratio=Math.min(1,1024/Math.max(bitmap.width,bitmap.height));
    canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));
    const context=canvas.getContext('2d');if(!context)throw new Error('Không chuẩn bị được ảnh góp ý.');
    context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height);
    const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('Không chuẩn bị được ảnh góp ý.')),'image/jpeg',0.8));
    signal.throwIfAborted();if(blob.size>maxAdviceImageBytes)throw new Error('Ảnh vẫn quá lớn để góp ý. Bạn thử chọn ảnh nhỏ hơn nhé.');
    return new File([blob],`anh-${index+1}.jpg`,{type:'image/jpeg'});
  }finally{bitmap.close();canvas.width=0;canvas.height=0;}
}
