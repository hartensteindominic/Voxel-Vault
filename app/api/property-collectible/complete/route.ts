import { NextResponse } from 'next/server';
import { stripe } from '../../../../lib/stripe-server';
import { requireVoxelVaultUser } from '../../../../lib/user-auth';
import { inspectWorldAtlas } from '../../../../lib/world-atlas.js';
import { createModelSignedUrl, readCatalog3DByTask } from '../../../../lib/catalog3dStore';
import { propertyDraftItemId } from '../../../../lib/property-generation-ids';
import {
  propertyCollectiblePaymentErrorMessage,
  secureStripePropertyCollectiblePurchase,
} from '../../../../lib/property-collectible-commerce';

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
    const sessionId = clean(url.searchParams.get('sessionId'), 260);
    if (!sessionId) return NextResponse.json({ ok: false, error: 'Checkout session is required.' }, { status: 400 });

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const purchase = await secureStripePropertyCollectiblePurchase({ session, expectedBuyerId: auth.user.id });

    const atlas = await inspectWorldAtlas({ address: purchase.address, radiusMeters: 180 });
    if (!atlas?.ok) throw new Error(atlas?.error || 'The purchased property could not be restored on World.');
    const building = findMappedBuilding(atlas, purchase.atlasId);
    if (!building) throw new Error('The purchased mapped building identity could not be restored. Your payment remains recorded; support can recover the Vault item from the purchase record.');

    const model = await readCatalog3DByTask(purchase.modelTaskId);
    const expectedItemId = propertyDraftItemId(auth.user.id, purchase.draftId, 'voxel');
    if (!model?.item_id || model.item_id !== expectedItemId) throw new Error('The purchased voxel model no longer matches this signed-in creation.');
    const modelUrl = model.model_storage_path
      ? await createModelSignedUrl(model.model_storage_path, 6 * 60 * 60)
      : model.model_url;
    if (!modelUrl) throw new Error('The purchased voxel model is stored but could not be opened right now.');

    return NextResponse.json({
      ok: true,
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
      },
      building,
      model: {
        taskId: purchase.modelTaskId,
        modelUrl,
        thumbnailUrl: model.thumbnail_url || null,
      },
      disclosure: 'Payment secured one digital VoxelPop collectible for this mapped World building identity. It does not transfer the real property or create deed/title, rent, occupancy, investment or appreciation rights. Optional minting remains downstream of property verification.',
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
