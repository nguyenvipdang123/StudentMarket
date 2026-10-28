import test from 'node:test';
import assert from 'node:assert/strict';
import { createCatalogueStore } from '../src/state/catalogue.ts';
import { createAccountStore } from '../src/state/account.ts';
import { availability, addCartItem, checkCart, checkoutSummary } from '../src/state/commerce.ts';
import { validatePhotos } from '../src/api/photos-policy.ts';
import { completeSignOut } from '../src/api/logout.ts';
const item=(id='a',extra={})=>({id,title:'Bàn học',description:'Bàn còn tốt',category:'Nội thất',price:50000,status:'Active',moderationStatus:'APPROVED',condition:'Tốt',school:'DNTU',location:'Thư viện',seller:'Người bán',sellerId:'seller',image:'/sample/ban.jpg',...extra});
const memory=()=>{const data=new Map();return {data,getItem:async k=>data.get(k)||null,setItem:async(k,v)=>{data.set(k,v);}};};
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
const api={read:async()=>[],toggle:async()=>true};
test('last successful catalogue survives process restart and remote failure; cold offline start has a ready empty state',async()=>{
 const disk=memory(), first=createCatalogueStore(disk,'catalogue',async()=>[item()]);await first.refresh();assert.equal(first.getSnapshot().products.length,1);first.dispose();
 const restarted=createCatalogueStore(disk,'catalogue',async()=>{throw Error('offline');});await restarted.refresh();assert.equal(restarted.getSnapshot().products[0].title,'Bàn học');assert.equal(restarted.getSnapshot().stale,true);assert.equal(restarted.getSnapshot().busy,false);assert.ok(restarted.getSnapshot().error);
 const cold=createCatalogueStore(memory(),'catalogue',async()=>{throw Error('unexpected request');});await cold.refresh(true);assert.equal(cold.getSnapshot().ready,true);assert.equal(cold.getSnapshot().stale,true);assert.deepEqual(cold.getSnapshot().products,[]);
});
test('corrupt cache and failed refresh cannot blank a valid in-memory catalogue',async()=>{
 const disk=memory();disk.data.set('c','{broken');let fail=false;
 const store=createCatalogueStore(disk,'c',async()=>{if(fail)throw Error('503');return [item()];});await store.refresh();fail=true;await store.refresh();assert.equal(store.getSnapshot().products.length,1);assert.ok(JSON.parse(disk.data.get('c')).products.length);
 const bad=memory();bad.data.set('c',JSON.stringify({version:1,products:[{id:'x',title:'x',price:5,status:'Active'}]}));const cold=createCatalogueStore(bad,'c',async()=>[]);await cold.refresh(true);assert.deepEqual(cold.getSnapshot().products,[]);
});
test('favorites notify two subscribers immediately, persist with cart across restart and remain account-isolated',async()=>{
 const disk=memory(),store=createAccountStore(disk,'account:A','buyer',api);await store.refresh(true);
 let detail=0,saved=0;const a=store.subscribe(()=>detail++),b=store.subscribe(()=>saved++);
 await store.toggle(item());await store.add(item());assert.equal(detail,saved);assert.ok(detail>0);assert.equal(store.getSnapshot().favorites[0].id,'a');a();b();store.dispose();
 const restored=createAccountStore(disk,'account:A','buyer',api);await restored.refresh(true);assert.equal(restored.getSnapshot().favorites.length,1);assert.equal(restored.getSnapshot().cart.length,1);
 const other=createAccountStore(disk,'account:B','other',api);await other.refresh(true);assert.equal(other.getSnapshot().favorites.length,0);assert.equal(other.getSnapshot().cart.length,0);
});
test('late refresh cannot overwrite a newly toggled favorite; failure preserves the previous favorite and offline cannot mutate',async()=>{
 const pending=deferred(),disk=memory();let saved=true,fail=false;
 const store=createAccountStore(disk,'a','buyer',{read:()=>pending.promise,toggle:async()=>{if(fail)throw Error('503');return saved;}});
 const refresh=store.refresh();await store.toggle(item());pending.resolve([]);await refresh;assert.equal(store.getSnapshot().favorites.length,1);
 fail=true;await assert.rejects(store.toggle(item()));assert.equal(store.getSnapshot().favorites.length,1);
 await assert.rejects(store.toggle(item(),true),/offline/);saved=false;fail=false;await store.toggle(item());assert.equal(store.getSnapshot().favorites.length,0);
});
test('logout/disposal ignores a late favorite response and blocks a previous account mutation',async()=>{
 const pending=deferred(),disk=memory(),store=createAccountStore(disk,'a','buyer',{read:async()=>[],toggle:()=>pending.promise});await store.refresh(true);
 const action=store.toggle(item());await Promise.resolve();store.dispose();pending.resolve(true);await action;
 assert.equal(store.getSnapshot().favorites.length,0);await assert.rejects(store.add(item()));
});
test('one-of-a-kind stock, sold/hidden/pending/reserved/self-owned and exchange rules block invalid additions with visible reasons',()=>{
 const cart=addCartItem([],item(),'buyer');assert.throws(()=>addCartItem(cart,item(),'buyer'),/1 món/);
 for(const product of [item('sold',{status:'Sold'}),item('hidden',{status:'Hidden'}),item('pending',{moderationStatus:'PENDING'}),item('mine',{sellerId:'buyer'}),item('held',{reservedUntil:new Date(Date.now()+60000).toISOString()}),item('exchange',{price:0})])assert.ok(availability(product,'buyer'));
 assert.equal(availability(item('expired',{reservedUntil:new Date(Date.now()-1000).toISOString()}),'buyer'),'');
 assert.equal(availability(item('gift',{price:0,freeGift:true}),'buyer'),'');
});
test('checkout derives subtotal/delivery/total, charging once per seller and zero for pickup or an empty cart',()=>{
 const cart=[item(),item('b'),item('c',{price:100000,sellerId:'seller2'})];
 assert.deepEqual(checkoutSummary(cart,'pickup'),{subtotal:200000,deliveryFee:0,total:200000,sellers:2,count:3});
 assert.equal(checkoutSummary(cart,'delivery').deliveryFee,60000);assert.equal(checkoutSummary(cart,'delivery').total,260000);assert.equal(checkoutSummary([],'delivery').total,0);
});
test('checkout re-fetches availability, catches removed/network failures and reports price changes without placing an order',async()=>{
 const cart=[item('sold'),item('missing'),item('price')],calls=[];
 const result=await checkCart(cart,async id=>{calls.push(id);if(id==='missing')throw Error('404');return item(id,id==='sold'?{status:'Sold'}:{price:75000});},'buyer');
 assert.equal(calls.length,3);assert.ok(result.issues.sold);assert.ok(result.issues.missing);assert.equal(result.priceChanged,true);assert.equal(result.products[2].price,75000);
});
test('creation requires at least one compressed photo, bounded dimensions, file size and correct JPEG MIME',()=>{
 const photo={uri:'file:///cache/compressed.jpg',fileName:'photo.jpg',mimeType:'image/jpeg',width:1600,height:1200,fileSize:200000};
 assert.ok(validatePhotos([]));assert.equal(validatePhotos([photo]),'');
 for(const changes of [{fileSize:0},{fileSize:NaN},{fileSize:6*1024*1024},{width:4000},{width:NaN},{height:0},{mimeType:'image/png'}])assert.ok(validatePhotos([{...photo,...changes}]));
 assert.ok(validatePhotos(Array(9).fill(photo)));
});
test('complete sign-out removes local credentials and UI despite failed remote logout, while successful logout awaits revocation',async()=>{
 const calls=[];await assert.rejects(completeSignOut(async()=>{calls.push('revoke');throw Error('offline');},async()=>{calls.push('clear');},()=>calls.push('guest')),/Đã đăng xuất trên thiết bị/);assert.deepEqual(calls,['revoke','clear','guest']);
 let revoked=false;await completeSignOut(async()=>{await Promise.resolve();revoked=true;},async()=>{},()=>{});assert.equal(revoked,true);
});
