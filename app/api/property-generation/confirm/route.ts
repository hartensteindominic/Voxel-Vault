import { NextResponse } from 'next/server';
import { requireVoxelVaultUser } from '../../../../lib/user-auth';
import { normalizePropertyDraftId } from '../../../../lib/property-generation-ids';
import { inspectWorldAtlas } from '../../../../lib/world-atlas.js';
import {
  acquirePropertyCollectibleReservation,
  propertyCollectibleIdentity,
  releasePropertyCollectibleReservation,
} from '../../../../lib/property-collectible-commerce';
import {
  countVoxelMakerGenerations,
  getVoxelMakerEntitlement,
  hasVoxelMakerGeneration,
  registerVoxelMakerGeneration,
} from '../../../../lib/voxel-maker-subscriptions';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

function clean(value: unknown, max = 500) {
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
    const draftId = normalizePropertyDraftId(clean(body?.draftId, 100));
    const address = clean(body?.address, 220);
    if (!address) return privateJson({ ok: false, error: 'Enter the house address to confirm this property.' }, { status: 400 });

    const entitlement = await getVoxelMakerEntitlement(auth.user.id);
    if (!entitlement.active || !entitlement.plan) {
      return privateJson({
        ok: false,
        code: 'VOXEL_MAKER_SUBSCRIPTION_REQUIRED',
        subscriptionRequired: true,
        error: 'Choose a Voxel Maker plan before creating a new house voxel.',
      }, { status: 402 });
    }

    const periodStart = entitlement.record?.currentPeriodStart || null;
    const alreadyCounted = await hasVoxelMakerGeneration(auth.user.id, draftId, periodStart);
    const usedThisPeriod = await countVoxelMakerGenerations(auth.user.id, periodStart);
    if (!alreadyCounted && usedThisPeriod >= entitlement.plan.monthlyVoxels) {
      return privateJson({
        ok: false,
        code: 'VOXEL_MAKER_MONTHLY_LIMIT_REACHED',
        monthlyLimitReached: true,
        plan: entitlement.plan.id,
        used: usedThisPeriod,
        limit: entitlement.plan.monthlyVoxels,
        error: `You have used all ${entitlement.plan.monthlyVoxels} Voxel Maker creations included in your ${entitlement.plan.name} billing period.`,
      }, { status: 429 });
    }

    const atlas = await inspectWorldAtlas({ address, radiusMeters: 180 });
    const selectedBuilding = atlas?.selectedBuilding || null;
    const atlasId = clean(selectedBuilding?.atlasId, 180);
    if (!atlas?.ok || !atlasId) {
      return privateJson({ ok: false, error: 'Voxel Vault could not match a mapped building at that address. Check the address and try again.' }, { status: 409 });
    }

    const identityKey = propertyCollectibleIdentity(atlasId);
    const canonicalAddress = clean(atlas.address || address, 220);
    const hold = await acquirePropertyCollectibleReservation({
      identityKey,
      buyerId: auth.user.id,
      atlasId,
      address: canonicalAddress,
      draftId,
      modelTaskId: draftId,
      // The legacy reservation decoder requires a positive integer. This is a lock value only;
      // this route never creates a charge or opens checkout.
      priceCents: 1,
      priceTier: 'included',
      priceLabel: 'Property Voxel',
      source: 'photo-address-confirmation',
    });

    if (hold.sold) {
      const ownedByYou = hold.reservation?.buyerId === auth.user.id;
      return privateJson({
        ok: false,
        claimed: true,
        ownedByYou,
        error: ownedByYou
          ? 'This property is already in your Voxel Vault inventory. Open your inventory instead of creating a duplicate.'
          : 'This property already has a Voxel Vault collectible. One property can only be minted once.',
      }, { status: 409 });
    }

    if (!hold.reservedByYou) {
      return privateJson({ ok: false, reserved: true, error: 'Another creation is currently using this property. Try again later.' }, { status: 409 });
    }

    if (hold.reservation?.draftId && hold.reservation.draftId !== draftId) {
      return privateJson({ ok: false, reserved: true, ownedByYou: true, error: 'You already started this property in another Voxel Vault creation. Finish that one or wait for the temporary hold to expire.' }, { status: 409 });
    }

    if (!alreadyCounted) {
      await registerVoxelMakerGeneration({
        userId: auth.user.id,
        draftId,
        planId: entitlement.plan.id,
        address: canonicalAddress,
      });
    }

    return privateJson({
      ok: true,
      confirmed: true,
      identityKey,
      atlasId,
      address: canonicalAddress,
      onePropertyOneMint: true,
      next: 'voxel-image',
      subscription: {
        plan: entitlement.plan.id,
        used: alreadyCounted ? usedThisPeriod : usedThisPeriod + 1,
        limit: entitlement.plan.monthlyVoxels,
        currentPeriodEnd: entitlement.record?.currentPeriodEnd || null,
      },
    });
  } catch (error) {
    return privateJson({ ok: false, error: error instanceof Error ? error.message : 'The property address could not be confirmed.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireVoxelVaultUser(request);
  if (auth.ok === false) return privateJson({ ok: false, error: auth.error }, { status: auth.status });

  try {
    const body = await request.json().catch(() => ({}));
    const identityKey = clean(body?.identityKey, 100);
    if (!identityKey) return privateJson({ ok: true, released: false });
    const released = await releasePropertyCollectibleReservation(identityKey, auth.user.id);
    return privateJson({ ok: true, released });
  } catch {
    return privateJson({ ok: true, released: false });
  }
}
