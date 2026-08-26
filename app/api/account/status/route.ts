import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function publicKey() {
  const direct = [
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    process.env.SUPABASE_PUBLISHABLE_KEY,
    process.env.SUPABASE_ANON_KEY,
  ].map(value => value?.trim() || '').find(Boolean);
  if (direct) return direct;
  try {
    const parsed = JSON.parse(process.env.SUPABASE_PUBLISHABLE_KEYS || '{}');
    if (typeof parsed?.default === 'string') return parsed.default.trim();
    const value = Object.values(parsed || {}).find(item => typeof item === 'string');
    return typeof value === 'string' ? value.trim() : '';
  } catch {
    return '';
  }
}

export async function GET() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '').trim();
  const key = publicKey();
  if (!url || !key) {
    return NextResponse.json({
      supabaseConfigured: false,
      googleProviderEnabled: false,
      accountStorage: 'unknown',
      publicUrlConfigured: Boolean(url),
      publishableKeyConfigured: Boolean(key),
      nextStep: 'Configure a Supabase project URL plus a browser-safe publishable key (preferred) or legacy anon key in Vercel.',
    });
  }

  let googleProviderEnabled = false;
  let providerCheck = 'unavailable';
  try {
    const response = await fetch(`${url.replace(/\/$/, '')}/auth/v1/settings`, {
      headers: { apikey: key },
      cache: 'no-store',
    });
    if (response.ok) {
      const settings = await response.json();
      const google = settings?.external?.google;
      googleProviderEnabled = google === true || google?.enabled === true;
      providerCheck = 'ok';
    } else {
      providerCheck = `http-${response.status}`;
    }
  } catch {
    providerCheck = 'error';
  }

  return NextResponse.json({
    supabaseConfigured: true,
    googleProviderEnabled,
    providerCheck,
    keyType: key.startsWith('sb_publishable_') ? 'publishable' : 'anon',
    accountStorage: 'vault_profiles.avatar_style.voxelpop_library',
    redirectUrl: 'https://www.voxelvault.io/studio?auth=google#my-voxels',
    nextStep: googleProviderEnabled
      ? 'Google OAuth is ready for phone and desktop sign-in.'
      : 'Enable the Google provider in Supabase Auth and allow https://www.voxelvault.io/studio?auth=google as a redirect.',
  }, { headers: { 'Cache-Control': 'no-store' } });
}
