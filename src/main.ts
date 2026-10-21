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

// iOS Safari ignores user-scalable=no, so stop pinch zoom here (double-tap zoom is off via touch-action in the CSS).
for (const ev of ['gesturestart', 'gesturechange']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });

const state = new GameState();
const hadSave = state.load();
initAudio();
setMuted(state.muted);
setVolumes(state.sfxVolume, state.musicVolume);
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
if (offline) ui.showOffline(offline);

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
  const report = state.applyOffline((Date.now() - state.lastSeen) / 1000);
  state.lastSeen = Math.max(state.lastSeen, Date.now());
  if (report) {
    ui.showOffline(report);
    scene()?.restart();
  }
});

const account = new Account(state, (data) => {
  GameState.frozen = true;
  GameState.writeLocal(data);
  location.reload();
});
new Guild(state, account, ui);
new Social(state, account);
ui.setPvpServer(new ColosseumLink(state, account));

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
