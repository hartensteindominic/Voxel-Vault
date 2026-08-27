import { NextResponse } from 'next/server';
import { listLicensableAssets } from '../../../../lib/ai-licensing';
import { x402RuntimeStatus } from '../../../../lib/x402-resource';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get('limit') || '24');
    const catalog = await listLicensableAssets(limit);
    const origin = url.origin;
    return NextResponse.json({
      name: 'Voxel Vault AI Asset Licensing Catalog',
      version: '1.0.0',
      model: 'pay-per-machine-use',
      description: 'Base-native VoxelFlip assets offered as one-use machine licenses. Each additional machine use requires a new x402 payment.',
      x402: x402RuntimeStatus(),
      paidEndpoint: `${origin}/api/licenses/use`,
      requestShape: {
        tokenId: 'numeric VoxelFlip token id',
        useCase: 'short description of the machine use',
        clientId: 'optional agent or application identifier',
      },
      ...catalog,
      rightsNotice: 'Catalog inclusion means the NFT is currently owned by the configured licensor wallet. NFT ownership alone does not prove copyright ownership; licenses cover only rights the licensor actually controls.',
    }, { headers: { 'Cache-Control': 'public, max-age=15, s-maxage=15' } });
  } catch (error) {
    console.error('AI license catalog failed', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'AI license catalog is temporarily unavailable.',
    }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
