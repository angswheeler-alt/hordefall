# Hordefall

Web-first idle RPG prototype (see the game design doc). This build covers the core loop only:

- Five heroes (Marin, Bramble, Pyra, Nox, Solenne) auto-fight down a lane toward the enemy crystal.
- Gold from kills, stage clears and drifting chests; spend it to recruit and level heroes (x1 / x10 / max).
- Stats double every 20 levels. Type chart from the original game: Water > Fire > Earth > Water deal 4x; Light and Dark deal 2x to each other. Each element deals 0.5x to one element (the reverse of its matchup, or its own element for Light/Dark) and 1x to the rest.
- A boss every 50 stages with a 30 s timer. Losing drops you back a stage to farm until you tap "Fight boss".
- Ultimates (40x damage) unlock at level 30 as a stand-in for 3 stars. 2x speed and auto-ult toggles.
- Offline earnings for up to 12 hours: gold at your recent rate, plus stages up to the next boss.
- Rekindle (prestige) unlocks after clearing stage 125: reset to stage 1 and gold level 1 for Embers (40 at stage 126, +6% per stage beyond). Embers buy Ember levels that add to a hero's gold level and stay through Rekindle; they stay on the hero for good. The Rekindle button opens a rewards page: Embers with the stage and player-level bonuses, a locked Market Row section, the 16-slot Rekindle Wheel (a slot every 50 best stages from 150, 50 Gems each), the player level bar (lifetime Embers; +10% Embers per level) and Rekindle / 2x for 80 Gems / 3x for 160 Gems.
- Balance: the stage 100 boss needs a lead hero around level 100 (gold + Ember). Bosses are weak to Water until stage 600; from there each 100th-stage boss is weak to a rotating element: Water 600, Earth 700, Fire 800, Light 900, Dark 1000, then repeating.
- Hero Chest (30 Gems) gives Hero Crests for 3 random heroes and recruits new ones. Crests evolve heroes up to 7 stars: each star doubles stats; 1★/2★ unlock two skills, 3★ boosts the Ultimate to 60x, 4★ unlocks a team aura. Gems come from a 60-Gem start, bosses (20), every 10th new stage (5) and gold chests (5).
- Big numbers use break_infinity.js. Saves to localStorage (server saves come later).

## Run

    npm install
    npm run dev      # http://localhost:5173
    npm run build    # static build in dist/

Stack: Phaser 3 + TypeScript + Vite. Lane in Phaser, menus in HTML/CSS. Balance knobs live in `src/formulas.ts`.
- Bottom tab bar like the original: Heroes (wood-styled hero rows with Level Up buttons, Manage Team, Hero Chest and Collection), Market Row, Relics, Battle (run stats and prototype tools), Shop (Hero Chest, free Gems) and Guild. Market Row, Relics and Guild are placeholders for now.
- Market Row tab: ten Stalls (Bakery to Star Bazaar) opened and upgraded with gold. Each fills a bar on a timer; tap to collect until level 50, then it collects itself (also while offline). Income x3 every 50 Stall levels. Stalls reset on Rekindle; each Rekindle adds +25% Stall income and +5 levels (up to 600) to auto-collect Stalls, shown on the Rekindle page.
- Manage Team (Heroes tab): choose which recruited heroes fight (up to 5). Taking a hero out drops them to gold level 1 and refunds that gold; their Ember levels stay (Embers also count in Trials and PvP).
