import { sessionCookie } from "./policy.ts";

type Storage = {
  read: () => Promise<string | null>;
  write: (cookie: string) => Promise<void>;
  remove: () => Promise<void>;
};
export type SessionSnapshot = { cookie: string | null; revision: number };

/** Owns the native cookie; revisions prevent an old 401 invalidating a new login. */
export function createSessionState(storage: Storage) {
  let cookie: string | null = null;
  let revision = 0;
  let persistence: Promise<unknown> = Promise.resolve();
  const listeners = new Set<() => void>();
  function enqueue<T>(action: () => Promise<T>) {
    const task = persistence.then(action);
    persistence = task.catch(() => {});
    return task;
  }
  const snapshot = (): SessionSnapshot => ({ cookie, revision });
  const matches = (previous: SessionSnapshot) =>
    previous.revision === revision && previous.cookie === cookie;
  function clear() {
    cookie = null;
    revision++;
    return enqueue(storage.remove);
  }
  return {
    snapshot,
    matches,
    clear,
    async restore() {
      const before = revision;
      const stored = await enqueue(storage.read);
      if (revision !== before) return Boolean(cookie);
      cookie = sessionCookie(stored);
      revision++;
      if (stored && !cookie) await enqueue(storage.remove);
      return Boolean(cookie);
    },
    async save(next: string) {
      if (sessionCookie(next) !== next) throw Error("Invalid session cookie");
      cookie = next;
      const saving = ++revision;
      try {
        await enqueue(() => storage.write(next));
      } catch (error) {
        if (revision === saving) {
          cookie = null;
          revision++;
        }
        throw error;
      }
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async expire(previous: SessionSnapshot) {
      if (!previous.cookie || !matches(previous)) return false;
      // Clear memory and notify React immediately, even if the keystore is slow.
      const removing = clear();
      for (const listener of listeners) listener();
      try {
        await removing;
      } catch {
        console.warn(
          "Could not remove the expired session from secure storage.",
        );
      }
      return true;
    },
  };
}
