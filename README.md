# Hordefall

Web-first idle RPG prototype (see the game design doc). This build covers the core loop only:

- Five heroes (Marin, Bramble, Pyra, Nox, Solenne) auto-fight down a lane toward the enemy crystal.
- Gold from kills, stage clears and drifting chests; spend it to recruit and level heroes (x1 / x10 / max).
- Stats double every 20 levels. Element advantage: Fire > Earth > Water > Fire (4x), Light <-> Dark (2x).
- A boss every 50 stages with a 30 s timer. Losing drops you back a stage to farm until you tap "Fight boss".
- Ultimates (40x damage) unlock at level 30 as a stand-in for 3 stars. 2x speed and auto-ult toggles.
- Offline earnings for up to 12 hours: gold at your recent rate, plus stages up to the next boss.
- Rekindle (prestige) unlocks after clearing stage 130: reset to stage 1 and gold level 1 for Embers (40 at stage 131, +6% per stage beyond). Embers buy permanent Ember levels that add to a hero's gold level.
- Hero Chest (30 Gems) gives Hero Crests for 3 random heroes and recruits new ones. Crests evolve heroes up to 7 stars: each star doubles stats; 1★/2★ unlock two skills, 3★ boosts the Ultimate to 60x, 4★ unlocks a team aura. Gems come from a 60-Gem start, bosses (20), every 10th new stage (5) and gold chests (5).
- Big numbers use break_infinity.js. Saves to localStorage (server saves come later).

## Run

    npm install
    npm run dev      # http://localhost:5173
    npm run build    # static build in dist/

Stack: Phaser 3 + TypeScript + Vite. Lane in Phaser, menus in HTML/CSS. Balance knobs live in `src/formulas.ts`.
