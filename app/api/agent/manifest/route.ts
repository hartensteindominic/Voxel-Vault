import { NextResponse } from 'next/server';
import { LICENSE_KIND } from '../../../../lib/licenses';
import { licensePrice, x402Status } from '../../../../lib/x402';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;

  return NextResponse.json({
    name: 'Galactic x402 Machine Licensing API',
    version: '1.0.0',
    network: 'Base',
    chainId: 8453,
    capabilities: [
      'x402-usdc-pay-per-request',
      'nft-machine-use-licensing',
      'agent-readable-license-catalog',
      'one-use-license-receipts'
    ],
    x402: {
      ...x402Status(),
      price: licensePrice()
    },
    licensing: {
      model: LICENSE_KIND,
      repeatUseRequiresNewPayment: true,
      modelTrainingIncluded: false,
      nftOwnershipTransferred: false
    },
    endpoints: {
      paylink: `${origin}/api/paylink`,
      health: `${origin}/api/agent/health`,
      openapi: `${origin}/api/agent/openapi`,
      publicLicenseCatalog: `${origin}/api/licenses/catalog`,
      paidMachineUseLicense: `${origin}/api/licenses/use`
    },
    requestExample: {
      tokenId: '1',
      clientId: 'example-agent',
      useCase: 'render this voxel in one generated scene'
    }
  }, {
    headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60' }
  });
}
