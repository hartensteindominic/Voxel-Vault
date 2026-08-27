import { NextResponse } from 'next/server';
import { aiLicensePriceAtomic, buildSingleUseMachineLicense, resolveLicensableAsset } from '../../../../lib/ai-licensing';
import { withX402Json } from '../../../../lib/x402-resource';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function clean(value: unknown, max: number) {
  return String(value || '').trim().slice(0, max);
}

export async function POST(request: Request) {
  let body: any = {};
  try {
    body = await request.json().catch(() => ({}));
  } catch {}

  const tokenId = clean(body?.tokenId, 80);
  if (!/^\d+$/.test(tokenId)) {
    return NextResponse.json({ error: 'A numeric VoxelFlip tokenId is required.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  let asset;
  try {
    // Validate the asset and current licensor ownership before issuing a 402 challenge,
    // so an agent is never asked to pay for an ineligible token.
    asset = await resolveLicensableAsset(tokenId);
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'This asset is not currently licensable.',
    }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }

  return withX402Json(request, {
    amountAtomic: aiLicensePriceAtomic(),
    description: `One machine-use license for ${asset.displayName}. New payment required for each additional use.`,
    tags: ['base', 'nft', 'ai-license', 'voxel', 'machine-use'],
    serviceName: 'Voxel Vault AI Licensing',
  }, async () => ({
    licensed: true,
    license: buildSingleUseMachineLicense(asset, {
      useCase: body?.useCase,
      clientId: body?.clientId,
    }),
  }));
}
