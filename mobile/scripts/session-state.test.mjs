import test from "node:test";
import assert from "node:assert/strict";
import { createSessionState } from "../src/api/session-state.ts";

const token = (char) => `sangtay_session=${char.repeat(64)}`;
function fixture(initial = null) {
  let stored = initial,
    removals = 0;
  const state = createSessionState({
    read: async () => stored,
    write: async (value) => {
      stored = value;
    },
    remove: async () => {
      removals++;
      stored = null;
    },
  });
  return { state, stored: () => stored, removals: () => removals };
}
test("expired session is removed from memory and disk, notifying subscribers immediately", async () => {
  const f = fixture(token("a"));
  await f.state.restore();
  let notifications = 0;
  const off = f.state.subscribe(() => {
    notifications++;
    assert.equal(f.state.snapshot().cookie, null);
  });
  assert.equal(await f.state.expire(f.state.snapshot()), true);
  assert.equal(f.stored(), null);
  assert.equal(notifications, 1);
  assert.equal(await f.state.restore(), false);
  off();
});
test("parallel unauthorized responses expire a session and notify only once", async () => {
  const f = fixture();
  await f.state.save(token("a"));
  const previous = f.state.snapshot();
  let notifications = 0;
  f.state.subscribe(() => notifications++);
  assert.deepEqual(
    await Promise.all([f.state.expire(previous), f.state.expire(previous)]),
    [true, false],
  );
  assert.equal(notifications, 1);
  assert.equal(f.removals(), 1);
});
test("a late 401 cannot remove a new login, including a reissued identical cookie", async () => {
  for (const next of [token("b"), token("a")]) {
    const f = fixture();
    await f.state.save(token("a"));
    const old = f.state.snapshot();
    await f.state.save(next);
    assert.equal(await f.state.expire(old), false);
    assert.equal(f.state.snapshot().cookie, next);
    assert.equal(f.stored(), next);
    assert.equal(f.removals(), 0);
  }
});
test("a pending secure-store deletion finishes before writing the next login", async () => {
  let stored = token("a"),
    release;
  const block = new Promise((resolve) => {
    release = resolve;
  });
  const state = createSessionState({
    read: async () => stored,
    write: async (value) => {
      stored = value;
    },
    remove: async () => {
      await block;
      stored = null;
    },
  });
  await state.restore();
  const expired = state.expire(state.snapshot());
  const saving = state.save(token("b"));
  assert.equal(state.snapshot().cookie, token("b"));
  release();
  await Promise.all([expired, saving]);
  assert.equal(stored, token("b"));
  assert.equal(state.snapshot().cookie, token("b"));
});
test("an old startup restore cannot resurrect a session after local logout", async () => {
  let release;
  const block = new Promise((resolve) => {
    release = resolve;
  });
  const state = createSessionState({
    read: async () => {
      await block;
      return token("a");
    },
    write: async () => {},
    remove: async () => {},
  });
  const restoring = state.restore();
  const clearing = state.clear();
  release();
  assert.equal(await restoring, false);
  await clearing;
  assert.equal(state.snapshot().cookie, null);
});
test("expired memory and UI are cleared even when secure storage deletion fails", async () => {
  const warning = console.warn;
  let notifications = 0;
  console.warn = () => {};
  try {
    const state = createSessionState({
      read: async () => token("a"),
      write: async () => {},
      remove: async () => {
        throw Error("keystore unavailable");
      },
    });
    await state.restore();
    state.subscribe(() => notifications++);
    assert.equal(await state.expire(state.snapshot()), true);
    assert.equal(state.snapshot().cookie, null);
    assert.equal(notifications, 1);
  } finally {
    console.warn = warning;
  }
});
test("public unauthenticated errors do not generate a session-expired event", async () => {
  const f = fixture();
  let notifications = 0;
  f.state.subscribe(() => notifications++);
  assert.equal(await f.state.expire(f.state.snapshot()), false);
  assert.equal(notifications, 0);
  assert.equal(f.removals(), 0);
});
test("unsubscribe prevents updates to an unmounted session provider", async () => {
  const f = fixture();
  await f.state.save(token("a"));
  let notifications = 0;
  const off = f.state.subscribe(() => notifications++);
  off();
  await f.state.expire(f.state.snapshot());
  assert.equal(notifications, 0);
});
