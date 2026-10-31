/**
 * Installed iPhone app (Add to Home Screen): some iOS versions give the page a viewport that is
 * shorter than the screen, so a band of empty background shows under the bottom tab bar (user
 * report 2026-10-31, gap about the height of the status bar): 100dvh fills the screen but position:
 * fixed anchors to the shorter innerHeight. We detect that band and the CSS pins the tab bar to the
 * bottom of #app instead. Browsers and other phones get 0 and nothing changes.
 */
export function screenGap(screenHeight: number, innerHeight: number, standalone: boolean, portrait: boolean): number {
  if (!standalone || !portrait) return 0;
  const gap = Math.round(screenHeight - innerHeight);
  // Only a band the size of a status bar or home bar; anything else is a real layout we leave alone.
  return gap >= 10 && gap <= 120 ? gap : 0;
}

export function watchScreenGap(win: Window = window) {
  const nav = win.navigator as Navigator & { standalone?: boolean };
  const apply = () => {
    const standalone = nav.standalone === true || win.matchMedia?.('(display-mode: standalone)').matches === true;
    const portrait = win.innerHeight > win.innerWidth;
    // screen.height is the full portrait height on iPhone.
    const gap = screenGap(Math.max(win.screen.height, win.screen.width), win.innerHeight, standalone && /iPhone|iPad|iPod/.test(nav.userAgent), portrait);
    const root = win.document.documentElement;
    root.style.setProperty('--screen-gap', `${gap}px`);
    root.classList.toggle('screen-gap', gap > 0);
  };
  apply();
  win.addEventListener('resize', apply);
  win.addEventListener('orientationchange', () => setTimeout(apply, 300));
}
