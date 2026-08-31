import { NextResponse } from 'next/server';
import { cryptoStatus, getDemoCryptoPortfolio } from '../../../../lib/crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const status = cryptoStatus();
  return NextResponse.json({
    ok: true,
    ...status,
    assets: status.mode === 'demo' ? getDemoCryptoPortfolio() : []
  }, {
    headers: {
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow'
    }
  });
}
