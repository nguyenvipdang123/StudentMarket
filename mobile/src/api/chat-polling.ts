/** Serial polling: leaving the screen/background invalidates pending UI results. */
export function createChatPoller(
  work: (isCurrent: () => boolean) => Promise<boolean | void>,
  interval: number,
  clock = {
    setTimeout: (callback: () => void, delay: number) => setTimeout(callback, delay),
    clearTimeout: (handle: ReturnType<typeof setTimeout>) => clearTimeout(handle),
  },
) {
  let active = false, disposed = false, running = false, generation = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  function clearTimer() { if (timer !== undefined) clock.clearTimeout(timer); timer = undefined; }
  async function tick() {
    if (!active || disposed || running) return;
    const run = generation;
    running = true;
    let repeat: boolean | void = true;
    try { repeat = await work(() => active && !disposed && run === generation); }
    catch { /* Each screen owns its visible error; keep the scheduler alive. */ }
    finally {
      running = false;
      if (active && !disposed) {
        if (run !== generation) void tick();
        else if (repeat !== false) timer = clock.setTimeout(() => void tick(), interval);
      }
    }
  }
  return {
    resume() { if (disposed || active) return; active = true; void tick(); },
    pause() { active = false; generation++; clearTimer(); },
    refresh() { clearTimer(); void tick(); },
    dispose() { active = false; disposed = true; generation++; clearTimer(); },
  };
}
