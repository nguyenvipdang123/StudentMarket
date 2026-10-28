import type { Product } from "../api/types.ts";
import { parseCache, writer, type Storage } from "./storage.ts";
export type PriceChange = { id: string; title: string; before: number; after: number };
export function priceChanges(previous: Product[], current: Product[]): PriceChange[] {
  const prices = new Map(previous.map(p => [p.id, p.price]));
  return current.flatMap(p => {
    const before = prices.get(p.id);
    return before !== undefined && Number.isFinite(before) && Number.isFinite(p.price) && p.price >= 0 && p.price !== before
      ? [{ id: p.id, title: p.title, before, after: p.price }] : [];
  });
}
export type NotificationDevice = {
  supported: boolean;
  permission(request: boolean): Promise<boolean>;
  present(identifier: string, change: PriceChange): Promise<void>;
  clear(scope: string): Promise<void>;
};
export function createPriceAlerts(storage: Storage, key: string, scope: string, device: NotificationDevice) {
  let state = { enabled: false, ready: false, busy: false, error: "", supported: device.supported };
  let active = true, generation = 0, sequence = 0;
  const listeners = new Set<() => void>(), persist = writer(storage, key);
  const emit = (patch: Partial<typeof state>) => { if (active) { state = { ...state, ...patch }; listeners.forEach(fn => fn()); } };
  const hydrated = (async () => {
    try { const saved = parseCache(await storage.getItem(key)) as { enabled?: boolean } | null; emit({ enabled: saved?.enabled === true && device.supported }); }
    catch { emit({ error: "Chưa đọc được cài đặt thông báo." }); }
    emit({ ready: true });
  })();
  return {
    getSnapshot: () => state,
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    activate() { active = true; },
    async setEnabled(enabled: boolean) {
      await hydrated;
      if (!active || state.busy) return;
      const run = ++generation;
      emit({ busy: true, error: "" });
      try {
        if (enabled && (!device.supported || !await device.permission(true))) {
          emit({ enabled: false, error: device.supported ? "Chưa được cấp quyền thông báo. Bạn có thể bật trong Cài đặt của điện thoại." : "Thông báo cục bộ cần Expo Go trên Android/iOS, không hỗ trợ bản web." });
          return;
        }
        if (!active || run !== generation) return;
        await persist({ enabled });
        if (!active || run !== generation) return;
        emit({ enabled });
        if (!enabled) await device.clear(scope);
      } catch { emit({ error: "Chưa lưu được cài đặt hoặc tạo thông báo. Bạn thử lại nhé." }); }
      finally { emit({ busy: false }); }
    },
    async notify(changes: PriceChange[], isCurrent: () => boolean) {
      await hydrated;
      if (!active || !state.enabled || !changes.length || !isCurrent()) return;
      const run = generation;
      try {
        if (!await device.permission(false)) { emit({ error: "Quyền thông báo đang tắt. Bật lại trong Cài đặt để nhận báo đổi giá." }); return; }
        for (const change of changes) {
          if (!active || !state.enabled || run !== generation || !isCurrent()) break;
          await device.present(`${scope}${Date.now()}-${++sequence}`, change);
          if (!active || !state.enabled || run !== generation || !isCurrent()) { await device.clear(scope); break; }
        }
      } catch { emit({ error: "Giá đã cập nhật nhưng chưa hiển thị được thông báo cục bộ." }); }
    },
    dispose() { active = false; generation++; listeners.clear(); void device.clear(scope).catch(() => {}); },
  };
}
