import { createHash } from 'crypto';
import { NextResponse } from 'next/server';
import { POST as previewPOST } from '../../../voxelflip/forge/preview/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
  const tokenIds = (Array.isArray(data?.parents) ? data.parents : []).map((parent: any) => String(parent?.tokenId || ''));
  const forgeId = String(data?.descendant?.forgeId || '');
  const signature = String(data?.descendant?.signature || '');
  const quoteMaterial = [
    String(data?.contractAddress || '').toLowerCase(),
    String(data?.wallet || '').toLowerCase(),
    ...tokenIds,
    forgeId,
    signature,
    '4.99',
    'read-only-v1',
  ].join('|');
  const quoteId = `fq_${createHash('sha256').update(quoteMaterial).digest('hex').slice(0, 32)}`;
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  return json({
    quoteReady: true,
    executionEnabled: false,
    quoteId,
    chain: data?.chain || 'base',
    chainId: data?.chainId || 8453,
    collectionAddress: data?.contractAddress || null,
    wallet: data?.wallet || null,
    parentTokenIds: tokenIds,
    descendant: {
      forgeId: forgeId || null,
      name: data?.descendant?.name || null,
      signature: signature || null,
    },
    fee: {
      displayUsd: data?.feeUsd || '4.99',
      asset: null,
      amountAtomic: null,
      maxFeeAtomic: null,
    },
    gas: {
      estimated: false,
      amountAtomic: null,
    },
    createdAt: new Date().toISOString(),
    expiresAt,
    allowedTargets: [],
    notice: 'This is a read-only economic quote for agent planning. No payable asset, transaction target, or executable calldata is issued until atomic Forge execution is deployed and reviewed.',
  });
}
