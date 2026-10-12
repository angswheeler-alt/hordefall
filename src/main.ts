import Phaser from 'phaser';
import './style.css';
import { BattleScene, WIDTH, HEIGHT } from './BattleScene';
import { GameState } from './state';
import { UI } from './ui';

const state = new GameState();
const hadSave = state.load();
const offline = hadSave ? state.applyOffline((Date.now() - state.lastSeen) / 1000) : null;

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

const ui = new UI(state, scene, {
  simulateAway: () => {
    const report = state.applyOffline(3600);
    if (report) ui.showOffline(report);
    scene()?.restart();
    state.save();
  },
  wipe: () => {
    GameState.wipe();
    // Skip the unload save so the wipe sticks.
    window.removeEventListener('pagehide', save);
    location.reload();
  },
});
if (offline) ui.showOffline(offline);

const save = () => state.save();
setInterval(save, 5000);
window.addEventListener('pagehide', save);

// The browser pauses the game in a background tab, so treat hidden time as offline time.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    state.save();
    return;
  }
  const report = state.applyOffline((Date.now() - state.lastSeen) / 1000);
  state.lastSeen = Date.now();
  if (report) {
    ui.showOffline(report);
    scene()?.restart();
  }
});

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
