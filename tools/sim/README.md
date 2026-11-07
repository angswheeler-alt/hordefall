# Hordefall economy simulator

A separate test bench for balance work. It runs the game's own code (`src/state.ts` GameState, `src/formulas.ts`,
`src/data.ts` and the reward tables) on a fast simulated clock. It never changes the game: no network, no Supabase,
no saves (GameState writes to an in-memory localStorage stub and `save()` is switched off).

Everything random uses fixed seeds, so a run with the same seed always gives the same numbers.

## Files

| File | What it does |
|---|---|
| `engine.ts` | The simulator. Plays a player profile day by day: sessions, offline time, chores (dailies, chests, Trials, relics, guild...), stages, Rekindle. Records snapshots, daily rows, first-time milestones and ledgers of every resource by source. |
| `policies.ts` | Player profiles A to E (casual, active, optimized, inefficient F2P; paying $10/$50/$300 a month). |
| `run.ts` | Command line: one profile, one seed, writes JSON + a CSV of daily rows. |
| `batch.sh` | Runs a list of jobs in parallel. |
| `variants.ts` | Economy variants: exact text edits applied to a COPY of `src/` under `.sim/variants/<name>/src`. |
| `make-variants.ts` | Builds the patched copies. |
| `econ-db.ts` | Dumps every cost, reward, odds and shop table from the code to JSON, with Gems-per-crest values. |
| `crest-mc.ts` | Monte Carlo of crest luck (thousands of players) with the real chest and Trial odds. |
| `summarize.py` | Medians and p10/p90 over seeds per checkpoint. |

## Running

```bash
# one run
npx vite-node tools/sim/run.ts -- --policy B --days 90 --seed 1 --out .sim/runs
# a batch: each line "<variant> <policy> <days> <seed> [strategy]"
npx vite-node tools/sim/make-variants.ts -- gold+20 trialReqSmooth
tools/sim/batch.sh jobs.txt .sim/exp 4
python3 tools/sim/summarize.py .sim/exp > .sim/sum-exp.json
# economy tables and crest luck
npx vite-node tools/sim/econ-db.ts > .sim/econ-db.json
npx vite-node tools/sim/crest-mc.ts -- --paths 5000 --days 365 --trials 68 --chests 6.6 --bundle 0.93 --targeted 30 --out .sim/mc-B.json
```

Strategies (`--strategy`): `balanced` (cheapest upgrade first), `concentrated` (one carry gets 8x the Embers),
`element` (a single-element team), `rarity` (rarest heroes first), `collection` (unlock everything).

Speed: about 1 to 3 seconds of computer time per simulated day.

## Model limits

These are where the simulator is simpler than the real game. Read results with them in mind.

- **Battles are math, not Phaser.** A stage is cleared if the team's damage per second (real hero stats from
  `GameState.heroStats`, element multipliers, crits, area hits) keeps up with the wave model; a boss is beaten with the
  same rule as `GameState.canBeatBoss`. Movement, targeting, flyers and the exact timing of skills are not played out.
  Ultimates and Signature effects count only where they show up in hero stats.
- **The guild is modelled.** Guild Boss, research and quests are server-side, so the simulator assumes a guild of peers
  about as strong as the player (20 members at 80% for profile B). Client reward code (`payGuildBossAttempt`,
  `payGuildBossRewards`, `payGuildQuest`, Guild Shop) is the real code.
- **Colosseum opponents** come from the game's own opponent roll (`rollPvpOpponents`), which uses offline bots
  when there is no server. Real players may be stronger or weaker.
- **Paying players are hypothetical.** There is no real-money shop. Profiles E assume 100 Gems per US dollar, spread
  evenly over the year.
- **Floating chests** come about every 35 game seconds (the game rolls 25 to 45) and profiles tap a share of them.
  Gold chests are 10% of those, as in `BattleScene.ts`. Chest gold is counted as 12 kills (the game's average is
  12.5) and leaves out guild prosperity research; gold barely moves results (see the gold ±20% experiments).
- **Hunting Journal kill tiers** (small damage bonuses) are not counted; shinies and their Gems are.
- **Ultimates** are not cast, so extra Ultimate slots have no value in the simulator.
- **Expedition is hidden** in the game, so it is not simulated.
- Player behaviour (when to Rekindle, what to buy) follows simple rules in `engine.ts`; a human may do better or worse.
