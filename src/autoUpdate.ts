// Auto update: a tab left open keeps running the build it loaded, so a player could stay on an
// old version for days (a stale leaderboard came from that). Every few minutes, and whenever the
// game comes back into view, ask the server for index.html and compare its game script with the
// one running. When a new build is out, wait until the player is resting on the main stage screen
// (home panel, normal stage run, nothing open, no touch for a while), then save and reload, so the
// new version starts with the same save and never cuts into a menu, Trial, fight or purchase.

const CHECK_MS = 5 * 60_000;
/** How long the player must leave the game alone before it restarts itself. */
export const IDLE_MS = 60_000;
/** How often a waiting update looks again for a quiet moment. */
const WAIT_MS = 5_000;

/** The built game script's file name in a page's HTML (Vite gives it a new hashed name per build). */
export function builtScript(html: string): string | null {
  const m = html.match(/<script[^>]*type="module"[^>]*src="([^"]*assets\/[^"]+\.js)"/) ?? html.match(/<script[^>]*src="([^"]*assets\/[^"]+\.js)"[^>]*type="module"/);
  return m ? m[1].split('/').pop()! : null;
}

/** True when the running build and the server's differ (and both are known). */
export function isNewBuild(running: string | null, served: string | null): boolean {
  return !!running && !!served && running !== served;
}

/** What the screen looks like right now, for deciding whether a restart would interrupt anything. */
export interface ScreenNow {
  /** Milliseconds since the player last touched, clicked, scrolled or typed. */
  idleMs: number;
  /** The tab is in view (a hidden tab must not reload: a fresh load could take the save over from another device). */
  visible: boolean;
  /** The home panel under the battle is showing (no Heroes/Market/Battle/... tab open). */
  home: boolean;
  /** A Trial, Colosseum, Guild Boss, Rush or Scouting fight is on the lane. */
  inFight: boolean;
  /** Any dialog or full-screen page is open (Settings, a hero, a purchase, chat, the tutorial...). */
  overlayOpen: boolean;
}

/** Restart only when the player is resting on the main stage screen with nothing open. */
export function quietMoment(s: ScreenNow): boolean {
  return s.visible && s.home && !s.inFight && !s.overlayOpen && s.idleMs >= IDLE_MS;
}

/** Page parts outside #app that are always there and never mean "something is open". */
const ALWAYS_ON = new Set(['app', 'test-banner']);

function overlayOpen(): boolean {
  for (const el of Array.from(document.body.children)) {
    if (!(el instanceof HTMLElement) || el.tagName === 'SCRIPT' || ALWAYS_ON.has(el.id)) continue;
    if (el.hidden || el.style.visibility === 'hidden' || el.style.display === 'none') continue;
    return true;
  }
  return false;
}

function screenNow(lastInput: number): ScreenNow {
  return {
    idleMs: Date.now() - lastInput,
    visible: !document.hidden,
    home: !!document.getElementById('home-btn')?.hidden,
    inFight: document.body.classList.contains('in-trial'),
    overlayOpen: overlayOpen(),
  };
}

export function initAutoUpdate(save: () => void) {
  const el = document.querySelector<HTMLScriptElement>('script[type="module"][src*="assets/"]');
  const running = el ? el.src.split('/').pop()!.split('?')[0] : null;
  // Dev server and the single-file preview have no hashed build to compare.
  if (!running || typeof fetch !== 'function') return;

  let lastInput = Date.now();
  const touched = () => (lastInput = Date.now());
  for (const type of ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll']) {
    document.addEventListener(type, touched, { capture: true, passive: true });
  }

  let pending = false;
  const tryReload = () => {
    if (!quietMoment(screenNow(lastInput))) return;
    save();
    location.reload();
  };

  let busy = false;
  const check = async () => {
    if (busy || pending) return;
    busy = true;
    try {
      const res = await fetch(`./?fresh=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return;
      if (!isNewBuild(running, builtScript(await res.text()))) return;
      // New version out: from now on just wait for a quiet moment on the stage screen.
      pending = true;
      setInterval(tryReload, WAIT_MS);
      tryReload();
    } catch {
      // Offline: keep playing this version.
    } finally {
      busy = false;
    }
  };
  setInterval(() => void check(), CHECK_MS);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void check();
  });
}
