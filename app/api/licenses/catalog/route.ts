import { NextResponse } from 'next/server';
import { listLicensableAssets } from '../../../../lib/licenses';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get('limit') || '24');
    const catalog = await listLicensableAssets(limit);
    return NextResponse.json({
      ...catalog,
      paidEndpoint: `${url.origin}/api/licenses/use`,
      requestShape: {
        tokenId: 'numeric VoxelFlip token ID',
        clientId: 'optional agent or application ID',
        useCase: 'short description of the one machine use'
      }
    }, {
      headers: { 'Cache-Control': 'public, max-age=15, s-maxage=15' }
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'License catalog is temporarily unavailable.'
    }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' }
    });
  }
}
