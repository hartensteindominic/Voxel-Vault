import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireVoxelVaultUser } from '../../../lib/user-auth';
import { inspectWorldAtlas } from '../../../lib/world-atlas.js';
import { propertyCollectibleIdentity, readPropertyCollectibleReservation } from '../../../lib/property-collectible-commerce';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COOKIE = 'voxelpop_property_address';

function clean(value: unknown, max = 220) {
  return String(value || '').trim().slice(0, max);
}

function privateJson(body: unknown, init: ResponseInit = {}) {
  return NextResponse.json(body, { ...init, headers: { 'Cache-Control': 'private, no-store, max-age=0', ...(init.headers || {}) } });
}

export async function GET(request: Request) {
  const auth = await requireVoxelVaultUser(request);
  if (auth.ok === false) return privateJson({ ok: false, error: auth.error }, { status: auth.status });
  const store = await cookies();
  const address = clean(store.get(COOKIE)?.value, 220);
  return privateJson({ ok: true, selected: Boolean(address), address });
}

export async function POST(request: Request) {
  const auth = await requireVoxelVaultUser(request);
  if (auth.ok === false) return privateJson({ ok: false, error: auth.error }, { status: auth.status });
  try {
    const body = await request.json().catch(() => ({}));
    const address = clean(body?.address, 220);
    if (!address) return privateJson({ ok: false, error: 'Enter the property address.' }, { status: 400 });

    const atlas = await inspectWorldAtlas({ address, radiusMeters: 180 });
    const building = atlas?.selectedBuilding || null;
    const atlasId = clean(building?.atlasId, 180);
    if (!atlas?.ok || !atlasId) {
      return privateJson({ ok: false, error: 'No source-backed building could be verified at that address.' }, { status: 409 });
    }
    const identityKey = propertyCollectibleIdentity(atlasId);
    const existing = await readPropertyCollectibleReservation(identityKey);
    if (existing && ['paid', 'minted'].includes(existing.state)) {
      return privateJson({
        ok: false,
        sold: true,
        ownedByYou: existing.buyerId === auth.user.id,
        error: existing.buyerId === auth.user.id
          ? 'You already own the Voxel Vault collectible for this property. Open it from Vault.'
          : 'This property has already been collected. Each property can only be purchased once.',
      }, { status: 409 });
    }

    const canonicalAddress = clean(atlas.address || address, 220);
    const response = privateJson({ ok: true, selected: true, address: canonicalAddress, atlasId, identityKey, available: true });
    response.cookies.set(COOKIE, canonicalAddress, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 2,
    });
    return response;
  } catch (error) {
    return privateJson({ ok: false, error: error instanceof Error ? error.message : 'Property identity could not be verified.' }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireVoxelVaultUser(request);
  if (auth.ok === false) return privateJson({ ok: false, error: auth.error }, { status: auth.status });
  const response = privateJson({ ok: true, selected: false });
  response.cookies.set(COOKIE, '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 0 });
  return response;
}
