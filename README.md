# Hordefall

A web-first idle hero battler for phone and desktop browsers, installable as an app.

- Heroes of five elements (Water, Fire, Earth, Light, Dark) and ten Types fight down a lane toward the enemy crystal, on their own and while you're away. Water > Fire > Earth > Water deal 4x; Light and Dark deal 2x to each other.
- A boss every 50 stages; from stage 600 the element bosses Ignivar, Nerath, Tharos, Nyxara and Aureth take turns.
- Heroes level with gold, gain permanent Ember levels, unlock and evolve to 8★ with Hero Crests, and awaken with Starmotes. Legendary heroes come only from Legendary crests made by 8★ heroes.
- Rekindle resets the run for Embers; Market Row's 30 Stalls earn gold; Relics and relic sets boost the team.
- Elemental Trials, the Colosseum (async PvP), guilds, daily challenges, a login calendar, the Fortune Wheel, Recruit Trials and achievements.
- Cloud saves, profiles and leaderboards through Supabase.

## Run

    npm install
    npm run dev      # http://localhost:5173
    npm run build    # static build in dist/
    npm test         # unit tests (saves, economy, crests, relics, Rekindle); also run on every pull request

Stack: Phaser 3 + TypeScript + Vite. Lane in Phaser, menus in HTML/CSS. Balance knobs live in `src/formulas.ts`.

## Online accounts

Accounts and cloud saves use [Supabase](https://supabase.com). Without keys the game runs as before, with local saves only.

1. Create a free Supabase project.
2. In the SQL editor, run `supabase/setup.sql` once. It creates the `saves` table with row-level security, so each player can only read and write their own save. Then run `supabase/guilds.sql` once for guilds (safe to run again).
3. Under Authentication > Sign In / Providers > Email, switch off **Confirm email**. Players use a username, which the game turns into a placeholder login address that never receives mail.
4. Put the project URL and the anon public key in `src/config.ts`. Both are meant to be public; the security rules do the protecting.

Players sign in from the Account section in Settings (gear at the top right of the map) with a username and password (no email). There is no password reset yet, since there's no email to send it to. Guests keep playing locally. On the first sign-in on a device that already has progress, the player picks which save to keep. After that, the save uploads every 30 seconds and when the tab is hidden, and when the game starts the most recently played device's save wins.

Saves are trusted from the client for now, so a determined player could edit their own save. Server-side checks come with PvP and leaderboards.

## Crest drop rates

Hero Chest (30 Gems, 3 drops): each drop is Common 70%, Rare 22% or Epic 8%, then a random hero of that rarity. Crests per drop are Common 5/10/20, Rare 3/6/12, Epic 2/4/8 (60/30/10% chances). Trials give each crest to a hero of the Trial's element: Common 80%, Rare 17%, Epic 3%. Legendary heroes never drop. Rarities with no heroes yet are skipped. All numbers live in `src/data.ts`.

## Unlocking heroes

Brine is free. Every other hero unlocks with Hero Crests from the Hero Chest and Trials, by rarity: Common 10, Rare 30, Epic 80. Legendary heroes never unlock from Crests and never drop from the Hero Chest; they only come through special means. Unlocking spends the Crests and adds the hero at level 1; gold then levels them as before.

## Art

Backgrounds and hero and boss animations are built by scripts in `art/` (no dependencies):

- `node art/backgrounds/build.js` writes the 15 region layers to `public/bg/`.
- `node art/heroes/split.js <folder> <File=id>...` cuts three-row generated sheets (standing pose, attack, run; JPGs saved as 32-bit PNGs) into a hero folder for animate.js, and reports any sheet that isn't three rows. animate.js drops loose projectiles that sit between frames, cuts frames a beam has joined, and keeps both rows of one image at one scale.
- `node art/heroes/animate.js` turns each `art/heroes/<id>/` folder with `run_sheet.png` and `attack_sheet.png` (one row of frames on flat magenta, e.g. from an image generator) into `public/heroes/<id>.png`, `<id>_run.png` and `<id>_attack.png`, and regenerates `src/heroAnims.ts`, which the battle scene uses to play them. Each hero is drawn at their own size (`HERO_SIZE` in the script: brutes and armoured knights big, faeries, bats and bunnies small). To animate another hero, add their folder and run it. A hero whose sheets disagree on a detail can get an `art/heroes/<id>/fix.js` touch-up (see `art/heroes/fixes.js`).

- `node art/bosses/animate.js` does the same for the five bosses (Ignivar, Nerath, Tharos, Nyxara and Aureth). They take turns on every boss stage (`stageBoss`); before 600 they fight without an element (no hero hits them extra hard or soft, and their blows land the same on everyone), and from 600 each fights as the element it looks like, with every 100th stage the element boss: each `art/bosses/<element>/` folder holds `idle_sheet.png`, `attack_sheet.png`, `hurt_sheet.png` (3 frames) and `death_sheet.png`, which become `public/bosses/<element>_<anim>.png` and `src/bossAnims.ts`. In battle the boss idles, plays its attack when it strikes, flinches at most every 4 seconds when hit, and plays its death before fading.

All of them also write review images to a git-ignored `preview/` folder.
