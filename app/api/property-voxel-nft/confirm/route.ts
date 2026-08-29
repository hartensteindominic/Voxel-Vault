import { NextResponse } from 'next/server';
import { requireVoxelVaultUser } from '../../../../lib/user-auth';
import { listPaidPropertyCollectiblesForBuyer, updatePropertyCollectibleReservation, verifyOwnedFinalVoxelModel } from '../../../../lib/property-collectible-commerce';
import { propertyVoxelMetadataUrl, propertyVoxelVoucherId, verifyPropertyVoxelMint } from '../../../../lib/property-voxel-mint';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const LOCAL_PROVIDER = 'voxelpop-local-webgl-v1';

function clean(value: unknown, max = 300) { return String(value || '').trim().slice(0, max); }
function privateJson(body: unknown, init: ResponseInit = {}) { return NextResponse.json(body, { ...init, headers: { 'Cache-Control': 'private, no-store, max-age=0', ...(init.headers || {}) } }); }

export async function POST(request: Request) {
  const auth = await requireVoxelVaultUser(request);
  if (auth.ok === false) return privateJson({ ok: false, error: auth.error }, { status: auth.status });
  try {
    const body = await request.json().catch(() => ({}));
    const draftId = clean(body?.draftId, 100);
    const taskId = clean(body?.taskId, 260);
    const name = clean(body?.name, 72) || 'VoxelPop Property';
    const wallet = clean(body?.wallet, 60);
    const tokenId = clean(body?.tokenId, 100);
    const txHash = clean(body?.txHash, 100);
    if (!draftId || !taskId || !ADDRESS_RE.test(wallet) || !tokenId || !txHash) return privateJson({ ok: false, error: 'Mint confirmation details are incomplete.' }, { status: 400 });

    const owned = await verifyOwnedFinalVoxelModel({ userId: auth.user.id, draftId, modelTaskId: taskId });
    if (!owned.savedModel || owned.savedModel.provider !== LOCAL_PROVIDER || !taskId.startsWith('local-v1:')) return privateJson({ ok: false, error: 'This mint does not match a finished local property voxel owned by this account.' }, { status: 403 });

    const reservations = await listPaidPropertyCollectiblesForBuyer(auth.user.id);
    const reservation = reservations.find((item) => item.draftId === owned.draftId) || null;
    if (!reservation) return privateJson({ ok: false, error: 'The canonical one-property purchase lock does not match this mint.' }, { status: 403 });
    const propertyIdentity = reservation.identityKey;

    const origin = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/$/, '');
    const metadataUrl = propertyVoxelMetadataUrl(origin, owned.draftId, taskId, name);
    const voucherId = propertyVoxelVoucherId(propertyIdentity);
    const verified = await verifyPropertyVoxelMint({ tokenId, wallet, txHash, voucherId, metadataUrl });

    if (reservation.state !== 'minted') await updatePropertyCollectibleReservation({ identityKey: propertyIdentity, buyerId: auth.user.id, state: 'minted', source: 'base-voxel-mint', sourceId: txHash });

    return privateJson({ ok: true, verified: true, ...verified, draftId: owned.draftId, taskId, propertyIdentity, atlasId: reservation.atlasId, propertyAddress: reservation.address, onePropertyOneMint: true, digitalOnly: true, physicalPropertyRights: false });
  } catch (error) {
    return privateJson({ ok: false, error: error instanceof Error ? error.message : 'The Base mint could not be verified.' }, { status: 409 });
  }
}
