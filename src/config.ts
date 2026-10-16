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

/** Prototype tools (Simulate 1h away, +100 Gems): local dev builds, or the live link opened with ?dev. */
export const DEV_TOOLS: boolean =
  import.meta.env.DEV || (typeof location !== 'undefined' && new URLSearchParams(location.search).has('dev'));
