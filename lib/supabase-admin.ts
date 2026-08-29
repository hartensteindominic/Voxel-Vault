import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function serverConfig() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const keys = [process.env.SUPABASE_SECRET_KEY, process.env.SUPABASE_SERVICE_ROLE_KEY]
    .map((value) => String(value || '').trim())
    .filter((value, index, list) => Boolean(value) && list.indexOf(value) === index);
  if (!url || !keys.length) throw new Error('Supabase server credentials are not configured');
  return { url, keys };
}

function adminClient(url: string, key: string): SupabaseClient {
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function getSupabaseAdminCandidates(): SupabaseClient[] {
  const { url, keys } = serverConfig();
  return keys.map((key) => adminClient(url, key));
}

export function getSupabaseAdmin(): SupabaseClient {
  return getSupabaseAdminCandidates()[0];
}
