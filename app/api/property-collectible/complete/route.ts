import { NextResponse } from 'next/server';
import { stripe } from '../../../../lib/stripe-server';
import { requireVoxelVaultUser } from '../../../../lib/user-auth';
import { inspectWorldAtlas } from '../../../../lib/world-atlas.js';
import {
  propertyCollectiblePaymentErrorMessage,
  secureStripePropertyCollectiblePurchase,
  verifyOwnedFinalVoxelModel,
} from '../../../../lib/property-collectible-commerce';
import { propertyCollectibleModelAccessPath } from '../../../../lib/property-collectible-model-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function clean(value: unknown, max = 300) {
  return String(value || '').trim().slice(0, max);
}

function findMappedBuilding(atlas: any, atlasId: string) {
  const candidates = [atlas?.selectedBuilding, ...(Array.isArray(atlas?.buildings) ? atlas.buildings : [])].filter(Boolean);
  return candidates.find((item: any) => String(item?.atlasId || '') === atlasId) || null;
}

export async function GET(request: Request) {
  const auth = await requireVoxelVaultUser(request);
  if (auth.ok === false) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  try {
    const url = new URL(request.url);
    const sessionId = clean(url.searchParams.get('session_id') || url.searchParams.get('sessionId'), 260);
    if (!sessionId) return NextResponse.json({ ok: false, error: 'Checkout session is required.' }, { status: 400 });

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const purchase = await secureStripePropertyCollectiblePurchase({ session, expectedBuyerId: auth.user.id });

    let atlas: any = null;
    let building: any = {
      atlasId: purchase.atlasId,
      latitude: null,
      longitude: null,
      geometry: null,
      tags: { name: purchase.address },
      height: null,
      source: null,
    };
    try {
      atlas = await inspectWorldAtlas({ address: purchase.address, radiusMeters: 180 });
      const resolved = atlas?.ok ? findMappedBuilding(atlas, purchase.atlasId) : null;
      if (resolved) building = resolved;
    } catch {}

    const verifiedModel = await verifyOwnedFinalVoxelModel({
      userId: auth.user.id,
      draftId: purchase.draftId,
      modelTaskId: purchase.modelTaskId,
      atlasId: purchase.atlasId,
    });
    const durableModelUrl = verifiedModel.mapBacked
      ? null
      : propertyCollectibleModelAccessPath(purchase.identityKey, purchase.modelTaskId);
    const reference = atlas?.reference ? {
      ...atlas.reference,
      radiusMeters: atlas.radiusMeters || atlas.reference.radiusMeters || 180,
      neighborhoodBuildingCount: Number(atlas.buildingCount || atlas.reference?.neighborhoodBuildings?.length || 0),
    } : {
      found: Boolean(building?.geometry),
      latitude: building?.latitude ?? null,
      longitude: building?.longitude ?? null,
      radiusMeters: 180,
      geometry: building?.geometry || null,
      tags: building?.tags || { name: purchase.address },
      height: building?.height || null,
      neighborhoodBuildings: [],
      neighborhoodBuildingCount: 0,
      source: building?.source || null,
      note: 'Saved source-backed World reference for this digital collectible.',
    };

    return NextResponse.json({
      ok: true,
      paid: true,
      purchase: {
        identityKey: purchase.identityKey,
        atlasId: purchase.atlasId,
        address: purchase.address,
        draftId: purchase.draftId,
        modelTaskId: purchase.modelTaskId,
        priceCents: purchase.priceCents,
        priceTier: purchase.priceTier,
        priceLabel: purchase.priceLabel,
        paid: true,
        sessionId,
        purchasedAt: purchase.processedAt,
      },
      building,
      reference,
      model: {
        taskId: purchase.modelTaskId,
        itemId: verifiedModel.savedModel?.item_id || null,
        modelUrl: durableModelUrl,
        thumbnailUrl: verifiedModel.savedModel?.thumbnail_url || null,
        storage: verifiedModel.mapBacked
          ? 'source-backed-map-geometry'
          : verifiedModel.savedModel?.model_storage_path ? 'private-persisted-glb' : 'provider-fallback',
        mapBacked: verifiedModel.mapBacked === true,
      },
      next: {
        vault: '/vault/property-drafts',
        createAnother: '/property',
        world: '/world',
        verifyAndMint: '/vault/properties/claim',
      },
      disclosure: verifiedModel.mapBacked
        ? 'Payment secured one digital VoxelPop collectible for this mapped World building identity. Its interactive 3D is rebuilt from saved source-backed map geometry, so no Meshy generation credit or private GLB storage is required. It does not transfer real property or create deed/title, rent, occupancy, investment or appreciation rights. Minting remains optional and separately verified.'
        : 'Payment secured one digital VoxelPop collectible for this mapped World building identity. Its Vault model link re-issues short-lived access to the private persisted GLB instead of storing an expiring URL. It does not transfer real property or create deed/title, rent, occupancy, investment or appreciation rights. Minting remains optional and separately verified.',
    }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch (error) {
    const friendly = propertyCollectiblePaymentErrorMessage(error);
    return NextResponse.json({
      ok: false,
      error: friendly === 'The VoxelPop property collectible purchase could not be verified.'
        ? (error instanceof Error ? error.message : 'Property collectible completion failed.')
        : friendly,
    }, { status: 400, headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  }
}
