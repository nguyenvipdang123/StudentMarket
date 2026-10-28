import { categories, conditions } from "../api/types.ts";
import { validatePhotos, type CompressedPhoto } from "../api/photos-policy.ts";
import type { Storage } from "./storage.ts";

export const initialListingDraft = {
  title: "", description: "", price: "", location: "Khuôn viên trường",
  kind: "Sell", category: "Học tập", condition: "Như mới",
};
export type ListingDraft = typeof initialListingDraft;
export type DraftMedia = {
  retain(photo: CompressedPhoto): Promise<CompressedPhoto>;
  inspect(photo: CompressedPhoto): Promise<CompressedPhoto | null>;
  prune(keepUris: string[]): Promise<void>;
};
type Snapshot = {
  draft: ListingDraft; photos: CompressedPhoto[]; ready: boolean;
  saving: boolean; clearing: boolean; dirty: boolean; savedAt: string;
  error: string; loadError: string; warning: string;
};
type Manifest = { version: 1; scope: string; draft: ListingDraft; photos: CompressedPhoto[]; savedAt: string };
export const draftStorageKey = (scope: string) => `sangtay:listing-draft:v1:${scope}`;
function readManifest(raw: string, scope: string): Manifest {
  const value = JSON.parse(raw) as Manifest;
  const d = value?.draft;
  if (value?.version !== 1 || value.scope !== scope || !d ||
      Object.entries(initialListingDraft).some(([key]) => typeof d[key as keyof ListingDraft] !== "string") ||
      d.title.length > 200 || d.description.length > 10000 || d.location.length > 200 || d.price.length > 40 ||
      !["Sell", "Gift", "Exchange"].includes(d.kind) || !categories.slice(1).includes(d.category) || !conditions.includes(d.condition) ||
      !Array.isArray(value.photos) || value.photos.length > 8 ||
      value.photos.some(p => !p || typeof p.fileName !== "string" || !!validatePhotos([p])) ||
      typeof value.savedAt !== "string" || (value.savedAt !== "" && !Number.isFinite(Date.parse(value.savedAt)))) {
    throw Error("Bản nháp trên máy không hợp lệ.");
  }
  return value;
}

export function createListingDraftStore(storage: Storage, media: DraftMedia, scope: string) {
  let state: Snapshot = {
    draft: { ...initialListingDraft }, photos: [], ready: false, saving: false, clearing: false,
    dirty: false, savedAt: "", error: "", loadError: "", warning: "",
  };
  let revision = 0;
  let queue: Promise<unknown> = Promise.resolve();
  const listeners = new Set<() => void>();
  const update = (patch: Partial<Snapshot>) => { state = { ...state, ...patch }; listeners.forEach(fn => fn()); };
  function enqueue<T>(work: () => Promise<T>): Promise<T> {
    const next = queue.catch(() => {}).then(work);
    queue = next;
    return next;
  }
  async function prune() {
    try { await media.prune(state.photos.map(p => p.uri)); }
    catch { update({ warning: "Bản nháp đã lưu; chưa dọn được ảnh cũ trên máy. Sẽ thử lại ở lần lưu sau." }); }
  }
  async function persist() {
    if (!state.ready || state.loadError) return false;
    if (!state.dirty) { await prune(); return true; }
    const current = revision;
    const savedAt = new Date().toISOString();
    const manifest: Manifest = { version: 1, scope, draft: state.draft, photos: state.photos, savedAt };
    update({ saving: true });
    try {
      await storage.setItem(draftStorageKey(scope), JSON.stringify(manifest));
      update({ savedAt, dirty: revision !== current, error: "" });
      // Delete detached files only after their removal is committed to the manifest.
      await prune();
      return true;
    } catch {
      update({ error: "Chưa lưu được bản nháp trên máy. Kiểm tra dung lượng và bấm Lưu bản nháp để thử lại." });
      return false;
    } finally { update({ saving: false }); }
  }
  async function load() {
    update({ ready: false, loadError: "" });
    try {
      const raw = await storage.getItem(draftStorageKey(scope));
      if (raw) {
        const manifest = readManifest(raw, scope);
        const restored = await Promise.all(manifest.photos.map(p => media.inspect(p)));
        const photos = restored.filter((p): p is CompressedPhoto => p !== null);
        const missing = photos.length !== manifest.photos.length;
        update({ draft: manifest.draft, photos, savedAt: manifest.savedAt, dirty: missing,
          warning: missing ? "Một số ảnh nháp không còn trên máy. Nội dung vẫn được giữ; hãy chọn lại ảnh bị thiếu." : "" });
      }
      update({ ready: true });
      if (state.dirty) await persist();
      else await prune();
    } catch {
      // Never replace an unreadable draft with a blank form automatically.
      update({ loadError: "Chưa khôi phục được bản nháp. Bấm Thử lại để đọc lại dữ liệu trên máy.", ready: false });
    }
  }
  const store = {
    getSnapshot: () => state,
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    retryLoad: () => enqueue(load),
    change(key: keyof ListingDraft, value: string) {
      if (!state.ready || state.clearing) return;
      revision++;
      update({ draft: { ...state.draft, [key]: value }, dirty: true });
      // Queue immediately; app suspension must not leave an outstanding debounce timer.
      void enqueue(persist);
    },
    save: () => enqueue(persist),
    addPhotos(photos: CompressedPhoto[]) {
      return enqueue(async () => {
        if (!state.ready || state.clearing) return false;
        const added: CompressedPhoto[] = [];
        try {
          for (const photo of photos.slice(0, 8 - state.photos.length)) added.push(await media.retain(photo));
          revision++;
          update({ photos: [...state.photos, ...added], dirty: true });
          return await persist();
        } catch {
          // An incomplete copy is never placed into the saved manifest.
          update({ error: "Chưa lưu được ảnh nháp. Kiểm tra dung lượng rồi chọn lại ảnh." });
          if (!state.dirty) await prune();
          return false;
        }
      });
    },
    removePhoto(uri: string) {
      return enqueue(async () => {
        if (!state.ready || state.clearing) return false;
        revision++;
        update({ photos: state.photos.filter(p => p.uri !== uri), dirty: true });
        return persist();
      });
    },
    async clear() {
      if (state.clearing || (!state.ready && !state.loadError)) return false;
      update({ clearing: true });
      return enqueue(async () => {
        try {
          const empty: Manifest = { version: 1, scope, draft: { ...initialListingDraft }, photos: [], savedAt: "" };
          // Commit the empty draft before deleting photos, including after a successful POST.
          await storage.setItem(draftStorageKey(scope), JSON.stringify(empty));
          revision++;
          update({ draft: empty.draft, photos: [], ready: true, loadError: "", dirty: false, savedAt: "", warning: "", error: "" });
          await prune();
          return true;
        } catch {
          update({ error: "Chưa xóa được bản nháp trên máy. Nội dung và ảnh vẫn được giữ; hãy thử lại." });
          return false;
        } finally { update({ clearing: false }); }
      });
    },
  };
  void store.retryLoad();
  return store;
}
export type ListingDraftStore = ReturnType<typeof createListingDraftStore>;
