import test from 'node:test';
import assert from 'node:assert/strict';
import {answerWithGemini, assistantAiConfig, AssistantAiError, rememberAssistantTurn, streamGeminiAnswer} from '../lib/assistant-gemini.ts';

const env={ASSISTANT_GEMINI_API_KEY:'test-key-not-a-real-credential',ASSISTANT_GEMINI_MODEL:'gemini-3.1-flash-lite'};
const payload=text=>({candidates:[{finishReason:'STOP',content:{parts:[{text}]}}]});
const response = (...chunks) => new Response(chunks.map(chunk => `data: ${JSON.stringify(chunk)}\r\n\r\n`).join(''), {headers:{'Content-Type':'text/event-stream'}});

test('direct Gemini answers carry bounded context, keep the key server-side and hide thought parts',async()=>{
  const history=rememberAssistantTurn([], 'Tôi muốn mua laptop cũ','Bạn cần dùng để học hay chơi game?');
  const text=await answerWithGemini('Để học lập trình',history,{env,fetcher:async(url,init)=>{
    assert.equal(new URL(url).hostname,'generativelanguage.googleapis.com');
    assert.equal(new URL(url).search,'?alt=sse');
    assert.ok(new URL(url).pathname.endsWith(':streamGenerateContent'));
    assert.equal(init.headers['x-goog-api-key'],env.ASSISTANT_GEMINI_API_KEY);
    assert.equal(init.redirect,'error');
    assert.ok(init.signal instanceof AbortSignal);
    const body=JSON.parse(init.body);
    assert.equal(body.contents.at(-1).parts[0].text,'Để học lập trình');
    assert.equal(body.contents[1].role,'model');
    assert.ok(body.systemInstruction.parts[0].text.includes('không có tài liệu PDF'));
    assert.equal(body.generationConfig.thinkingConfig.thinkingLevel,'minimal');
    return response({candidates:[{finishReason:'STOP',content:{parts:[{thought:true,text:'private reasoning'},{text:'Ưu tiên RAM 16 GB nếu có thể.'}]}}]});
  }});
  assert.equal(text,'Ưu tiên RAM 16 GB nếu có thể.');
});

test('provider failures return bounded Vietnamese errors without leaking credentials or provider bodies',async()=>{
  for(const status of [401,429,503]){
    await assert.rejects(answerWithGemini('Bạn giúp mình nhé',[],{env,fetcher:async()=>new Response('sensitive upstream body '+env.ASSISTANT_GEMINI_API_KEY,{status})}),error=>{
      assert.ok(error instanceof AssistantAiError);
      assert.equal(error.status,status===429?429:503);
      assert.ok(!error.message.includes(env.ASSISTANT_GEMINI_API_KEY));
      assert.ok(!error.message.includes('sensitive'));
      return true;
    });
  }
  await assert.rejects(answerWithGemini('Hỏi',[],{env,fetcher:async()=>{throw new Error('private connection data');}}),error=>error instanceof AssistantAiError&&!error.message.includes('private'));
  for(const body of [{candidates:[]},{candidates:[{finishReason:'MAX_TOKENS',content:{parts:[{text:'Incomplete'}]}}]},{candidates:[{finishReason:'SAFETY'}]}]){
    await assert.rejects(answerWithGemini('Hỏi',[],{env,fetcher:async()=>response(body)}),AssistantAiError);
  }
});

test('each session keeps only recent bounded turns and independent assistant credentials can override moderation credentials',async()=>{
  let history=[];
  for(let i=0;i<10;i++)history=rememberAssistantTurn(history,'q'.repeat(2000),'a'.repeat(2000));
  assert.equal(history.length,6);
  assert.ok(history.every(turn=>turn.text.length===800));
  assert.deepEqual(rememberAssistantTurn([], 'new session','new answer').map(t=>t.text),['new session','new answer']);
  assert.equal(assistantAiConfig({GEMINI_API_KEY:'shared'}).key,'shared');
  assert.equal(assistantAiConfig({...env,GEMINI_API_KEY:'moderation'}).key,env.ASSISTANT_GEMINI_API_KEY);
  let fetched=false;
  for(const badEnv of [{},{...env,ASSISTANT_GEMINI_MODEL:'../../bad?key=x'}]){
    await assert.rejects(answerWithGemini('Hỏi',[],{env:badEnv,fetcher:async()=>{fetched=true;return response(payload('unused'));}}),AssistantAiError);
  }
  assert.equal(fetched,false);
});

test('incremental UTF-8 SSE split across arbitrary byte boundaries retains all text and ignores thought chunks',async()=>{
  const encoder=new TextEncoder();const raw=encoder.encode(': ping\r\n\r\n'+[
    {candidates:[{content:{parts:[{thought:true,text:'secret thought'}]}}]},
    {candidates:[{content:{parts:[{text:'Chào bạn, '}]}}]},payload('học vui nhé!'),
  ].map(chunk=>'data: '+JSON.stringify(chunk)+'\r\n\r\n').join(''));
  const partial=[];
  const text=await answerWithGemini('Chào',[],{env,onPartial:text=>partial.push(text),fetcher:async()=>new Response(new ReadableStream({start(c){for(let i=0;i<raw.length;i+=7)c.enqueue(raw.slice(i,i+7));c.close();}}),{headers:{'Content-Type':'text/event-stream'}})});
  assert.equal(text,'Chào bạn, học vui nhé!');assert.deepEqual(partial,['Chào bạn, ','Chào bạn, học vui nhé!']);
});

test('retry only once on transient failures before visible content, never retry quota or a broken partial answer',async()=>{
  let calls=0;
  assert.equal(await answerWithGemini('Hỏi',[],{env,fetcher:async()=>++calls===1?new Response('private',{status:503}):response(payload('Đã trả lời'))}),'Đã trả lời');assert.equal(calls,2);
  calls=0;
  await assert.rejects(answerWithGemini('Hỏi',[],{env,fetcher:async()=>{calls++;return new Response('private',{status:429});}}),e=>e.status===429);assert.equal(calls,1);
  calls=0;let pending;
  await assert.rejects(answerWithGemini('Hỏi',[],{env,fetcher:async()=>{calls++;return new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('data: '+JSON.stringify({candidates:[{content:{parts:[{text:'Một phần'}]}}]})+'\n\n'));pending=c;}}),{headers:{'Content-Type':'text/event-stream'}});},onPartial:()=>pending.error(new Error('private network details'))}),AssistantAiError);
  assert.equal(calls,1);
});

test('client SSE releases session and commits history only for a completed answer',async()=>{
  const complete=[],settled=[];
  const stream=streamGeminiAnswer('Hỏi',[],{env,fetcher:async()=>response(payload('Câu trả lời')),onComplete:text=>complete.push(text),onSettled:()=>settled.push(true)});
  const raw=await new Response(stream).text();assert.ok(raw.startsWith(': connected'));assert.ok(raw.includes('assistant/partial'));assert.deepEqual(complete,['Câu trả lời']);assert.equal(settled.length,1);
  const failed=streamGeminiAnswer('Hỏi',[],{env,fetcher:async()=>response({candidates:[{content:{parts:[{text:'Chưa xong'}]}}]}),onComplete:()=>assert.fail('Incomplete history committed'),onSettled:()=>{}});
  assert.ok((await new Response(failed).text()).includes('assistant/error'));
});

test('disconnect cancels upstream and releases a busy session exactly once',async()=>{
  let settled=0,aborted=false;
  const stream=streamGeminiAnswer('Hỏi',[],{env,fetcher:async(_url,init)=>new Promise((_resolve,reject)=>{init.signal.addEventListener('abort',()=>{aborted=true;reject(new DOMException('aborted','AbortError'));},{once:true});}),onComplete:()=>assert.fail('Cancelled history committed'),onSettled:()=>settled++});
  const reader=stream.getReader();await reader.read();await reader.cancel();await new Promise(r=>setTimeout(r,0));
  assert.equal(aborted,true);assert.equal(settled,1);
});
