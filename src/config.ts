/**
 * Online accounts (Supabase). Both values are safe to publish: the anon key
 * only allows what the database's row-level security rules allow. Leave them
 * empty and the game runs with local saves only. VITE_SUPABASE_URL and
 * VITE_SUPABASE_ANON_KEY in the environment override these at build time.
 */
export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL ?? 'https://yqsvekcxsejtjghcztha.supabase.co';
export const SUPABASE_ANON_KEY: string = import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'sb_publishable_AO6C3LlVChUDncAYJOMV8A_yyaWMv4y';

/**
 * Players sign in with a username, not an email. Supabase needs an email-shaped
 * login, so each username becomes `<username>@` this domain behind the scenes.
 * No mail is ever sent to it ("Confirm email" must be off in Supabase).
 */
export const USERNAME_DOMAIN = 'players.hordefall.invalid';

/**
 * Prototype tools (Simulate 1h away, +100 Gems) are asked for by local dev builds or the live link opened
 * with ?dev. On the live link they only open for a signed-in admin (src/devAccess.ts).
 */
export const DEV_BUILD: boolean = !!import.meta.env.DEV;
export const DEV_LINK: boolean = typeof location !== 'undefined' && new URLSearchParams(location.search).has('dev');

/** sessionStorage flag for admin test mode (src/testMode.ts). Per tab, so other tabs keep the real game. */
export const TEST_MODE_FLAG = 'hordefall-test-mode';

/**
 * Admin test mode: this tab plays a copy of the save (TEST_SAVE_KEY) with every
 * online feature off, so trying heroes at any stars can't touch the real save,
 * leaderboards, guilds or the Colosseum.
 */
export const TEST_MODE: boolean = (() => {
  try {
    return typeof sessionStorage !== 'undefined' && sessionStorage.getItem(TEST_MODE_FLAG) === '1';
  } catch {
    return false;
  }
})();

/** Where test mode keeps its copy of the save. */
export const TEST_SAVE_KEY = 'hordefall-save-v1-test';
