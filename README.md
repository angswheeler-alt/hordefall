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
- Hero Chest (30 Gems) gives Hero Crests (medals) for 3 random heroes. Heroes unlock at 1★ and Crests evolve them up to 8★ (1★→2★ 10, then 50, 250, 600, 1,500, 2,500 and 5,000 for 7★→8★): each star doubles stats; 2★/3★ unlock two skills, 4★ boosts the Ultimate to 60x, 5★ unlocks a team aura. Gems come from a 60-Gem start, bosses (20), every 10th new stage (5) and gold chests (5).
- Big numbers use break_infinity.js. Saves to localStorage, and signed-in players also sync to the cloud (see Online accounts).

- Relics tab: ten relics crafted and upgraded with Trial Essence (two kinds each). Equipped relics boost all heroes' ATK or HP, a single element's ATK, gold from enemies, Stall income, or Trial damage. Levels 1-10 in each of five tiers; the cost doubles every two levels and the step into a new tier costs three times as much. Two slots to start, up to four more for 150 / 300 / 600 / 1,200 Gems. Relics stay through Rekindle.

## Run

    npm install
    npm run dev      # http://localhost:5173
    npm run build    # static build in dist/

Stack: Phaser 3 + TypeScript + Vite. Lane in Phaser, menus in HTML/CSS. Balance knobs live in `src/formulas.ts`.
- Bottom tab bar like the original: Heroes (wood-styled hero rows with Level Up buttons, Manage Team, Hero Chest and Collection), Market Row, Relics, Battle (Trials and run stats), Shop (Hero Chest, free Gems) and Guild. Guild is a placeholder for now.
- Market Row tab: ten Stalls (Bakery to Star Bazaar) opened and upgraded with gold. Each fills a bar on a timer; tap to collect until level 50, then it collects itself (also while offline). Income x3 every 50 Stall levels. Stalls reset on Rekindle; each Rekindle adds +25% Stall income and +5 levels (up to 600) to auto-collect Stalls, shown on the Rekindle page. Buy x1 / x10 / max and a Level all button that spreads gold across open Stalls, cheapest level first, like on the Heroes tab.
- Manage Team (Heroes tab): choose which recruited heroes fight (up to 5). Taking a hero out drops them to gold level 1 and refunds that gold; their Ember levels stay (Embers also count in Trials and PvP).
- Elemental Trials (Battle tab): one dungeon per element on a weekly schedule (Dark Mon/Fri/Sun, Light Tue/Thu/Sat, Earth Tue/Thu/Sun, Water Wed/Fri/Sun, Fire Mon/Wed/Sat), 26 levels unlocked one by one (Samuel's table: Essence 20 doubling each level, difficulty 1 to 3,600, from level 10 a requirement of N heroes at an Ember level, e.g. 2x100 up to 5x4000), up to 20 tickets at one per 30 minutes (a loss keeps the ticket). Trials use Ember levels and stars only, not gold levels. Wins drop that element's Essence (for Relics later) and a medal (1 Hero Crest) for a random hero of that element, or for two random heroes from level 16.

## Online accounts

Accounts and cloud saves use [Supabase](https://supabase.com). Without keys the game runs as before, with local saves only.

1. Create a free Supabase project.
2. In the SQL editor, run `supabase/setup.sql` once. It creates the `saves` table with row-level security, so each player can only read and write their own save.
3. Under Authentication > Sign In / Providers > Email, switch off **Confirm email**. Players use a username, which the game turns into a placeholder login address that never receives mail.
4. Put the project URL and the anon public key in `src/config.ts`. Both are meant to be public; the security rules do the protecting.

Players sign in from the Account section in Settings (gear at the top right of the map) with a username and password (no email). There is no password reset yet, since there's no email to send it to. Guests keep playing locally. On the first sign-in on a device that already has progress, the player picks which save to keep. After that, the save uploads every 30 seconds and when the tab is hidden, and when the game starts the most recently played device's save wins.

Saves are trusted from the client for now, so a determined player could edit their own save. Server-side checks come with PvP and leaderboards.

## Unlocking heroes

Marin is free. Every other hero unlocks with Hero Crests (medals) from the Hero Chest and Trials, by rarity: Common 10, Rare 30, Epic 80. Legendary heroes never unlock from Crests and never drop from the Hero Chest; they only come through special means. Unlocking spends the Crests and adds the hero at level 1; gold then levels them as before.
