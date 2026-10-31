import Phaser from 'phaser';
import './style.css';
import { BattleScene, WIDTH, HEIGHT } from './BattleScene';
import { GameState } from './state';
import { UI } from './ui';
import { initAudio, setMuted, setVolumes } from './sfx';
import { Music } from './music';
import { Account } from './account';
import { Guild } from './guild';
import { Social } from './social';
import { ColosseumLink } from './colosseumLink';
import { Tutorial } from './tutorial';
import { initInstall } from './install';
import { watchTaps } from './taps';
import { colosseumNews, eventNews, defenseNews, type WelcomeSection } from './welcome';

// iOS Safari ignores user-scalable=no, so stop pinch zoom here (double-tap zoom is off via touch-action in the CSS).
for (const ev of ['gesturestart', 'gesturechange']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
// Hold off re-rendering whatever is under a finger, so taps aren't lost (src/taps.ts).
watchTaps(window);

const state = new GameState();
(window as any).__s = state;
const hadSave = state.load();
initAudio();
setMuted(state.muted);
setVolumes(state.sfxVolume, state.musicVolume);
// When the game last ran, for the "While you were away" news (src/welcome.ts).
let awayFrom = state.lastSeen;
const offline = hadSave ? state.applyOffline((Date.now() - state.lastSeen) / 1000) : null;
// That time is paid; move the mark now so a quick hide/show can't pay it twice.
state.lastSeen = Math.max(state.lastSeen, Date.now());

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: WIDTH,
  height: HEIGHT,
  pixelArt: true,
  backgroundColor: '#000000',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
});
game.scene.add('battle', BattleScene, true, { state });

const scene = () => game.scene.getScene('battle') as BattleScene | undefined;
new Music(() => scene()?.musicMood() ?? 'field');

const ui = new UI(state, scene, {
  simulateAway: () => {
    const report = state.applyOffline(3600);
    if (report) ui.showOffline(report);
    scene()?.restart();
    state.save();
  },
  rekindle: (mult: number) => {
    const result = state.rekindle(mult);
    if (result) {
      scene()?.restart();
      ui.showRekindled(result);
    }
  },
  resetAccount: async () => {
    // Freezes saving (here and in cloud uploads) so the reset sticks.
    const error = await account.reset();
    if (!error) location.reload();
    return error;
  },
});
/** What happened since `from`: Colosseum rewards (paid now) and events that started or ended. */
const awayNews = (from: number): WelcomeSection[] => [
  { title: 'Colosseum', lines: colosseumNews(state, Date.now()) },
  { title: 'Events', lines: eventNews(state, from, Date.now()) },
];
/** Seen once Collect is tapped, so the Colosseum page doesn't repeat them. */
const seenNews = () => {
  state.pvp.notes = [];
  state.save();
};
if (hadSave) ui.showWelcome(offline, awayNews(awayFrom), seenNews);

// GameState.frozen is set once the page is about to reload with a different save, so nothing overwrites it.
const save = () => state.save();
setInterval(save, 5000);
window.addEventListener('pagehide', save);

// The browser pauses the game in a background tab, so treat hidden time as offline time.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    save();
    return;
  }
  // Saves while hidden leave lastSeen alone, so this is the whole time away.
  awayFrom = state.lastSeen;
  const report = state.applyOffline((Date.now() - state.lastSeen) / 1000);
  state.lastSeen = Math.max(state.lastSeen, Date.now());
  if (report) scene()?.restart();
  ui.showWelcome(report, awayNews(awayFrom), seenNews);
  void showDefense(awayFrom);
});

const account = new Account(state, (data) => {
  GameState.frozen = true;
  GameState.writeLocal(data);
  location.reload();
});
account.listeners.push(() => ui.setAdmin(account.isAdmin));
new Guild(state, account, ui);
new Social(state, account);
const pvpLink = new ColosseumLink(state, account);
ui.setPvpServer(pvpLink);

/** Fights against this player's defense team since `from`, added to the pop-up once the log loads (signed in only). */
async function showDefense(from: number) {
  if (!pvpLink.online || !state.pvpOpen() || Date.now() - from < 60_000) return;
  const board = await pvpLink.board().catch(() => null);
  if (board) ui.addWelcomeNews({ title: 'Colosseum defense', lines: defenseNews(board.log, from) });
}
// Sign-in finishes after the page opens, so look at the defense log once it has.
let defenseChecked = !hadSave;
account.listeners.push(() => {
  if (defenseChecked || !pvpLink.online) return;
  defenseChecked = true;
  void showDefense(awayFrom);
});

const tutorial = new Tutorial(state);
document.getElementById('tut-replay')!.addEventListener('click', () => {
  document.getElementById('settings')!.hidden = true;
  const home = document.getElementById('home-btn')!;
  if (!home.hidden) home.click();
  tutorial.replay();
});

initInstall();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
