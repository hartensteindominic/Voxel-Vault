import { NextResponse } from 'next/server';
import { requireNeuralCoreAdmin } from '../../../../lib/neural-core-auth';
import { readNeuralCoreMemory, readNeuralCoreWallet, refreshNeuralCore, saveNeuralCoreWallet } from '../../../../lib/voxelflip-neural-core';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

function response(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store, private' } });
}

export async function GET(request: Request) {
  const auth = await requireNeuralCoreAdmin(request);
  if (!auth.ok) return response({ error: auth.error, setupRequired: Boolean(auth.setupRequired) }, auth.status);

  const url = new URL(request.url);
  let wallet = (url.searchParams.get('wallet') || '').trim();
  if (!ADDRESS_RE.test(wallet)) wallet = await readNeuralCoreWallet(auth.admin);

  if (url.searchParams.get('export') === '1') {
    if (!ADDRESS_RE.test(wallet)) return response({ error: 'Connect and save a Base wallet before exporting Neural Core memory.' }, 400);
    try {
      const memory = await readNeuralCoreMemory(auth.admin, wallet, 1000);
      return response({ exportedAt: new Date().toISOString(), wallet: wallet.toLowerCase(), memory });
    } catch (error) {
      return response({ error: error instanceof Error ? error.message : 'Neural Core memory export failed.' }, 503);
    }
  }

  try {
    const core = await refreshNeuralCore({ wallet, persist: true });
    return response({ authorized: true, adminUserId: auth.user.id, ...core });
  } catch (error) {
    return response({ error: error instanceof Error ? error.message : 'Neural Core refresh failed.' }, 503);
  }
}

export async function POST(request: Request) {
  const auth = await requireNeuralCoreAdmin(request);
  if (!auth.ok) return response({ error: auth.error, setupRequired: Boolean(auth.setupRequired) }, auth.status);

  const body = await request.json().catch(() => ({}));
  const action = String(body?.action || 'refresh');
  const wallet = String(body?.wallet || '').trim();

  if (action === 'set-wallet') {
    if (!ADDRESS_RE.test(wallet)) return response({ error: 'A valid Base wallet is required.' }, 400);
    try {
      const saved = await saveNeuralCoreWallet(auth.admin, wallet);
      const core = await refreshNeuralCore({ wallet: saved, persist: true });
      return response({ authorized: true, walletSaved: true, ...core });
    } catch (error) {
      return response({ error: error instanceof Error ? error.message : 'Neural Core wallet could not be saved.' }, 503);
    }
  }

  if (action !== 'refresh') return response({ error: 'Unsupported Neural Core action.' }, 400);
  if (!ADDRESS_RE.test(wallet)) return response({ error: 'A valid Base wallet is required.' }, 400);
  try {
    const core = await refreshNeuralCore({ wallet, persist: true });
    return response({ authorized: true, ...core });
  } catch (error) {
    return response({ error: error instanceof Error ? error.message : 'Neural Core refresh failed.' }, 503);
  }
}
