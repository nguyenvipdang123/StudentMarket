import test from 'node:test';
import assert from 'node:assert/strict';
import { createListingDraftStore, draftStorageKey } from '../src/state/listing-draft.ts';

const scope='https://sangtay.shop:seller-a';
const photo=(name='one')=>({uri:`cache://${name}`,fileName:`${name}.jpg`,mimeType:'image/jpeg',fileSize:1024,width:800,height:600});
function fixture() {
  const data=new Map(), files=new Map(), writes=[];
  const disk={getItem:async key=>data.get(key)||null,setItem:async(key,value)=>{writes.push(value);data.set(key,value);}};
  const media={
    retain:async p=>{const saved={...p,uri:p.uri.replace('cache://','documents://')};files.set(saved.uri,saved);return saved;},
    inspect:async p=>files.get(p.uri)||null,
    prune:async keep=>{for(const uri of files.keys())if(!keep.includes(uri))files.delete(uri);},
  };
  return {data,files,writes,disk,media,store:()=>createListingDraftStore(disk,media,scope)};
}
const settled=store=>store.save(); // Queued behind initial hydration and all earlier changes.
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {resolve,promise};};

test('partial offline draft and photo order survive a fresh store/process without cache image URIs',async()=>{
  const f=fixture(),store=f.store();await settled(store);
  store.change('title','B');store.change('kind','Gift');store.change('description','Đang viết dở');
  await store.addPhotos([photo('first'),photo('second')]);await store.save();
  const restored=f.store();await settled(restored);
  assert.equal(restored.getSnapshot().draft.title,'B');assert.equal(restored.getSnapshot().draft.kind,'Gift');
  assert.deepEqual(restored.getSnapshot().photos.map(p=>p.uri),['documents://first','documents://second']);
  assert.equal(restored.getSnapshot().dirty,false);assert.ok(restored.getSnapshot().savedAt);
});

test('account and API origin drafts are isolated and never overwrite a different scope',async()=>{
  const f=fixture(),a=f.store();await settled(a);a.change('title','Riêng tài khoản A');await a.save();
  for(const other of ['https://sangtay.shop:seller-b','https://other.invalid:seller-a']) {
    const b=createListingDraftStore(f.disk,{...f.media,prune:async()=>{}},other);await settled(b);
    assert.equal(b.getSnapshot().draft.title,'');b.change('title','B');await b.save();
  }
  assert.equal(JSON.parse(f.data.get(draftStorageKey(scope))).draft.title,'Riêng tài khoản A');
});

test('slow hydration cannot be replaced by an initial blank draft or early edits',async()=>{
  const f=fixture(),old=f.store();await settled(old);old.change('title','Đã lưu trước');await old.save();
  const gate=deferred(),store=createListingDraftStore({...f.disk,getItem:()=>gate.promise},f.media,scope);
  store.change('title','Sai');const save=store.save();
  gate.resolve(f.data.get(draftStorageKey(scope)));await save;
  assert.equal(store.getSnapshot().draft.title,'Đã lưu trước');
});

test('unreadable or wrong-scope cache shows a retry and is not silently overwritten',async()=>{
  const f=fixture();f.data.set(draftStorageKey(scope),'{broken');
  const store=f.store();await settled(store);assert.ok(store.getSnapshot().loadError);
  store.change('title','Không được ghi');assert.equal(await store.save(),false);assert.equal(f.writes.length,0);
  f.data.delete(draftStorageKey(scope));await store.retryLoad();assert.equal(store.getSnapshot().ready,true);
  store.change('title','Khôi phục được');await store.save();
  const raw=JSON.parse(f.data.get(draftStorageKey(scope)));raw.scope='other';f.data.set(draftStorageKey(scope),JSON.stringify(raw));
  const wrong=f.store();await settled(wrong);assert.ok(wrong.getSnapshot().loadError);
  assert.equal(await wrong.clear(),true);assert.equal(wrong.getSnapshot().ready,true);assert.equal(wrong.getSnapshot().loadError,'');
});

test('a missing photo keeps all text, warns visibly, and removes only the missing reference',async()=>{
  const f=fixture(),store=f.store();await settled(store);store.change('description','Thông tin vẫn còn nguyên');await store.addPhotos([photo('one'),photo('two')]);
  f.files.delete('documents://one');const restored=f.store();await settled(restored);
  assert.equal(restored.getSnapshot().draft.description,'Thông tin vẫn còn nguyên');assert.match(restored.getSnapshot().warning,/chọn lại ảnh/);
  assert.deepEqual(restored.getSnapshot().photos.map(p=>p.uri),['documents://two']);
});

test('failed disk write preserves photos referenced by the old manifest, then save retries successfully',async()=>{
  const f=fixture(),store=f.store();await settled(store);await store.addPhotos([photo()]);const write=f.disk.setItem;
  f.disk.setItem=async()=>{throw Error('disk full');};
  assert.equal(await store.removePhoto('documents://one'),false);
  assert.ok(store.getSnapshot().error);assert.equal(f.files.has('documents://one'),true);
  // Even a later photo-copy failure must not prune the image still referenced on disk.
  f.media.retain=async()=>{throw Error('copy failed');};await store.addPhotos([photo('two')]);assert.equal(f.files.has('documents://one'),true);
  f.disk.setItem=write;assert.equal(await store.save(),true);assert.equal(f.files.has('documents://one'),false);
});

test('new image is retained when metadata save fails and can be saved without picking it again',async()=>{
  const f=fixture(),store=f.store();await settled(store);const write=f.disk.setItem;f.disk.setItem=async()=>{throw Error('full');};
  assert.equal(await store.addPhotos([photo()]),false);assert.equal(store.getSnapshot().photos.length,1);assert.ok(store.getSnapshot().dirty);
  f.disk.setItem=write;await store.save();const restored=f.store();await settled(restored);assert.equal(restored.getSnapshot().photos.length,1);
});

test('discard commits empty state after older writes, so queued saves cannot resurrect it',async()=>{
  const f=fixture(),store=f.store();await settled(store);await store.addPhotos([photo()]);
  const gate=deferred(),write=f.disk.setItem;let first=true;
  f.disk.setItem=async(key,value)=>{if(first){first=false;await gate.promise;}return write(key,value);};
  store.change('title','Bản cũ');await Promise.resolve();const clearing=store.clear();const flush=store.save();
  store.change('title','Không cho sửa trong lúc xóa');gate.resolve();assert.equal(await clearing,true);await flush;
  const restored=f.store();await settled(restored);assert.equal(restored.getSnapshot().draft.title,'');assert.equal(restored.getSnapshot().photos.length,0);assert.equal(f.files.size,0);
});

test('failed discard keeps the draft and every photo until a successful retry',async()=>{
  const f=fixture(),store=f.store();await settled(store);store.change('title','Giữ nguyên');await store.addPhotos([photo()]);
  const write=f.disk.setItem;f.disk.setItem=async()=>{throw Error('full');};assert.equal(await store.clear(),false);
  assert.equal(store.getSnapshot().draft.title,'Giữ nguyên');assert.equal(f.files.size,1);
  f.disk.setItem=write;assert.equal(await store.clear(),true);assert.equal(store.getSnapshot().draft.title,'');assert.equal(f.files.size,0);
});
