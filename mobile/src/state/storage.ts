export type Storage = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<unknown> };
// Serialize writes: a slow older write must not overwrite the most recent state.
export function writer(storage: Storage, key: string) {
  let queue: Promise<unknown> = Promise.resolve();
  return (value: unknown) => {
    const json = JSON.stringify(value);
    const next = queue.catch(() => {}).then(() => storage.setItem(key, json));
    queue = next;
    return next;
  };
}
export function parseCache(raw: string | null): unknown { try { return JSON.parse(raw || "null"); } catch { return null; } }
