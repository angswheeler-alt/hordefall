/**
 * Settings > Phone app: put the game on the home screen like an app.
 * Chrome / Edge / Android hand us an install prompt; iPhone and iPad need the Share menu.
 */
interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallHow = 'installed' | 'prompt' | 'ios' | 'menu';

/** How this browser can install the game. */
export function installHow(env: { standalone: boolean; prompt: boolean; ua: string; touchMac: boolean }): InstallHow {
  if (env.standalone) return 'installed';
  if (env.prompt) return 'prompt';
  // iPadOS reports itself as a Mac, so a Mac with a touch screen is an iPad.
  if (/iPhone|iPad|iPod/.test(env.ua) || env.touchMac) return 'ios';
  return 'menu';
}

export const INSTALL_NOTES: Record<Exclude<InstallHow, 'prompt'>, string> = {
  installed: 'Installed. Open Hordefall from your home screen.',
  ios: 'In Safari, tap Share (the square with an arrow), then Add to Home Screen.',
  menu: 'Open your browser menu and pick Install app or Add to Home screen.',
};

export function initInstall() {
  let deferred: InstallPrompt | null = null;
  const btn = document.getElementById('install-btn') as HTMLButtonElement;
  const note = document.getElementById('install-note')!;
  const how = () =>
    installHow({
      standalone: matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true,
      prompt: !!deferred,
      ua: navigator.userAgent,
      touchMac: /Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1,
    });
  const render = (showNote = false) => {
    const h = how();
    btn.hidden = h === 'installed';
    note.hidden = !(h === 'installed' || showNote);
    if (h !== 'prompt') note.textContent = INSTALL_NOTES[h];
  };
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPrompt;
    render();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    note.textContent = INSTALL_NOTES.installed;
    btn.hidden = true;
    note.hidden = false;
  });
  btn.addEventListener('click', async () => {
    if (!deferred) return render(true);
    const p = deferred;
    deferred = null;
    await p.prompt().catch(() => {});
    const choice = await p.userChoice.catch(() => null);
    if (choice?.outcome !== 'accepted') render();
  });
  render();
}
