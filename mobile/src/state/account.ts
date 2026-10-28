import type { Product } from "../api/types.ts";
import { isProduct } from "./catalogue.ts";
import { addCartItem } from "./commerce.ts";
import { parseCache, writer, type Storage } from "./storage.ts";
import { priceChanges, type PriceChange } from "./price-alerts.ts";
type FavoritesApi = { read: () => Promise<Product[]>; toggle: (id: string) => Promise<boolean> };
export function createAccountStore(storage: Storage, key: string, actorId: string | undefined, api: FavoritesApi, onPriceChanges?: (changes: PriceChange[], isCurrent: () => boolean, favorites: Product[]) => Promise<void>) {
  let state = { favorites: [] as Product[], cart: [] as Product[], ready: false, busy: false, error: "", lastUpdatedAt: "" };
  let disposed = false, revision = 0, mutating = false;
  const listeners = new Set<() => void>(), persist = writer(storage, key);
  const emit = (patch: Partial<typeof state>) => { if (!disposed) { state = { ...state, ...patch }; listeners.forEach(fn => fn()); } };
  const save = async () => {
    if (disposed) return false;
    try { await persist({ version: 1, favorites: state.favorites, cart: state.cart, lastUpdatedAt: state.lastUpdatedAt }); return true; }
    catch { emit({ error: "Chưa lưu được thay đổi trên thiết bị. Bạn kiểm tra dung lượng trống nhé." }); return false; }
  };
  const hydrated = (async () => {
    if (actorId) try {
      const cache = parseCache(await storage.getItem(key)) as { version?: number; favorites?: unknown[]; cart?: unknown[]; lastUpdatedAt?: string } | null;
      if (cache?.version === 1 && Array.isArray(cache.favorites) && Array.isArray(cache.cart) && cache.favorites.every(isProduct) && cache.cart.every(isProduct))
        emit({ favorites: cache.favorites, cart: [...new Map(cache.cart.map(p => [p.id, p])).values()], lastUpdatedAt: typeof cache.lastUpdatedAt === "string" ? cache.lastUpdatedAt : "" });
    } catch { emit({ error: "Không đọc được dữ liệu đã lưu." }); }
    emit({ ready: true });
  })();
  return {
    activate() { disposed = false; },
    getSnapshot: () => state,
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    async refresh(offline = false) {
      await hydrated;
      if (!actorId || disposed || offline || mutating) return;
      const run = ++revision;
      emit({ busy: true });
      try {
        const favorites = await api.read();
        if (!favorites.every(isProduct)) throw Error("Dữ liệu Đã lưu không hợp lệ.");
        if (!disposed && run === revision) {
          const changes = priceChanges(state.favorites, favorites);
          emit({ favorites, error: "", lastUpdatedAt: new Date().toISOString() });
          const saved = await save();
          if (saved && !disposed && run === revision) await onPriceChanges?.(changes, () => !disposed && run === revision, favorites);
        }
      }
      catch { if (run === revision) emit({ error: "Chưa đồng bộ được Đã lưu. Các món đã lưu trên thiết bị vẫn được giữ." }); }
      finally { if (run === revision) emit({ busy: false }); }
    },
    async toggle(product: Product, offline = false) {
      await hydrated;
      if (!actorId || disposed) throw Error("Đăng nhập để lưu món đồ.");
      if (offline) throw Error("Bạn đang offline. Kết nối mạng để thay đổi Đã lưu.");
      if (mutating) throw Error("Đang lưu thay đổi trước. Bạn chờ một chút nhé.");
      mutating = true; const run = ++revision; emit({ busy: true, error: "" });
      try {
        const saved = await api.toggle(product.id);
        if (disposed || run !== revision) return;
        emit({ favorites: saved ? [product, ...state.favorites.filter(p => p.id !== product.id)] : state.favorites.filter(p => p.id !== product.id) });
        await save();
      } finally { mutating = false; emit({ busy: false }); }
    },
    async add(product: Product) {
      await hydrated;
      if (!actorId || disposed) throw Error("Đăng nhập để dùng giỏ hàng.");
      emit({ cart: addCartItem(state.cart, product, actorId) }); await save();
    },
    async remove(id: string) { await hydrated; emit({ cart: state.cart.filter(p => p.id !== id) }); await save(); },
    async replaceCart(products: Product[]) { await hydrated; emit({ cart: products }); await save(); },
    async forgetProduct(id: string) {
      await hydrated;
      if (disposed) return;
      const run = ++revision;
      emit({ favorites: state.favorites.filter(item => item.id !== id), cart: state.cart.filter(item => item.id !== id), busy: false });
      if (await save()) await onPriceChanges?.([], () => !disposed && run === revision, state.favorites);
    },
    dispose() { disposed = true; revision++; listeners.clear(); },
  };
}
