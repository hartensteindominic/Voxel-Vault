import { NextResponse } from 'next/server';
import { requireVoxelVaultUser } from '../../../../lib/user-auth';
import { listPaidPropertyCollectiblesForBuyer, verifyOwnedFinalVoxelModel } from '../../../../lib/property-collectible-commerce';
import { getVoxelFlipDeployment } from '../../../../lib/voxelflip-deployment';
import { buildPropertyVoxelVoucher, propertyVoxelVoucherUsed } from '../../../../lib/property-voxel-mint';

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
    const wallet = clean(body?.wallet, 60);
    const name = clean(body?.name, 72) || 'VoxelPop Property';
    if (!draftId || !taskId || !ADDRESS_RE.test(wallet)) return privateJson({ ok: false, error: 'A finished property voxel and connected wallet are required.' }, { status: 400 });

    const owned = await verifyOwnedFinalVoxelModel({ userId: auth.user.id, draftId, modelTaskId: taskId });
    if (!owned.savedModel || owned.savedModel.provider !== LOCAL_PROVIDER || !taskId.startsWith('local-v1:')) return privateJson({ ok: false, error: 'Finish the local photo-approved voxel before minting.' }, { status: 409 });

    const reservations = await listPaidPropertyCollectiblesForBuyer(auth.user.id);
    const reservation = reservations.find((item) => item.draftId === owned.draftId) || null;
    if (!reservation) return privateJson({ ok: false, error: 'This property does not have a paid one-of-one purchase lock for this account.' }, { status: 403 });
    if (reservation.state === 'minted') return privateJson({ ok: false, alreadyMinted: true, error: 'This property has already been minted. A second NFT for the same property is blocked.' }, { status: 409 });
    const propertyIdentity = reservation.identityKey;

    const origin = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/$/, '');
    const voucher = await buildPropertyVoxelVoucher({ propertyIdentity, draftId: owned.draftId, taskId, wallet, name, origin });
    const deployment = await getVoxelFlipDeployment();
    if (voucher.signer.toLowerCase() !== deployment.mintSigner.toLowerCase()) return privateJson({ ok: false, error: 'VoxelFlip mint signer does not match the reviewed Base deployment.' }, { status: 503 });

    let used = false;
    try { used = await propertyVoxelVoucherUsed(voucher.voucherId); }
    catch { return privateJson({ ok: false, error: 'Base could not be checked safely. No mint was sent. Try again before approving a wallet transaction.' }, { status: 503 }); }
    if (used) return privateJson({ ok: false, alreadyMinted: true, error: 'This property has already used its one-time VoxelFlip mint voucher. A duplicate mint is blocked.' }, { status: 409 });

    return privateJson({ ok: true, ready: true, mintConfigured: true, wallet, draftId: owned.draftId, taskId, propertyIdentity, atlasId: reservation.atlasId, propertyAddress: reservation.address, modelUrl: owned.modelUrl, metadataUrl: voucher.metadataUrl, voucherId: voucher.voucherId, signature: voucher.signature, signer: voucher.signer, contractAddress: deployment.address, chainId: deployment.chainId, network: deployment.network, onePropertyOneMint: true, digitalOnly: true, noMeshy: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Property voxel mint could not be prepared.';
    return privateJson({ ok: false, error: message }, { status: /does not belong|signed-in|valid|required/i.test(message) ? 403 : 500 });
  }
}
