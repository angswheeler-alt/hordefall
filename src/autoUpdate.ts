// Auto update: a tab left open keeps running the build it loaded, so a player could stay on an
// old version for days (a stale leaderboard came from that). Every few minutes, and whenever the
// game comes back into view, ask the server for index.html and compare its game script with the
// one running. When they differ, save and reload, so the new version starts with the same save.

const CHECK_MS = 5 * 60_000;

/** The built game script's file name in a page's HTML (Vite gives it a new hashed name per build). */
export function builtScript(html: string): string | null {
  const m = html.match(/<script[^>]*type="module"[^>]*src="([^"]*assets\/[^"]+\.js)"/) ?? html.match(/<script[^>]*src="([^"]*assets\/[^"]+\.js)"[^>]*type="module"/);
  return m ? m[1].split('/').pop()! : null;
}

/** True when the running build and the server's differ (and both are known). */
export function isNewBuild(running: string | null, served: string | null): boolean {
  return !!running && !!served && running !== served;
}

export function initAutoUpdate(save: () => void) {
  const el = document.querySelector<HTMLScriptElement>('script[type="module"][src*="assets/"]');
  const running = el ? el.src.split('/').pop()!.split('?')[0] : null;
  // Dev server and the single-file preview have no hashed build to compare.
  if (!running || typeof fetch !== 'function') return;
  let busy = false;
  const check = async () => {
    if (busy) return;
    busy = true;
    try {
      const res = await fetch(`./?fresh=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return;
      if (!isNewBuild(running, builtScript(await res.text()))) return;
      // Never reload under an open dialog (a save choice or a purchase); try again next time.
      const modal = document.getElementById('modal');
      if (modal && !modal.hidden) return;
      save();
      location.reload();
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
