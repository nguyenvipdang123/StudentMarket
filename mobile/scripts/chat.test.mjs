import assert from 'node:assert/strict';
import test from 'node:test';
import { chatImagePath, chatMessageBody, chatPeer, createChatApi, mergeChatMessages } from '../src/api/chat.ts';
import { createChatPoller } from '../src/api/chat-polling.ts';
const id='11111111-1111-4111-8111-111111111111';
const other='22222222-2222-4222-8222-222222222222';
const conversation={id,buyerId:'buyer',sellerId:'seller',buyerName:'Người mua',sellerName:'Người bán',buyerSchool:'DNTU',sellerSchool:'UTH'};
const item=(overrides={})=>({id:'a',conversationId:id,senderId:'buyer',senderName:'Bạn',content:'Xin chào',sentAt:'2026-10-28T01:00:00Z',isRead:false,...overrides});

test('chat identifies the other participant for buying and selling, rejecting outsiders',()=>{
  assert.deepEqual(chatPeer(conversation,'buyer'),{name:'Người bán',school:'UTH',buying:true});
  assert.equal(chatPeer(conversation,'seller').name,'Người mua');
  assert.equal(chatPeer(conversation,'outsider'),null);
});
test('chat payloads send only listing/content, never a client-supplied sender or seller',async()=>{
  const calls=[];
  const api=createChatApi(async(path,options)=>{calls.push({path,options});return{id};});
  await api.contact(id); await api.send(id,'  Chào bạn  '); await api.history(id);
  assert.deepEqual(JSON.parse(calls[0].options.body),{listingId:id});
  assert.deepEqual(JSON.parse(calls[1].options.body),{content:'Chào bạn'});
  assert.equal(calls[2].path,`/api/conversations/${id}/messages`);
  for(const bad of ['../../auth/logout','', 'not-a-uuid']) assert.throws(()=>api.history(bad));
  for(const text of ['   ','x'.repeat(5001)]) assert.throws(()=>chatMessageBody(text));
  assert.equal(chatMessageBody('x'.repeat(5000)).content.length,5000);
});
test('late history cannot erase a just-sent message, duplicate it or roll back its read receipt',()=>{
  const first=item({isRead:true,readAt:'2026-10-28T01:00:02Z'});
  const second=item({id:'b',content:'Món còn không?',sentAt:'2026-10-28T01:00:01Z'});
  const merged=mergeChatMessages([first,second],[item(),item({conversationId:other,id:'foreign'})],id);
  assert.deepEqual(merged.map(m=>m.id),['a','b']);
  assert.equal(merged[0].isRead,true);
  assert.equal(merged[0].readAt,first.readAt);
  assert.equal(mergeChatMessages(merged,[second],id).length,2);
});
test('private images only use validated paths in the current conversation',()=>{
  const path=`/api/conversations/${id}/attachments/${other}.png`;
  assert.equal(chatImagePath('[Ảnh] '+path,id),path);
  for(const content of ['[Ảnh] https://evil.invalid/image.png','[Ảnh] '+path+'?token=leak','[Ảnh] '+path.replace(id,other),'[Ảnh] /api/conversations/'+id+'/attachments/../../secret.png'])assert.equal(chatImagePath(content,id),null);
});
function fixtureClock(){const timers=new Map();let next=0;return{timers,clock:{setTimeout(fn){timers.set(++next,fn);return next;},clearTimeout(key){timers.delete(key);}},tick(){const [key,fn]=timers.entries().next().value;timers.delete(key);fn();}};}
const flush=async()=>{await Promise.resolve();await Promise.resolve();};
test('polling does not overlap, invalidates paused requests and reloads after returning to foreground',async()=>{
  const f=fixtureClock(),pending=[];let calls=0;
  const poller=createChatPoller(isCurrent=>{calls++;return new Promise(resolve=>pending.push({resolve,isCurrent}));},5000,f.clock);
  poller.resume();poller.refresh();assert.equal(calls,1);
  assert.equal(pending[0].isCurrent(),true);
  poller.pause();assert.equal(pending[0].isCurrent(),false);assert.equal(f.timers.size,0);
  poller.resume();assert.equal(calls,1);
  pending[0].resolve();await flush();assert.equal(calls,2);
  pending[1].resolve();await flush();assert.equal(f.timers.size,1);
  poller.dispose();assert.equal(f.timers.size,0);assert.equal(pending[1].isCurrent(),false);
  poller.resume();assert.equal(calls,2);
});
test('access-denied responses stop automatic polling until the user retries',async()=>{
  const f=fixtureClock();let calls=0;
  const poller=createChatPoller(async()=>{calls++;return false;},5000,f.clock);
  poller.resume();await flush();assert.equal(f.timers.size,0);
  poller.refresh();await flush();assert.equal(calls,2);poller.dispose();
});
test('platform timers are called without rebinding their receiver to the clock object',async()=>{
  const originalSet=globalThis.setTimeout,originalClear=globalThis.clearTimeout;
  let scheduled=0,cleared=0;
  globalThis.setTimeout=function(){assert.ok(this===undefined||this===globalThis);scheduled++;return 1;};
  globalThis.clearTimeout=function(){assert.ok(this===undefined||this===globalThis);cleared++;};
  try{
    const poller=createChatPoller(async()=>{},5000);
    poller.resume();await flush();assert.equal(scheduled,1);
    poller.dispose();assert.equal(cleared,1);
  }finally{globalThis.setTimeout=originalSet;globalThis.clearTimeout=originalClear;}
});
