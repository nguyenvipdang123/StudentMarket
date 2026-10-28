import type { Product } from "../api/types.ts";
import { parseCache, writer, type Storage } from "./storage.ts";
export type PriceChange = { id: string; title: string; before: number; after: number };
type PendingAlert = { identifier: string; change: PriceChange };
function isPendingAlert(value: unknown, scope: string): value is PendingAlert {
  const item = value as PendingAlert | null, change = item?.change;
  return !!item && typeof item.identifier === "string" && item.identifier.startsWith(scope) && !!change &&
    typeof change.id === "string" && typeof change.title === "string" &&
    Number.isFinite(change.before) && change.before >= 0 && Number.isFinite(change.after) && change.after >= 0;
}
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
  let enabled = false, pending: PendingAlert[] = [], notificationWork = Promise.resolve();
  const listeners = new Set<() => void>(), persist = writer(storage, key);
  const emit = (patch: Partial<typeof state>) => { if (active) { state = { ...state, ...patch }; listeners.forEach(fn => fn()); } };
  const save = () => persist({ enabled, sequence, pending });
  const hydrated = (async () => {
    try {
      const saved = parseCache(await storage.getItem(key)) as { enabled?: boolean; sequence?: number; pending?: unknown[] } | null;
      enabled = saved?.enabled === true && device.supported;
      sequence = typeof saved?.sequence === "number" && Number.isSafeInteger(saved.sequence) && saved.sequence >= 0 ? saved.sequence : 0;
      pending = enabled && Array.isArray(saved?.pending) ? saved.pending.filter(item => isPendingAlert(item, scope)) : [];
      emit({ enabled });
    }
    catch { emit({ error: "Chưa đọc được cài đặt thông báo." }); }
    emit({ ready: true });
  })();
  return {
    getSnapshot: () => state,
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    activate() { active = true; },
    async setEnabled(nextEnabled: boolean) {
      await hydrated;
      if (!active || state.busy) return;
      const run = ++generation;
      emit({ busy: true, error: "" });
      try {
        const granted = !nextEnabled || device.supported && await device.permission(true);
        if (!active || run !== generation) return;
        if (!granted) {
          enabled = false; pending = [];
          await save();
          if (!active || run !== generation) return;
          emit({ enabled: false, error: device.supported ? "Chưa được cấp quyền thông báo. Bạn có thể bật trong Cài đặt của điện thoại." : "Thông báo cục bộ cần Expo Go trên Android/iOS, không hỗ trợ bản web." });
          return;
        }
        if (!active || run !== generation) return;
        // Disable immediately, so an in-flight presentation cannot enqueue a retry.
        if (!nextEnabled) pending = [];
        enabled = nextEnabled;
        await save();
        if (!active || run !== generation) return;
        emit({ enabled: nextEnabled });
        if (!nextEnabled) await device.clear(scope);
      } catch { emit({ error: "Chưa lưu được cài đặt hoặc tạo thông báo. Bạn thử lại nhé." }); }
      finally { emit({ busy: false }); }
    },
    notify(changes: PriceChange[], isCurrent: () => boolean, favorites?: Product[]) {
      const run = generation;
      const current = () => active && enabled && run === generation && isCurrent();
      // Serialize refreshes: only one delivery attempt per queued identifier at a time.
      const work = notificationWork.then(async () => {
        await hydrated;
        if (!current()) return;
        try {
          if (favorites) {
            const ids = new Set(favorites.map(product => product.id));
            pending = pending.filter(item => ids.has(item.change.id));
          }
          pending.push(...changes.map(change => ({ identifier: `${scope}${Date.now()}-${++sequence}`, change })));
          // Keep failures across refreshes/restarts, even after the price baseline moved.
          await save();
          if (!current()) return;
          if (!pending.length) { emit({ error: "" }); return; }
          const granted = await device.permission(false);
          if (!current()) return;
          if (!granted) { emit({ error: "Quyền thông báo đang tắt. Bật lại trong Cài đặt để nhận báo đổi giá." }); return; }
          for (const item of [...pending]) {
            if (!current()) break;
            await device.present(item.identifier, item.change);
            if (!active || !enabled || run !== generation) { await device.clear(scope); break; }
            pending = pending.filter(queued => queued.identifier !== item.identifier);
            await save();
          }
          if (current() && !pending.length) emit({ error: "" });
        } catch { if (current()) emit({ error: "Giá đã cập nhật nhưng chưa hiển thị được thông báo. App sẽ thử lại khi làm mới Đã lưu." }); }
      });
      notificationWork = work.catch(() => {});
      return work;
    },
    dispose() {
      active = false; generation++; pending = []; listeners.clear();
      void hydrated.then(() => { pending = []; return save(); }).catch(() => {});
      void device.clear(scope).catch(() => {});
    },
  };
}
