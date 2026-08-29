import { NextResponse } from 'next/server';
import { requireVoxelVaultUser } from '../../../../lib/user-auth';
import { normalizePropertyDraftId } from '../../../../lib/property-generation-ids';
import {
  readPropertyCollectibleReservation,
  updatePropertyCollectibleReservation,
} from '../../../../lib/property-collectible-commerce';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function clean(value: unknown, max = 300) {
  return String(value || '').trim().slice(0, max);
}

function privateJson(body: unknown, init: ResponseInit = {}) {
  return NextResponse.json(body, {
    ...init,
    headers: { 'Cache-Control': 'private, no-store, max-age=0', ...(init.headers || {}) },
  });
}

export async function POST(request: Request) {
  const auth = await requireVoxelVaultUser(request);
  if (auth.ok === false) return privateJson({ ok: false, error: auth.error }, { status: auth.status });

  try {
    const body = await request.json().catch(() => ({}));
    const draftId = normalizePropertyDraftId(body?.draftId);
    const identityKey = clean(body?.identityKey, 100);
    const taskId = clean(body?.taskId, 260);
    if (!identityKey || !taskId.startsWith('local-v1:')) {
      return privateJson({ ok: false, error: 'A confirmed property and finished voxel are required.' }, { status: 400 });
    }

    const reservation = await readPropertyCollectibleReservation(identityKey);
    if (!reservation) return privateJson({ ok: false, error: 'The property confirmation expired. Confirm the address again.' }, { status: 409 });
    if (reservation.buyerId !== auth.user.id) return privateJson({ ok: false, error: 'This property confirmation belongs to another account.' }, { status: 403 });
    if (reservation.draftId !== draftId) return privateJson({ ok: false, error: 'This property confirmation belongs to another creation.' }, { status: 409 });

    const finalized = await updatePropertyCollectibleReservation({
      identityKey,
      buyerId: auth.user.id,
      state: 'paid',
      source: 'photo-voxel-complete',
      sourceId: taskId,
    });

    return privateJson({
      ok: true,
      finalized: true,
      identityKey,
      atlasId: finalized.atlasId,
      address: finalized.address,
      taskId,
      onePropertyOneMint: true,
    });
  } catch (error) {
    return privateJson({ ok: false, error: error instanceof Error ? error.message : 'The finished property voxel could not be locked.' }, { status: 500 });
  }
}
