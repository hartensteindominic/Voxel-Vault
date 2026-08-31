import { NextResponse } from 'next/server';
import { DEFAULT_VOXELFLIP_CONTRACT } from '../../../../lib/config';
import { LICENSE_KIND } from '../../../../lib/licenses';
import { licensePrice, x402Status } from '../../../../lib/x402';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    service: 'galactic-x402-licensing',
    status: 'online',
    chainId: 8453,
    network: 'Base',
    x402: x402Status(),
    licensing: {
      kind: LICENSE_KIND,
      price: licensePrice(),
      paylink: '/api/paylink',
      endpoint: '/api/licenses/use',
      catalog: '/api/licenses/catalog',
      oneUseOnly: true,
      nftTransfers: false,
      privateKeysRequired: false,
      defaultContract: DEFAULT_VOXELFLIP_CONTRACT
    }
  }, {
    headers: { 'Cache-Control': 'no-store' }
  });
}
