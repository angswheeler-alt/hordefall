/**
 * Online accounts (Supabase). Both values are safe to publish: the anon key
 * only allows what the database's row-level security rules allow. Leave them
 * empty and the game runs with local saves only. VITE_SUPABASE_URL and
 * VITE_SUPABASE_ANON_KEY in the environment override these at build time.
 */
export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY: string = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';
