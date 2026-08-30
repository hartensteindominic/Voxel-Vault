import { createClient } from '@supabase/supabase-js';

let browserClient;
let runtimeConfigPromise;
const CONFIG_TIMEOUT_MS = 8000;
const SESSION_TIMEOUT_MS = 5000;

function bundledConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  return { url, key };
}

function protectSessionLookup(client) {
  const getSession = client.auth.getSession.bind(client.auth);
  client.auth.getSession = (...args) => new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(result);
    };
    const timeout = setTimeout(() => finish({ data: { session: null }, error: new Error('Account check took too long. You can still continue with Google.') }), SESSION_TIMEOUT_MS);
    Promise.resolve().then(() => getSession(...args)).then(finish).catch((error) => finish({ data: { session: null }, error }));
  });
  return client;
}

function createBrowserClient(url, key) {
  if (!url || !key) throw new Error('Galactic Trust accounts are not configured yet.');
  if (!browserClient) browserClient = protectSessionLookup(createClient(url, key, { auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true } }));
  return browserClient;
}

async function fetchRuntimeConfig() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONFIG_TIMEOUT_MS);
  try {
    const response = await fetch('/api/account/public-config', { cache: 'no-store', signal: controller.signal });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.configured || !data?.url || !data?.key) throw new Error('Google sign-in still needs a Supabase publishable/anon key configured on the server.');
    return data;
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('Account setup took too long to respond. Please try Google sign-in again.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
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
  if (typeof window === 'undefined') throw new Error('Galactic Trust accounts are available in the browser only.');
  if (!runtimeConfigPromise) runtimeConfigPromise = fetchRuntimeConfig().catch(error => { runtimeConfigPromise = undefined; throw error; });
  const runtime = await runtimeConfigPromise;
  return createBrowserClient(runtime.url, runtime.key);
}

export async function supabaseBrowserConfigured() {
  if (browserClient) return true;
  const bundled = bundledConfig();
  if (bundled.url && bundled.key) return true;
  if (typeof window === 'undefined') return false;
  try { return Boolean((await fetchRuntimeConfig())?.configured); } catch { return false; }
}

export const supabaseBrowser = new Proxy({}, {
  get(_target, property) {
    const client = getSupabaseBrowser();
    const value = client[property];
    return typeof value === 'function' ? value.bind(client) : value;
  },
});
