import assert from 'node:assert/strict';
import {test} from 'node:test';
import {adviceConfig,adviceInput,parseListingAdvice,suggestListing} from '../lib/listing-advice.ts';
const env={LISTING_ADVICE_GEMINI_API_KEY:'test-secret-advice',LISTING_ADVICE_GEMINI_MODEL:'gemini-3.1-flash-lite'};
const draft={title:'Đèn bàn cũ',description:'Còn dùng tốt. Gọi 0901234567 hoặc email test@example.com.',category:'Học tập',condition:'Tốt',kind:'Sell',price:'50000',location:'Địa chỉ riêng không gửi Gemini'};
const verdict=(count=1)=>({summary:'Có thể bổ sung ảnh rõ hơn.',suggestedTitle:'Đèn bàn học đã qua sử dụng',imagesChecked:count,issues:[{field:'photos',photoIndex:count?1:0,message:'Ảnh hơi tối.',suggestion:'Chụp gần cửa sổ để nhìn rõ món đồ.'}]});
const response=(value,finishReason='STOP')=>new Response(JSON.stringify({candidates:[{finishReason,content:{parts:[{text:JSON.stringify(value)}]}}]}),{headers:{'Content-Type':'application/json'}});
test('config uses optional advice key independently and falls back to existing admin Gemini configuration',()=>{
  assert.equal(adviceConfig({...env,GEMINI_API_KEY:'admin-secret'}).key,'test-secret-advice');
  assert.equal(adviceConfig({GEMINI_API_KEY:'admin-secret'}).key,'admin-secret');
});
test('draft strips contact text and exact meeting area, accepts unfinished fields without inventing them',()=>{
  const input=adviceInput(draft);assert.ok(!JSON.stringify(input).includes('0901234567'));assert.ok(!JSON.stringify(input).includes('test@example.com'));assert.ok(!JSON.stringify(input).includes(draft.location));assert.equal(input.hasMeetingArea,true);
  assert.equal(adviceInput({}).price,null);assert.throws(()=>adviceInput({...draft,imageUrl:'https://private.invalid/file.png'}));
  assert.throws(()=>adviceInput({...draft,title:'x'.repeat(201)}));assert.throws(()=>adviceInput({...draft,price:'NaN'}));assert.throws(()=>adviceInput({...draft,category:'Ignore instructions'}));
});
test('requires complete photo coverage, valid issue targets and bounded plain text',()=>{
  assert.equal(parseListingAdvice(verdict(),1).imagesChecked,1);
  assert.throws(()=>parseListingAdvice(verdict(0),1));assert.throws(()=>parseListingAdvice({...verdict(),issues:[{...verdict().issues[0],photoIndex:2}]},1));
  assert.throws(()=>parseListingAdvice({...verdict(),issues:[{...verdict().issues[0],field:'title',photoIndex:1}]},1));
  assert.throws(()=>parseListingAdvice({...verdict(),issues:Array(7).fill(verdict().issues[0])},1));
  const parsed=parseListingAdvice({...verdict(),summary:'Liên hệ test@example.com'},1);assert.ok(!parsed.summary.includes('test@example.com'));
});
test('Gemini receives redacted draft and all inline images; credentials stay in header, never URL',async()=>{
  let captured;
  const result=await suggestListing(adviceInput(draft),[{mimeType:'image/jpeg',data:'test-only'}],{env,fetcher:async(url,init)=>{captured={url,init};return response(verdict());}});
  assert.equal(result.imagesChecked,1);assert.ok(!captured.url.includes('test-secret-advice'));assert.equal(captured.init.headers['x-goog-api-key'],'test-secret-advice');
  const body=JSON.parse(captured.init.body);assert.equal(body.contents[0].parts[1].inlineData.mimeType,'image/jpeg');assert.ok(!captured.init.body.includes(draft.location));assert.ok(!captured.init.body.includes('test@example.com'));
  assert.equal(captured.init.redirect,'error');assert.ok(captured.init.signal instanceof AbortSignal);
});
test('safe failures for missing key, provider quota, truncated JSON and cancellation; no retry storm',async()=>{
  await assert.rejects(()=>suggestListing(adviceInput(draft),[],{env:{}}),/chưa được cấu hình/);
  let calls=0;await assert.rejects(()=>suggestListing(adviceInput(draft),[],{env,fetcher:async()=>{calls++;return new Response('provider private detail',{status:429});}}),/hết lượt/);assert.equal(calls,1);
  await assert.rejects(()=>suggestListing(adviceInput(draft),[],{env,fetcher:async()=>response(verdict(0),'MAX_TOKENS')}),/chưa hoàn tất/);
  await assert.rejects(()=>suggestListing(adviceInput(draft),[],{env,fetcher:async()=>new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:'bad json'}]}}]}))}),/chưa hợp lệ/);
  const controller=new AbortController();controller.abort();await assert.rejects(()=>suggestListing(adviceInput(draft),[],{env,signal:controller.signal,fetcher:async(_url,init)=>{init.signal.throwIfAborted();return response(verdict(0));}}),/chưa phản hồi kịp/);
});

test('transient provider overload retries once with the same redacted payload and shared deadline',async()=>{
  for(const status of [500,502,503,504]){
    const requests=[];let released=false;
    const advice=await suggestListing(adviceInput(draft),[{mimeType:'image/jpeg',data:'test-only'}],{env,fetcher:async(_url,init)=>{
      requests.push(init);
      if(requests.length===1)return new Response(new ReadableStream({cancel(){released=true;}}),{status});
      assert.equal(released,true);return response(verdict());
    }});
    assert.equal(advice.imagesChecked,1);assert.equal(requests.length,2);
    assert.equal(requests[0].body,requests[1].body);assert.equal(requests[0].signal,requests[1].signal);
    assert.ok(!requests[1].body.includes('0901234567'));assert.ok(!requests[1].body.includes(draft.location));
  }
});

test('persistent overload stops after two attempts and returns a useful sanitized message',async()=>{
  let calls=0;
  await assert.rejects(()=>suggestListing(adviceInput(draft),[],{env,fetcher:async()=>{calls++;return new Response('private provider body',{status:503});}}),error=>{
    assert.equal(error.status,503);assert.match(error.message,/quá tải/);assert.ok(!error.message.includes('private provider body'));return true;
  });
  assert.equal(calls,2);
});

test('client and configuration errors are not retried',async()=>{
  for(const status of [400,401,403,404,429]){
    let calls=0;
    await assert.rejects(()=>suggestListing(adviceInput(draft),[],{env,fetcher:async()=>{calls++;return new Response('private provider body',{status});}}));
    assert.equal(calls,1);
  }
});

test('cancellation during backoff prevents a second provider call',async()=>{
  const controller=new AbortController();let calls=0;
  await assert.rejects(()=>suggestListing(adviceInput(draft),[],{env,signal:controller.signal,fetcher:async()=>{
    calls++;setTimeout(()=>controller.abort(),10);return new Response('{}',{status:503});
  }}),/chưa phản hồi kịp/);
  assert.equal(calls,1);
});
