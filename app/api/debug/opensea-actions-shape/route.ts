import { NextResponse } from 'next/server';
import { getVoxelFlipDeployment } from '../../../../lib/voxelflip-deployment';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export async function GET() {
  if (process.env.VERCEL_ENV !== 'preview') {
    return NextResponse.json({ error: 'Not available.' }, { status: 404 });
  }
  const apiKey = String(process.env.OPENSEA_API_KEY || '').trim();
  if (!apiKey) return NextResponse.json({ error: 'OpenSea key unavailable in preview.' }, { status: 503 });
  const deployment = await getVoxelFlipDeployment();
  const contract = deployment.address;
  const start = new Date();
  const end = new Date(start.getTime() + 30 * 86_400_000);
  const response = await fetch('https://api.opensea.io/api/v2/listings/actions', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      address: '0x02f93c7547309ca50EEAB446DaEBE8ce8E694cBb',
      items: [{
        chain: 'base',
        contract,
        token_id: '2',
        quantity: 1,
        price: { amount: '0.015', currency: ZERO_ADDRESS },
        start_time: start.toISOString(),
        end_time: end.toISOString(),
      }],
      use_creator_fee: true,
    }),
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => ({}));
  return NextResponse.json({ status: response.status, steps: payload?.steps || null, error: payload?.detail || payload?.error || null }, { status: 200 });
}
