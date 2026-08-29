import { NextResponse } from 'next/server';
import { requireVoxelVaultUser } from '../../../../lib/user-auth';
import { inspectWorldAtlas } from '../../../../lib/world-atlas.js';
import {
  propertyCollectibleIdentity,
  quotePropertyCollectible,
  readPropertyCollectibleReservation,
} from '../../../../lib/property-collectible-commerce';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function clean(value: unknown, max = 240) {
  return String(value || '').trim().slice(0, max);
}

function findMappedBuilding(atlas: any, atlasId: string) {
  const candidates = [atlas?.selectedBuilding, ...(Array.isArray(atlas?.buildings) ? atlas.buildings : [])].filter(Boolean);
  return candidates.find((item: any) => String(item?.atlasId || '') === atlasId) || null;
}

export async function POST(request: Request) {
  const auth = await requireVoxelVaultUser(request);
  if (auth.ok === false) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  try {
    const body = await request.json().catch(() => ({}));
    const address = clean(body?.address, 220);
    const atlasId = clean(body?.atlasId, 180);
    if (!address || !atlasId) return NextResponse.json({ ok: false, error: 'Choose the mapped property before pricing the digital collectible.' }, { status: 400 });

    const atlas = await inspectWorldAtlas({ address, radiusMeters: 180 });
    if (!atlas?.ok) throw new Error(atlas?.error || 'The property could not be re-checked on World.');
    const building = findMappedBuilding(atlas, atlasId);
    if (!building) {
      return NextResponse.json({
        ok: false,
        error: 'That mapped building identity could not be re-verified. Preview is still available, but once-only checkout stays locked.',
      }, { status: 409 });
    }

    const identityKey = propertyCollectibleIdentity(atlasId);
    const quote = quotePropertyCollectible(building);
    const reservation = await readPropertyCollectibleReservation(identityKey);
    const sold = reservation?.state === 'paid' || reservation?.state === 'minted';
    const reservedByYou = Boolean(reservation && reservation.buyerId === auth.user.id);

    return NextResponse.json({
      ok: true,
      identityKey,
      atlasId,
      quote,
      sold,
      reservedByYou,
      availability: sold ? 'SOLD' : reservation && !reservedByYou ? 'RESERVED' : 'AVAILABLE',
      disclosure: 'This price is for the generated digital VoxelPop collectible only. It is based on digital build complexity, not the market value of the real property, and does not convey deed/title, rent, investment or occupancy rights.',
      uniqueness: 'Once paid, this mapped Voxel World building identity cannot be sold again on this collectible rail. A canonical property mint still requires separate parcel verification.',
    }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Digital collectible quote failed.' }, { status: 400 });
  }
}
