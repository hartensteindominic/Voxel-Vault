import { createClient } from '@supabase/supabase-js';

let browserClient;
let runtimeConfigPromise;

function bundledConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  return { url, key };
}

function createBrowserClient(url, key) {
  if (!url || !key) throw new Error('Vault accounts are not configured yet.');
  if (!browserClient) {
    browserClient = createClient(url, key, {
      auth: {
        flowType: 'pkce',
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
  return browserClient;
}

export function getSupabaseBrowser() {
  if (browserClient) return browserClient;
  const { url, key } = bundledConfig();
  return createBrowserClient(url, key);
}

export async function getSupabaseBrowserAsync() {
  if (browserClient) return browserClient;
  const bundled = bundledConfig();
  if (bundled.url && bundled.key) return createBrowserClient(bundled.url, bundled.key);
  if (typeof window === 'undefined') throw new Error('Vault accounts are available in the browser only.');

  if (!runtimeConfigPromise) {
    runtimeConfigPromise = fetch('/api/account/public-config', { cache: 'no-store' })
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.configured || !data?.url || !data?.key) {
          throw new Error('Google sign-in still needs a Supabase publishable/anon key configured on the server.');
        }
        return data;
      })
      .catch(error => {
        runtimeConfigPromise = undefined;
        throw error;
      });
  }

  const runtime = await runtimeConfigPromise;
  return createBrowserClient(runtime.url, runtime.key);
}

export async function supabaseBrowserConfigured() {
  if (browserClient) return true;
  const bundled = bundledConfig();
  if (bundled.url && bundled.key) return true;
  if (typeof window === 'undefined') return false;
  try {
    const response = await fetch('/api/account/public-config', { cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    return Boolean(response.ok && data?.configured);
  } catch {
    return false;
  }
}

export const supabaseBrowser = new Proxy({}, {
  get(_target, property) {
    const client = getSupabaseBrowser();
    const value = client[property];
    return typeof value === 'function' ? value.bind(client) : value;
  },
});
