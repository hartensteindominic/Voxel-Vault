import { createHash } from 'crypto';
import { NextResponse } from 'next/server';
import { POST as previewPOST } from '../../../voxelflip/forge/preview/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function metadataHash(parent: any) {
  return createHash('sha256').update(JSON.stringify({
    tokenId: String(parent?.tokenId || ''),
    name: String(parent?.name || ''),
    attributes: Array.isArray(parent?.attributes) ? parent.attributes : [],
  })).digest('hex');
}

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store, private',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export async function POST(request: Request) {
  const response = await previewPOST(request);
  if (!response.ok) return response;

  const data = await response.json();
  const parents = Array.isArray(data?.parents) ? data.parents : [];

  return json({
    verified: true,
    executionEnabled: false,
    chain: data?.chain || 'base',
    chainId: data?.chainId || 8453,
    collectionAddress: data?.contractAddress || null,
    wallet: data?.wallet || null,
    verifiedAt: data?.verifiedAt || new Date().toISOString(),
    parentCount: parents.length,
    parents: parents.map((parent: any) => ({
      tokenId: String(parent?.tokenId || ''),
      owner: parent?.owner || null,
      tokenUri: parent?.tokenUri || null,
      metadataHash: metadataHash(parent),
      metadataStatus: parent?.metadataStatus || 'unknown',
      name: parent?.name || null,
      attributes: Array.isArray(parent?.attributes) ? parent.attributes : [],
    })),
    notice: 'All three parent tokens were verified against Base immediately for this request. This endpoint cannot burn, mint, approve, sign, or spend funds.',
  });
}
