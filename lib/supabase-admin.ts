import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Prefer the explicit service-role credential when both legacy/new server keys
  // are configured. Property/photo storage needs admin-capable Storage access.
  const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    throw new Error('Supabase server credentials are not configured');
  }

  return createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
