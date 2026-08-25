import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!url || !anonKey) {
    return NextResponse.json({
      supabaseConfigured: false,
      googleProviderEnabled: false,
      accountStorage: 'unknown',
      nextStep: 'Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel.',
    });
  }

  let googleProviderEnabled = false;
  let providerCheck = 'unavailable';
  try {
    const response = await fetch(`${url.replace(/\/$/, '')}/auth/v1/settings`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
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
    accountStorage: 'vault_profiles.avatar_style.voxelpop_library',
    redirectUrl: 'https://www.voxelvault.io/?auth=google',
    nextStep: googleProviderEnabled
      ? 'Google OAuth is ready for a browser sign-in test.'
      : 'Enable the Google provider in Supabase Auth and add the Google OAuth client ID and secret.',
  });
}
