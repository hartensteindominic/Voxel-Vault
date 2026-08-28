import { NextResponse } from 'next/server';
import { requireVoxelVaultAdmin } from '../../../../../lib/admin-auth';
import {
  publicAlgorandVerifierStatus,
  verifyAlgorandAssetHolding,
} from '../../../../../lib/real-estate/algorand-position-verifier.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function response(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store, private' },
  });
}

function errorStatus(error: unknown) {
  const code = String((error as { code?: string })?.code || '');
  if (code === 'VERIFIER_NOT_CONFIGURED') return 503;
  if (code === 'INDEXER_UNAVAILABLE') return 502;
  if (code === 'NOT_FOUND') return 404;
  if (code === 'ASSET_METADATA_MISMATCH') return 409;
  return 400;
}

export async function GET(request: Request) {
  const auth = await requireVoxelVaultAdmin(request);
  if ('error' in auth) {
    return response({ ok: false, error: auth.error, setupRequired: Boolean(auth.setupRequired) }, auth.status);
  }

  return response({
    ok: true,
    authorized: true,
    verifier: publicAlgorandVerifierStatus(process.env),
    note: 'Read-only verification can prove a public Algorand address currently holds a specific asset. It cannot prove wallet control, investor identity, legal entity membership, title ownership or property-linked security rights.',
  });
}

export async function POST(request: Request) {
  const auth = await requireVoxelVaultAdmin(request);
  if ('error' in auth) {
    return response({ ok: false, error: auth.error, setupRequired: Boolean(auth.setupRequired) }, auth.status);
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return response({ ok: false, error: 'A JSON body is required.' }, 400);

  try {
    const result = await verifyAlgorandAssetHolding({
      walletAddress: (body as { walletAddress?: string }).walletAddress,
      assetId: (body as { assetId?: string | number }).assetId,
    });

    return response({
      ok: true,
      authorized: true,
      persisted: false,
      result,
      note: result.evidence.onChainHoldingVerified
        ? 'The configured Algorand Indexer confirms this public wallet currently has a positive holding of the requested asset. Voxel Vault still cannot label it property ownership until wallet-control and issuer/legal-property mapping gates are independently verified.'
        : 'The configured Algorand Indexer did not confirm a positive active holding. No property ownership state changes.',
    });
  } catch (error) {
    return response({
      ok: false,
      error: error instanceof Error ? error.message : 'Algorand holding verification failed.',
      code: String((error as { code?: string })?.code || 'INVALID_REQUEST'),
      legalEffects: {
        createsOwnershipRights: false,
        movesFunds: false,
        signsTransactions: false,
      },
    }, errorStatus(error));
  }
}
