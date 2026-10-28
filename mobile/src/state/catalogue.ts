import type { Product } from "../api/types.ts";
import { parseCache, writer, type Storage } from "./storage.ts";
export function isProduct(value: unknown): value is Product {
  const p = value as Product | null;
  return !!p && [p.id, p.title, p.description, p.condition, p.location, p.school, p.seller, p.image].every(v => typeof v === "string") && typeof p.price === "number" && Number.isFinite(p.price) && p.price >= 0 && ["Active", "Sold", "Hidden"].includes(p.status) && (p.images === undefined || Array.isArray(p.images) && p.images.every(v => typeof v === "string"));
}
export function createCatalogueStore(storage: Storage, key: string, fetchAll: () => Promise<Product[]>) {
  let state = { products: [] as Product[], savedAt: "", ready: false, busy: false, stale: false, error: "" };
  let disposed = false, pending: Promise<void> | null = null;
  const listeners = new Set<() => void>(), persist = writer(storage, key);
  const emit = (patch: Partial<typeof state>) => { if (!disposed) { state = { ...state, ...patch }; listeners.forEach(fn => fn()); } };
  async function hydrate() {
    try {
      const cached = parseCache(await storage.getItem(key)) as { version?: number; products?: unknown[]; savedAt?: string } | null;
      if (cached?.version === 1 && Array.isArray(cached.products) && cached.products.every(isProduct))
        emit({ products: cached.products, savedAt: cached.savedAt || "", stale: true });
    } catch { emit({ error: "Không đọc được bản lưu trên thiết bị." }); }
    emit({ ready: true });
  }
  const hydrated = hydrate();
  return {
    getSnapshot: () => state,
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    async refresh(offline = false) {
      await hydrated;
      if (disposed) return;
      if (offline) { emit({ stale: true, busy: false }); return; }
      if (pending) return pending;
      pending = (async () => {
        emit({ busy: true, error: "" });
        try {
          const products = await fetchAll();
          if (!products.every(isProduct)) throw Error("Dữ liệu catalogue không hợp lệ.");
          if (disposed) return;
          const savedAt = new Date().toISOString();
          emit({ products, savedAt, stale: false });
          try { await persist({ version: 1, products, savedAt }); }
          catch { emit({ error: "Đã tải catalogue, nhưng chưa lưu được để xem offline." }); }
        } catch { emit({ stale: true, error: "Chưa kết nối được máy chủ. Đang giữ catalogue tải thành công gần nhất." }); }
        finally { emit({ busy: false }); pending = null; }
      })();
      return pending;
    },
    dispose() { disposed = true; listeners.clear(); },
  };
}
