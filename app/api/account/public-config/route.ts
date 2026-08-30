import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function firstPublishableKey() {
  const direct = [
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    process.env.SUPABASE_PUBLISHABLE_KEY,
    process.env.SUPABASE_ANON_KEY,
  ].map(value => value?.trim() || '').find(Boolean);
  if (direct) return direct;

  const json = process.env.SUPABASE_PUBLISHABLE_KEYS?.trim() || '';
  if (!json) return '';
  try {
    const parsed = JSON.parse(json);
    if (typeof parsed?.default === 'string') return parsed.default.trim();
    const value = Object.values(parsed || {}).find(item => typeof item === 'string');
    return typeof value === 'string' ? value.trim() : '';
  } catch {
    return '';
  }
}

export async function GET() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '').trim();
  const key = firstPublishableKey();
  const configured = Boolean(url && key);
  return NextResponse.json({ configured, url: configured ? url : '', key: configured ? key : '', keyType: key.startsWith('sb_publishable_') ? 'publishable' : key ? 'anon' : 'missing', googleReturnPath: '/bank' }, { headers: { 'Cache-Control': 'no-store' } });
}
