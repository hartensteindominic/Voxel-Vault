import { NextResponse } from 'next/server';
import { requireVoxelVaultAdmin } from '../../../../../lib/admin-auth';
import {
  buildFractionalPropertyHandoff,
  evaluateFractionalPositionClaim,
  publicFractionalBridgeStatus,
} from '../../../../../lib/real-estate/fractional-property-bridge.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function response(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store, private' },
  });
}

async function authorize(request: Request) {
  const auth = await requireVoxelVaultAdmin(request);
  if ('error' in auth) {
    return {
      auth: null,
      errorResponse: response({
        ok: false,
        error: auth.error,
        setupRequired: Boolean(auth.setupRequired),
      }, auth.status),
    };
  }
  return { auth, errorResponse: null };
}

export async function GET(request: Request) {
  const { errorResponse } = await authorize(request);
  if (errorResponse) return errorResponse;

  const url = new URL(request.url);
  const providerId = String(url.searchParams.get('provider') || 'lofty');
  const budgetUsd = Number(url.searchParams.get('budget') || 25);

  try {
    return response({
      ok: true,
      authorized: true,
      bridge: publicFractionalBridgeStatus(),
      handoff: buildFractionalPropertyHandoff({ providerId, budgetUsd }),
      persistence: 'none',
      note: 'This endpoint prepares an owner-only provider handoff. It does not place an order, move money, scrape a provider, or verify ownership.',
    });
  } catch (error) {
    return response({
      ok: false,
      error: error instanceof Error ? error.message : 'Fractional-property bridge could not be prepared.',
    }, 400);
  }
}

export async function POST(request: Request) {
  const { errorResponse } = await authorize(request);
  if (errorResponse) return errorResponse;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return response({ ok: false, error: 'A JSON position claim is required.' }, 400);
  }

  try {
    const evaluation = evaluateFractionalPositionClaim(body);
    return response({
      ok: true,
      authorized: true,
      persisted: false,
      evaluation,
      note: 'The claim is evaluated in memory only. User-entered references cannot self-verify property ownership. No trade, transfer, mint or title change occurs.',
    });
  } catch (error) {
    return response({
      ok: false,
      error: error instanceof Error ? error.message : 'Fractional property position claim was rejected.',
    }, 400);
  }
}
