export type ListingDraft = { title: string; description: string; category: string; condition: string; price: string; kind: "Sell" | "Exchange" | "Gift"; location: string; step: number; files: File[] };
function database(): Promise<IDBDatabase> {
  return new Promise((resolve,reject)=>{const request=indexedDB.open("sangtay-listing-drafts",1);request.onupgradeneeded=()=>request.result.createObjectStore("drafts");request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
}
export async function listingDraft(owner: string, action: "read" | "write" | "delete", value?: ListingDraft): Promise<ListingDraft | undefined> {
  const db=await database();
  return new Promise((resolve,reject)=>{const tx=db.transaction("drafts",action==="read"?"readonly":"readwrite");const store=tx.objectStore("drafts");const request=action==="read"?store.get(owner):action==="delete"?store.delete(owner):store.put(value,owner);tx.oncomplete=()=>{db.close();resolve(action==="read"?request.result:undefined);};tx.onerror=()=>{db.close();reject(tx.error);};tx.onabort=()=>{db.close();reject(tx.error);};});
}
