import { NextResponse } from 'next/server';
import { getVoxelFlipDeployment } from '../../../../../lib/voxelflip-deployment';

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

export async function GET(request: Request) {
  try {
    const deployment = await getVoxelFlipDeployment();
    const origin = new URL(request.url).origin;
    const address = String(deployment?.address || '').trim();

    return json({
      protocol: 'VoxelForge',
      apiVersion: 'v1',
      chain: 'base',
      chainId: 8453,
      collectionAddress: address || null,
      forgeVersion: 'forge-preview-v1',
      recipeVersion: 'deterministic-preview-v1',
      fee: {
        displayUsd: '4.99',
        executionQuoteReady: false,
        acceptedAssets: [],
      },
      capabilities: {
        verifyParents: true,
        previewDescendant: true,
        quote: true,
        createIntent: false,
        executeIntent: false,
        delegatedExecution: false,
        verifiableGeneProof: false,
      },
      safety: {
        executionEnabled: false,
        arbitraryCallsAllowed: false,
        privateKeysAccepted: false,
        parentCount: 3,
        atomicExecutionRequired: true,
      },
      endpoints: {
        config: `${origin}/api/forge/v1/config`,
        verify: `${origin}/api/forge/v1/verify`,
        preview: `${origin}/api/forge/v1/preview`,
        quote: `${origin}/api/forge/v1/quote`,
      },
      notice: 'VoxelForge agent discovery is live in read-only mode. State-changing execution remains disabled until the atomic 3-to-1 Forge path is reviewed and deployed.',
    });
  } catch (error) {
    console.error('VoxelForge config failed', error);
    return json({ error: 'VoxelForge configuration is temporarily unavailable.' }, 503);
  }
}
