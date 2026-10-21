import {createServer} from 'node:http';
export async function startMockListingAdvice(){
  const calls=[];
  const server=createServer(async(request,response)=>{
    if(request.method==='GET'){response.setHeader('Content-Type','application/json');response.end(JSON.stringify({calls}));return;}
    try{
      let raw='';for await(const chunk of request)raw+=chunk;const body=JSON.parse(raw),parts=body.contents[0].parts,input=JSON.parse(parts[0].text);
      calls.push({input,imageCount:parts.filter(part=>part.inlineData).length,mimeTypes:parts.filter(part=>part.inlineData).map(part=>part.inlineData.mimeType)});
      if(input.title.includes('UPSTREAM_FAIL')){response.writeHead(503);response.end('{}');return;}
      if(input.title.includes('UPSTREAM_ONCE')&&calls.filter(call=>call.input.title===input.title).length===1){response.writeHead(503);response.end('{}');return;}
      await new Promise(resolve=>setTimeout(resolve,input.title.includes('CHẬM')?1600:120));
      const advice={summary:'Có vài điểm giúp tin rõ ràng hơn.',suggestedTitle:'Đèn bàn học cũ còn hoạt động tốt',imagesChecked:input.title.includes('INVALID_REPLY')?99:input.imageCount,issues:[
        ...(input.imageCount?[{field:'photos',photoIndex:1,message:'Ảnh 1 thiếu sáng, khó thấy món đồ.',suggestion:'Chụp lại gần cửa sổ hoặc bật thêm đèn.'}]:[{field:'photos',photoIndex:0,message:'Tin chưa có ảnh món đồ.',suggestion:'Thêm ảnh toàn cảnh món đồ thật.'}]),
        {field:'description',photoIndex:0,message:'Mô tả có thể rõ hơn.',suggestion:'Bổ sung tình trạng và phụ kiện bạn thực sự biết.'},
      ]};
      response.setHeader('Content-Type','application/json');response.end(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(advice)}]}}]}));
    }catch{response.writeHead(500);response.end('{}');}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  return {origin:'http://127.0.0.1:'+server.address().port,close:()=>new Promise(resolve=>server.close(resolve))};
}
