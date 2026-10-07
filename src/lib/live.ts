import { create } from 'zustand';

/**
 * Auto-refresh. The database keeps a counter that every write bumps
 * (app_state.version). While the app is visible we ask for it every
 * POLL_MS — one tiny request — and when it moved, `tick` increments.
 * Pages put `tick` in their load effect's dependencies, so they reload
 * only when something actually changed.
 */

const POLL_MS = 15_000;

export const useLive = create<{ tick: number }>(() => ({ tick: 0 }));

/** Increments whenever another device (or this one) changed data. */
export const useLiveTick = () => useLive((s) => s.tick);

let lastVersion: number | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let running = false;
let inFlight = false;

async function check() {
  if (!running || inFlight || document.hidden) return;
  inFlight = true;
  try {
    const version: number = await window.api.sync.version();
    if (lastVersion !== null && version !== lastVersion) useLive.setState((s) => ({ tick: s.tick + 1 }));
    lastVersion = version;
  } catch {
    /* offline or session expired — try again next round */
  } finally {
    inFlight = false;
  }
}

function schedule() {
  if (timer) clearTimeout(timer);
  if (!running) return;
  timer = setTimeout(async () => {
    await check();
    schedule();
  }, POLL_MS);
}

/** Back on the app (phone unlocked, tab re-selected, network back): check right away. */
function onWake() {
  if (document.hidden) return;
  check();
  schedule();
}

export function startLiveSync() {
  if (running) return;
  running = true;
  lastVersion = null;
  check();
  schedule();
  document.addEventListener('visibilitychange', onWake);
  window.addEventListener('focus', onWake);
  window.addEventListener('online', onWake);
}

export function stopLiveSync() {
  running = false;
  if (timer) clearTimeout(timer);
  timer = null;
  document.removeEventListener('visibilitychange', onWake);
  window.removeEventListener('focus', onWake);
  window.removeEventListener('online', onWake);
}
