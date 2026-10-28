import test from 'node:test';
import assert from 'node:assert/strict';
import { createPriceAlerts } from '../src/state/price-alerts.ts';
import { createAccountStore } from '../src/state/account.ts';
const item=(id='a',price=50000)=>({id,title:'Bàn học',description:'Còn tốt',price,status:'Active',sellerId:'seller',seller:'Người bán',school:'DNTU',condition:'Tốt',location:'Thư viện',image:'/a.jpg'});
const change={id:'a',title:'Bàn học',before:50000,after:40000};
const memory=()=>{const data=new Map();return {data,getItem:async key=>data.get(key)||null,setItem:async(key,value)=>{data.set(key,value);}};};
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
const device=()=>({supported:true,permission:async()=>true,present:async()=>{},clear:async()=>{}});

test('failed price notification retries on unchanged refresh, keeps its identifier and does not repeat after success',async()=>{
 const disk=memory(),native=device(),attempts=[];let price=50000;
 native.present=async(id,c)=>{attempts.push([id,c]);if(attempts.length===1)throw Error('Temporary OS error');};
 const alerts=createPriceAlerts(disk,'alerts','buyer:',native);await alerts.setEnabled(true);
 const store=createAccountStore(disk,'account','buyer',{read:async()=>[item('a',price)],toggle:async()=>true},alerts.notify);
 await store.refresh();price=40000;await store.refresh();
 assert.equal(attempts.length,1);assert.ok(alerts.getSnapshot().error);assert.equal(JSON.parse(disk.data.get('alerts')).pending.length,1);
 await store.refresh();assert.equal(attempts.length,2);assert.equal(attempts[0][0],attempts[1][0]);assert.equal(alerts.getSnapshot().error,'');
 assert.equal(JSON.parse(disk.data.get('alerts')).pending.length,0);
 await store.refresh();assert.equal(attempts.length,2);
});

test('pending notifications survive a process restart after the favorites price baseline was saved',async()=>{
 const disk=memory(),native=device();native.present=async()=>{throw Error('OS busy');};
 const alerts=createPriceAlerts(disk,'alerts','buyer:',native);await alerts.setEnabled(true);
 let price=50000;const api={read:async()=>[item('a',price)],toggle:async()=>true};
 const store=createAccountStore(disk,'account','buyer',api,alerts.notify);await store.refresh();price=40000;await store.refresh();
 const pending=JSON.parse(disk.data.get('alerts')).pending[0];assert.equal(JSON.parse(disk.data.get('account')).favorites[0].price,40000);
 // A killed process does not run logout/dispose hooks. Recreate both stores from disk.
 const delivered=[],next=createPriceAlerts(disk,'alerts','buyer:',{...device(),present:async(id,c)=>{delivered.push([id,c]);}});
 const restored=createAccountStore(disk,'account','buyer',api,next.notify);await restored.refresh();
 assert.deepEqual(delivered,[[pending.identifier,change]]);await restored.refresh();assert.equal(delivered.length,1);
});

test('partial delivery retries only failed items, and concurrent refreshes do not deliver the same pending item twice',async()=>{
 const disk=memory(),native=device(),attempts=[];
 native.present=async(id,c)=>{attempts.push([id,c.id]);if(c.id==='b'&&attempts.length===2)throw Error('Transient');};
 const alerts=createPriceAlerts(disk,'alerts','buyer:',native);await alerts.setEnabled(true);
 await alerts.notify([change,{...change,id:'b'}],()=>true);
 await Promise.all([alerts.notify([],()=>true),alerts.notify([],()=>true)]);
 assert.deepEqual(attempts.map(c=>c[1]),['a','b','b']);assert.equal(attempts[1][0],attempts[2][0]);
});

test('temporarily denied permission keeps pending changes without prompting and retries after permission returns',async()=>{
 const disk=memory(),native=device(),requests=[],delivered=[];let granted=true;
 native.permission=async request=>{requests.push(request);return granted;};native.present=async id=>{delivered.push(id);};
 const alerts=createPriceAlerts(disk,'alerts','buyer:',native);await alerts.setEnabled(true);granted=false;
 await alerts.notify([change],()=>true);assert.equal(delivered.length,0);assert.equal(JSON.parse(disk.data.get('alerts')).pending.length,1);
 granted=true;await alerts.notify([],()=>true);assert.equal(delivered.length,1);assert.deepEqual(requests,[true,false,false]);
});

test('turning alerts off or signing out removes pending retries, including permission work already in flight',async()=>{
 const disk=memory(),native=device();native.present=async()=>{throw Error('Transient');};
 const alerts=createPriceAlerts(disk,'off','buyer:',native);await alerts.setEnabled(true);await alerts.notify([change],()=>true);
 await alerts.setEnabled(false);assert.equal(JSON.parse(disk.data.get('off')).pending.length,0);
 const sent=[];native.present=async id=>{sent.push(id);};await alerts.setEnabled(true);await alerts.notify([],()=>true);assert.equal(sent.length,0);
 const permission=deferred(),started=deferred();native.permission=async request=>{if(request)return true;started.resolve();return permission.promise;};
 const pending=alerts.notify([change],()=>true);await started.promise;alerts.dispose();permission.resolve(true);await pending;
 assert.equal(sent.length,0);assert.equal(JSON.parse(disk.data.get('off')).pending.length,0);
 const restored=createPriceAlerts(disk,'off','buyer:',{...device(),present:async id=>{sent.push(id);}});await restored.notify([],()=>true);assert.equal(sent.length,0);
});

test('a removed favorite is not delivered from the pending queue',async()=>{
 const disk=memory(),native=device(),attempts=[];
 native.present=async id=>{attempts.push(id);throw Error('Transient');};
 const alerts=createPriceAlerts(disk,'alerts','buyer:',native);await alerts.setEnabled(true);await alerts.notify([change],()=>true,[item()]);
 await alerts.notify([],()=>true,[]);assert.equal(attempts.length,1);assert.equal(JSON.parse(disk.data.get('alerts')).pending.length,0);
 assert.equal(alerts.getSnapshot().error,'');
});

test('a failed queue write prevents delivery until the queue is safely persisted',async()=>{
 const disk=memory(),native=device(),attempts=[];let fail=false;
 const storage={...disk,setItem:async(key,value)=>{if(fail)throw Error('Disk busy');await disk.setItem(key,value);}};
 native.present=async id=>{attempts.push(id);};
 const alerts=createPriceAlerts(storage,'alerts','buyer:',native);await alerts.setEnabled(true);fail=true;
 await alerts.notify([change],()=>true);assert.equal(attempts.length,0);
 fail=false;await alerts.notify([],()=>true);assert.equal(attempts.length,1);
});

test('a permission check finishing after opt-out cannot schedule or restore a stale error',async()=>{
 const disk=memory(),native=device(),permission=deferred(),started=deferred(),sent=[];
 native.permission=async request=>{if(request)return true;started.resolve();return permission.promise;};native.present=async id=>{sent.push(id);};
 const alerts=createPriceAlerts(disk,'alerts','buyer:',native);await alerts.setEnabled(true);
 const notification=alerts.notify([change],()=>true);await started.promise;await alerts.setEnabled(false);permission.resolve(false);await notification;
 assert.equal(alerts.getSnapshot().enabled,false);assert.equal(alerts.getSnapshot().error,'');assert.equal(sent.length,0);assert.equal(JSON.parse(disk.data.get('alerts')).pending.length,0);
});
