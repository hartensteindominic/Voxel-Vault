import { NextResponse } from 'next/server';
import { requireVoxelVaultUser } from '../../../../lib/user-auth';
import { inspectWorldAtlas } from '../../../../lib/world-atlas.js';
import {
  propertyCollectibleIdentity,
  quotePropertyCollectible,
  readPropertyCollectibleReservation,
  verifyOwnedFinalVoxelModel,
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

function reservationActive(reservation: any) {
  if (!reservation) return false;
  if (reservation.state === 'paid' || reservation.state === 'minted') return true;
  const stamp = Date.parse(String(reservation.processedAt || ''));
  return Number.isFinite(stamp) && Date.now() - stamp < 35 * 60_000;
}

export async function POST(request: Request) {
  const auth = await requireVoxelVaultUser(request);
  if (auth.ok === false) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  try {
    const body = await request.json().catch(() => ({}));
    const address = clean(body?.address, 220);
    const atlasId = clean(body?.atlasId, 180);
    const draftId = clean(body?.draftId, 100);
    const modelTaskId = clean(body?.modelTaskId, 260);
    if (!address || !atlasId) {
      return NextResponse.json({ ok: false, error: 'Verify the address and preview the finished voxel on My World before collection.' }, { status: 400 });
    }
    if (draftId || modelTaskId) {
      if (!draftId || !modelTaskId) return NextResponse.json({ ok: false, error: 'Both creation ID and final model proof are required together.' }, { status: 400 });
      await verifyOwnedFinalVoxelModel({ userId: auth.user.id, draftId, modelTaskId });
    }

    const atlas = await inspectWorldAtlas({ address, radiusMeters: 180 });
    if (!atlas?.ok) throw new Error(atlas?.error || 'The mapped property reference could not be re-checked on World.');
    const building = findMappedBuilding(atlas, atlasId);
    if (!building) {
      return NextResponse.json({
        ok: false,
        error: 'That mapped building identity could not be re-verified. Your preview stays available, but collection remains locked until World can verify the building identity.',
      }, { status: 409 });
    }

    const identityKey = propertyCollectibleIdentity(atlasId);
    const quote = quotePropertyCollectible(building);
    const reservation = await readPropertyCollectibleReservation(identityKey);
    const active = reservationActive(reservation);
    const sold = active && (reservation?.state === 'paid' || reservation?.state === 'minted');
    const reservedByYou = Boolean(active && reservation && reservation.buyerId === auth.user.id);

    return NextResponse.json({
      ok: true,
      identityKey,
      atlasId,
      quote,
      sold,
      reservedByYou,
      availability: sold ? 'SOLD' : active && !reservedByYou ? 'RESERVED' : 'AVAILABLE',
      disclosure: 'This is the collection price for the generated digital VoxelPop item only. It is based on digital build complexity, not the market value of the physical property, and conveys no deed/title, rent, investment, occupancy, or appreciation rights.',
      uniqueness: 'Once collected, this mapped digital voxel cannot be collected again on this one-of-one digital rail. Optional Verify & Mint later still requires separate canonical parcel verification.',
    }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Digital voxel quote failed.' }, { status: 400 });
  }
}
