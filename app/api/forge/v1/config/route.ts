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
      authorizationVersion: 'voxelforge-authorization-v1',
      fee: {
        displayUsd: '4.99',
        executionQuoteReady: false,
        acceptedAssets: [],
      },
      capabilities: {
        verifyParents: true,
        previewDescendant: true,
        quote: true,
        prepareVoucherDraft: true,
        authorizationDiscovery: true,
        signForgeVoucher: false,
        createIntent: false,
        executeIntent: false,
        delegatedExecution: false,
        eip7702Delegation: false,
        erc4337Execution: false,
        verifiableGeneProof: false,
      },
      safety: {
        executionEnabled: false,
        signingEnabled: false,
        arbitraryCallsAllowed: false,
        privateKeysAccepted: false,
        parentCount: 3,
        atomicExecutionRequired: true,
        delegationMustBeRevocable: true,
        sessionPolicyRequired: true,
      },
      endpoints: {
        config: `${origin}/api/forge/v1/config`,
        verify: `${origin}/api/forge/v1/verify`,
        preview: `${origin}/api/forge/v1/preview`,
        quote: `${origin}/api/forge/v1/quote`,
        prepare: `${origin}/api/forge/v1/prepare`,
        authorization: `${origin}/api/forge/v1/authorization`,
      },
      notice: 'VoxelForge verification, deterministic preview, quote, voucher-draft preparation, and authorization-schema discovery are live in read-only mode. Voucher signing, state-changing execution, and EIP-7702 delegation remain disabled until the atomic 3-to-1 Forge path is proven against deployed VoxelFlip bytecode and the Forge contract is reviewed and deployed.',
    });
  } catch (error) {
    console.error('VoxelForge config failed', error);
    return json({ error: 'VoxelForge configuration is temporarily unavailable.' }, 503);
  }
}
