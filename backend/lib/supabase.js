/**
 * Supabase client for backend. Use getSupabase() for DB access (service role).
 * Anon client exported for optional use (e.g. passing to frontend).
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = `.env.${nodeEnv}`;
dotenv.config({ path: join(__dirname, '..', envFile) });
dotenv.config({ path: join(__dirname, '..', '.env'), override: false });

const PLACEHOLDER_URL = 'https://placeholder.supabase.co';
const PLACEHOLDER_KEY = 'placeholder';

const supabaseUrl = process.env.SUPABASE_URL || PLACEHOLDER_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || PLACEHOLDER_KEY;
const rawServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseServiceKey =
  rawServiceKey && rawServiceKey !== 'placeholder' ? rawServiceKey : null;

/** Anon key client (e.g. for optional frontend or public reads). */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/** Service-role client for server-side DB; null if key not set. */
export const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

/**
 * Get Supabase admin client for backend DB access. Throws if not configured.
 * Use this for ringcentral_connections, processed_calls, etc.
 */
export function getSupabase() {
  if (!supabaseAdmin) {
    throw new Error(
      'Supabase service role not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.development (from Supabase Dashboard → Settings → API).'
    );
  }
  return supabaseAdmin;
}
