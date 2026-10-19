import test from 'node:test';
import assert from 'node:assert/strict';
import {answerWithGemini, assistantAiConfig, AssistantAiError, rememberAssistantTurn} from '../lib/assistant-gemini.ts';

const env={ASSISTANT_GEMINI_API_KEY:'test-key-not-a-real-credential',ASSISTANT_GEMINI_MODEL:'gemini-3.1-flash-lite'};
const payload=text=>({candidates:[{finishReason:'STOP',content:{parts:[{text}]}}]});

test('direct Gemini answers carry bounded context, keep the key server-side and hide thought parts',async()=>{
  const history=rememberAssistantTurn([], 'Tôi muốn mua laptop cũ','Bạn cần dùng để học hay chơi game?');
  const text=await answerWithGemini('Để học lập trình',history,{env,fetcher:async(url,init)=>{
    assert.equal(new URL(url).hostname,'generativelanguage.googleapis.com');
    assert.equal(new URL(url).search,'');
    assert.equal(init.headers['x-goog-api-key'],env.ASSISTANT_GEMINI_API_KEY);
    assert.equal(init.redirect,'error');
    assert.ok(init.signal instanceof AbortSignal);
    const body=JSON.parse(init.body);
    assert.equal(body.contents.at(-1).parts[0].text,'Để học lập trình');
    assert.equal(body.contents[1].role,'model');
    assert.ok(body.systemInstruction.parts[0].text.includes('không có tài liệu PDF'));
    assert.equal(body.generationConfig.thinkingConfig.thinkingLevel,'minimal');
    return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{thought:true,text:'private reasoning'},{text:'Ưu tiên RAM 16 GB nếu có thể.'}]}}]});
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
    await assert.rejects(answerWithGemini('Hỏi',[],{env,fetcher:async()=>Response.json(body)}),AssistantAiError);
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
    await assert.rejects(answerWithGemini('Hỏi',[],{env:badEnv,fetcher:async()=>{fetched=true;return Response.json(payload('unused'));}}),AssistantAiError);
  }
  assert.equal(fetched,false);
});
