import { createClient } from '@supabase/supabase-js';

let browserClient;

export function getSupabaseBrowser() {
  if (browserClient) return browserClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error('Vault accounts are not configured yet.');
  browserClient = createClient(url, anonKey);
  return browserClient;
}

// Preserve the existing client-shaped API while avoiding server-build failures
// in environments where optional Supabase variables are intentionally absent.
export const supabaseBrowser = new Proxy({}, {
  get(_target, property) {
    const client = getSupabaseBrowser();
    const value = client[property];
    return typeof value === 'function' ? value.bind(client) : value;
  },
});
