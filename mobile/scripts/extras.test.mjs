import test from 'node:test';
import assert from 'node:assert/strict';
import { listingView, listingStatus } from '../src/state/listing-view.ts';
import { priceChanges, createPriceAlerts } from '../src/state/price-alerts.ts';
import { createAccountStore } from '../src/state/account.ts';
import { createCatalogueStore } from '../src/state/catalogue.ts';
const item=(id='a',price=50000)=>({id,title:'Bàn học',description:'Còn dùng tốt',price,status:'Active',moderationStatus:'APPROVED',sellerId:'seller',seller:'Người bán',school:'DNTU',condition:'Tốt',location:'Thư viện',image:'/a.jpg'});
const memory=()=>{const data=new Map();return {data,getItem:async key=>data.get(key)||null,setItem:async(key,value)=>{data.set(key,value);}};};
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
const change={id:'a',title:'Bàn học',before:50000,after:40000};
function device(){const calls=[];return {calls,supported:true,permission:async request=>{calls.push(['permission',request]);return true;},present:async(id,c)=>calls.push(['present',id,c]),clear:async scope=>calls.push(['clear',scope])};}
test('same listing derives seller/buyer from authenticated ownership; students can be either, guests/staff are never assumed owners',()=>{
 const student={id:1,pgUserId:'seller',role:'student'};
 assert.equal(listingView(item(),student),'seller');
 assert.equal(listingView(item(),{...student,pgUserId:'buyer'}),'buyer');
 assert.equal(listingView(item(),null),'buyer');
 assert.equal(listingView(item(),{id:1,role:'admin'}),'buyer');
 assert.equal(listingView(item(),{...student,role:'staff',pgUserId:'someone'}),'buyer');
 assert.equal(listingStatus({...item(),moderationStatus:'PENDING'}),'Chờ kiểm duyệt');
 assert.equal(listingStatus({...item(),status:'Sold'}),'Đã sang tay');
 assert.equal(listingStatus({...item(),moderationStatus:'REJECTED'}),'Cần chỉnh sửa');
});
test('price detector reports increases and decreases, excluding first-seen, removed, unchanged and malformed prices',()=>{
 const previous=[item('down'),item('up'),item('same'),item('removed')];
 const changes=priceChanges(previous,[item('down',40000),item('up',60000),item('same'),item('new',10000)]);
 assert.deepEqual(changes.map(c=>[c.id,c.before,c.after]),[['down',50000,40000],['up',50000,60000]]);
 assert.deepEqual(priceChanges([item()],[item('a',NaN)]),[]);
});
test('price refresh persists the new baseline before notifying and does not duplicate after refresh/restart',async()=>{
 const disk=memory(),notifications=[];let price=50000;
 const api={read:async()=>[item('a',price)],toggle:async()=>true};
 const onChange=async(changes,current)=>{if(current())notifications.push(...changes);};
 const first=createAccountStore(disk,'account','buyer',api,onChange);await first.refresh();assert.deepEqual(notifications,[]);
 price=40000;await first.refresh();await first.refresh();assert.equal(notifications.length,1);assert.equal(JSON.parse(disk.data.get('account')).favorites[0].price,40000);
 first.dispose();const restarted=createAccountStore(disk,'account','buyer',api,onChange);await restarted.refresh();assert.equal(notifications.length,1);
 price=60000;await restarted.refresh();assert.equal(notifications.length,2);assert.equal(notifications[1].before,40000);
});
test('failed/offline refresh keeps the exact last successful time and baseline; first unseen prices never notify',async()=>{
 const disk=memory(),notifications=[];let fail=false;
 const store=createAccountStore(disk,'account','buyer',{read:async()=>{if(fail)throw Error('503');return [item()];},toggle:async()=>true},async c=>notifications.push(...c));
 await store.refresh();const time=store.getSnapshot().lastUpdatedAt;assert.ok(time);fail=true;await store.refresh();await store.refresh(true);assert.equal(store.getSnapshot().lastUpdatedAt,time);assert.deepEqual(notifications,[]);
 const restarted=createAccountStore(disk,'account','buyer',{read:async()=>{throw Error('offline');},toggle:async()=>true});await restarted.refresh(true);assert.equal(restarted.getSnapshot().lastUpdatedAt,time);
 let catalogueFail=false;const catalogue=createCatalogueStore(disk,'catalogue',async()=>{if(catalogueFail)throw Error('offline');return [item()];});await catalogue.refresh();const savedAt=catalogue.getSnapshot().savedAt;catalogueFail=true;await catalogue.refresh();assert.equal(catalogue.getSnapshot().savedAt,savedAt);
});
test('permission is requested only by opt-in; settings persist and disabled notifications never schedule',async()=>{
 const disk=memory(),native=device(),alerts=createPriceAlerts(disk,'settings','buyer:',native);
 await alerts.notify([change],()=>true);assert.equal(native.calls.length,0);
 await alerts.setEnabled(true);assert.deepEqual(native.calls[0],['permission',true]);await alerts.notify([change],()=>true);assert.equal(native.calls.filter(c=>c[0]==='present').length,1);
 const restored=createPriceAlerts(disk,'settings','buyer:',native);await restored.notify([change],()=>true);assert.equal(restored.getSnapshot().enabled,true);assert.equal(native.calls.filter(c=>c[0]==='permission'&&c[1]===true).length,1);
 await restored.setEnabled(false);await restored.notify([change],()=>true);assert.equal(restored.getSnapshot().enabled,false);assert.ok(native.calls.some(c=>c[0]==='clear'&&c[1]==='buyer:'));
});
test('permission denial and unsupported web show a visible reason without scheduling or repeatedly prompting',async()=>{
 const disk=memory(),native=device();native.permission=async()=>false;
 const alerts=createPriceAlerts(disk,'settings','buyer:',native);await alerts.setEnabled(true);assert.equal(alerts.getSnapshot().enabled,false);assert.ok(alerts.getSnapshot().error);await alerts.notify([change],()=>true);assert.equal(native.calls.filter(c=>c[0]==='present').length,0);
 const web=createPriceAlerts(disk,'web','buyer:',{...native,supported:false});await web.setEnabled(true);assert.match(web.getSnapshot().error,/web/);
});
test('logout/account changes during permission or presentation cannot leave another account notification on device',async()=>{
 const disk=memory(),native=device(),alerts=createPriceAlerts(disk,'settings','buyer:',native);await alerts.setEnabled(true);
 const permission=deferred();native.permission=()=>permission.promise;
 const late=alerts.notify([change],()=>true);await Promise.resolve();alerts.dispose();permission.resolve(true);await late;assert.equal(native.calls.filter(c=>c[0]==='present').length,0);
 const secondDevice=device(),second=createPriceAlerts(disk,'second','second:',secondDevice);await second.setEnabled(true);
 const presentation=deferred();secondDevice.present=async()=>{await presentation.promise;};const pending=second.notify([change],()=>true);await Promise.resolve();await Promise.resolve();second.dispose();presentation.resolve();await pending;
 assert.ok(secondDevice.calls.some(c=>c[0]==='clear'&&c[1]==='second:'));
});
test('superseded account refresh cannot notify a stale price after a newer favorite mutation',async()=>{
 const disk=memory(),pending=deferred(),notifications=[];const store=createAccountStore(disk,'account','buyer',{read:()=>pending.promise,toggle:async()=>false},async c=>notifications.push(...c));
 const refresh=store.refresh();await store.toggle(item());pending.resolve([item('a',40000)]);await refresh;assert.deepEqual(notifications,[]);assert.equal(store.getSnapshot().favorites.length,0);
});
