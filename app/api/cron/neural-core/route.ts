import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';
import { readNeuralCoreWallet, refreshNeuralCore } from '../../../../lib/voxelflip-neural-core';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorized(request: Request) {
  const secret = String(process.env.CRON_SECRET || '').trim();
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Neural Core cron is not authorized.' }, { status: 401 });
  try {
    const admin = getSupabaseAdmin();
    const wallet = await readNeuralCoreWallet(admin);
    if (!wallet) return NextResponse.json({ ok: true, skipped: true, reason: 'No Neural Core wallet has been configured yet.' }, { headers: { 'Cache-Control': 'no-store' } });
    const core = await refreshNeuralCore({ wallet, persist: true });
    return NextResponse.json({
      ok: true,
      checkedAt: core.checkedAt,
      wallet: core.wallet,
      memoryAvailable: core.memory.available,
      snapshotStored: core.memory.snapshotStored,
      recommendationStored: core.memory.recommendationStored,
      recommendation: core.recommendation,
      automaticSigningActive: false,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Neural Core cron failed', error);
    return NextResponse.json({ error: 'Neural Core monitoring refresh failed.' }, { status: 503 });
  }
}
