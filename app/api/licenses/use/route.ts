import { withX402 } from '@x402/next';
import { NextRequest, NextResponse } from 'next/server';
import { buildSingleUseMachineLicense, resolveLicensableAsset } from '../../../../lib/licenses';
import { licenseRouteConfig, resourceServer } from '../../../../lib/x402';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function handler(request: NextRequest): Promise<NextResponse> {
  const body = await request.json().catch(() => ({}));
  const tokenId = String(body?.tokenId || '').trim();

  if (!/^\d+$/.test(tokenId)) {
    return NextResponse.json({ error: 'A numeric VoxelFlip token ID is required.' }, { status: 400 });
  }

  let asset;
  try {
    asset = await resolveLicensableAsset(tokenId);
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'This token is not currently licensable.'
    }, { status: 404 });
  }

  return NextResponse.json({
    licensed: true,
    license: buildSingleUseMachineLicense(asset, {
      clientId: body?.clientId,
      useCase: body?.useCase
    })
  }, {
    headers: { 'Cache-Control': 'no-store' }
  });
}

export const POST = withX402(handler, licenseRouteConfig(), resourceServer);
