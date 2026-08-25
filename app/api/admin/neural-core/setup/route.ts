import { NextResponse } from 'next/server';
import { requireNeuralCoreAdmin } from '../../../../../lib/neural-core-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store, private' },
  });
}

async function tableReady(admin: any, table: string) {
  try {
    const { error } = await admin.from(table).select('id', { head: true, count: 'exact' });
    if (error) return { ready: false, error: error.message };
    return { ready: true, error: '' };
  } catch (error) {
    return { ready: false, error: error instanceof Error ? error.message : 'table unavailable' };
  }
}

export async function GET(request: Request) {
  const auth = await requireNeuralCoreAdmin(request);
  if ('error' in auth) return json({ error: auth.error, setupRequired: Boolean(auth.setupRequired) }, auth.status);

  const [ledger, memory] = await Promise.all([
    tableReady(auth.admin, 'voxelflip_profit_ledger'),
    tableReady(auth.admin, 'voxelflip_neural_memory'),
  ]);

  const services = {
    openSeaApiKey: Boolean(String(process.env.OPENSEA_API_KEY || '').trim()),
    productionRpc: Boolean(String(process.env.VOXELFLIP_RPC_URL || process.env.NEXT_PUBLIC_VOXELFLIP_RPC_URL || '').trim()),
    cronSecret: Boolean(String(process.env.CRON_SECRET || '').trim()),
    adminAllowlist: Boolean(String(process.env.NEURAL_CORE_ADMIN_EMAILS || process.env.NEURAL_CORE_ADMIN_USER_IDS || '').trim()),
  };

  return json({
    ready: ledger.ready && memory.ready,
    database: {
      profitLedger: ledger,
      neuralMemory: memory,
    },
    services,
    automaticSigningActive: false,
    automaticListingActive: false,
    automaticBuyingActive: false,
    nextStep: !ledger.ready || !memory.ready
      ? 'Run migrations 011 and 012 once in the Supabase SQL Editor, then refresh this page.'
      : 'The private ledger and Neural Core memory tables are active. Automatic signing remains OFF.',
  });
}
