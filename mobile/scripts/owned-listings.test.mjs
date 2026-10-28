import test from 'node:test';
import assert from 'node:assert/strict';
import { ownedDraft, ownsListing, editListingPayload, soldPayload, validListingId } from '../src/state/owned-listings.ts';
import { listingStatus } from '../src/state/listing-view.ts';
import { createCatalogueStore } from '../src/state/catalogue.ts';
import { createAccountStore } from '../src/state/account.ts';
const id='11111111-1111-4111-8111-111111111111';
const item={id,title:'Bàn học gỗ',description:'Bàn còn dùng tốt',price:50000,category:'Nội thất',status:'Active',moderationStatus:'APPROVED',condition:'Tốt',school:'DNTU',location:'Thư viện',seller:'Người bán',sellerId:'seller',image:'/api/product-images/11111111-1111-4111-8111-111111111111.jpg'};
const memory=()=>{const data=new Map();return {data,getItem:async key=>data.get(key)||null,setItem:async(key,value)=>{data.set(key,value);}};};
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};

test('editing a free gift preserves its marker exactly once, and does not change an exchange into a gift',()=>{
 const gift={...item,price:0,freeGift:true,description:'Tặng miễn phí. Bàn còn dùng tốt'};
 const draft=ownedDraft(gift);assert.equal(draft.kind,'Gift');assert.equal(draft.description,'Bàn còn dùng tốt');
 const body=editListingPayload(draft,item.image,'Active');assert.equal(body.description,gift.description);assert.equal(body.price,0);
 const exchange=ownedDraft({...item,price:0});assert.equal(exchange.kind,'Exchange');assert.equal(editListingPayload(exchange,item.image,'Hidden').description,item.description);
});
test('edit payload validates price, category and visibility without accepting Sold or client ownership',()=>{
 const draft=ownedDraft(item),body=editListingPayload({...draft,title:' Bàn học mới '},item.image,'Hidden');assert.equal(body.title,'Bàn học mới');assert.equal(body.expectedStatus,'Hidden');assert.equal('sellerId' in body,false);
 for(const changes of [{price:'-1'},{price:'99999999999'},{title:'a'},{description:'ngắn'},{category:'Không có'},{condition:'Không có'},{status:'Sold'}])assert.throws(()=>editListingPayload({...draft,...changes},item.image,'Active'));
});
test('ownership requires the authenticated seller UUID; a staff role or matching numeric account ID is insufficient',()=>{
 assert.equal(ownsListing(item,'seller'),true);assert.equal(ownsListing(item),false);assert.equal(ownsListing(item,'other'),false);assert.equal(ownsListing({...item,sellerId:undefined},'seller'),false);
 assert.equal(validListingId(id),true);assert.equal(validListingId('../other'),false);
 assert.equal(listingStatus({...item,status:'Hidden',moderationStatus:'PENDING'}),'Đã ẩn');
});
test('mark sold distinguishes a real SangTay buyer from an outside sale without inventing a buyer',()=>{
 assert.deepEqual(soldPayload(true,' buyer@example.invalid '),{viaSangTay:true,buyerId:'buyer@example.invalid'});
 assert.equal(soldPayload(true,id).buyerId,id);assert.throws(()=>soldPayload(true,''));assert.throws(()=>soldPayload(true,'unknown'));
 assert.deepEqual(soldPayload(false,'private@example.invalid'),{viaSangTay:false,buyerId:''});
});
test('hiding/deleting removes a cached catalogue item and an older in-flight fetch cannot restore it',async()=>{
 const disk=memory(),late=deferred();let first=true;
 const store=createCatalogueStore(disk,'catalogue',async()=>{if(first){first=false;return [item];}return late.promise;});await store.refresh();
 const refresh=store.refresh();await Promise.resolve();await store.forgetProduct(id);late.resolve([item]);await refresh;assert.deepEqual(store.getSnapshot().products,[]);
 const restored=createCatalogueStore(disk,'catalogue',async()=>{throw Error('offline');});await restored.refresh(true);assert.deepEqual(restored.getSnapshot().products,[]);
});
test('a removed owned listing cannot reappear in favorites/cart from a stale account response',async()=>{
 const disk=memory(),late=deferred();let first=true;
 const store=createAccountStore(disk,'account','buyer',{read:async()=>{if(first){first=false;return [item];}return late.promise;},toggle:async()=>true});
 await store.refresh();await store.add(item);const refresh=store.refresh();await Promise.resolve();await store.forgetProduct(id);late.resolve([item]);await refresh;
 assert.equal(store.getSnapshot().favorites.length,0);assert.equal(store.getSnapshot().cart.length,0);assert.equal(JSON.parse(disk.data.get('account')).favorites.length,0);
});

test('a favorite toggle finishing after an owned listing was hidden cannot restore the removed item',async()=>{
 const disk=memory(),late=deferred();
 const store=createAccountStore(disk,'account','buyer',{read:async()=>[],toggle:()=>late.promise});await store.refresh();
 const toggle=store.toggle(item);await Promise.resolve();await store.forgetProduct(id);late.resolve(true);await toggle;
 assert.equal(store.getSnapshot().favorites.length,0);assert.equal(JSON.parse(disk.data.get('account')).favorites.length,0);
});
