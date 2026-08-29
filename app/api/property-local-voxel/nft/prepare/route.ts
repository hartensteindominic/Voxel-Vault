import { createHash, createHmac } from 'node:crypto';
import { getBytes, keccak256, solidityPackedKeccak256, toUtf8Bytes, Wallet } from 'ethers';
import { NextResponse } from 'next/server';
import { requireVoxelVaultUser } from '../../../../../lib/user-auth';
import { readCatalog3DByTask } from '../../../../../lib/catalog3dStore';
import { getVoxelFlipDeployment } from '../../../../../lib/voxelflip-deployment';
import { normalizePropertyDraftId, propertyDraftItemId } from '../../../../../lib/property-generation-ids';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const PRIVATE_KEY_RE = /^[a-fA-F0-9]{64}$/;
const LOCAL_PROVIDER = 'voxelpop-local-webgl-v1';

function clean(value: unknown, max = 180) {
  return String(value || '').trim().slice(0, max);
}

function normalizePrivateKey(value: string) {
  const trimmed = value.trim();
  if (PRIVATE_KEY_RE.test(trimmed)) return `0x${trimmed}`;
  if (/^0X[a-fA-F0-9]{64}$/.test(trimmed)) return `0x${trimmed.slice(2)}`;
  return trimmed;
}

function signerSecret() {
  const raw = process.env.VOXELFLIP_MINT_SIGNER_PRIVATE_KEY?.trim() || '';
  return raw ? normalizePrivateKey(raw) : '';
}

function hmac(value: string) {
  const secret = signerSecret();
  return secret ? createHmac('sha256', secret).update(value).digest('hex') : '';
}

function safeLabel(value: unknown) {
  return clean(value || 'VoxelPop Property', 90).replace(/[<>]/g, '') || 'VoxelPop Property';
}

function propertyLibrary(profile: any) {
  const raw = profile?.avatar_style?.property_draft_library;
  return Array.isArray(raw) ? raw.filter((item) => item && item.type === 'voxel-vault-property-3d-draft') : [];
}

function voucherIdFor(taskId: string) {
  // One reviewed local voxel gets one canonical mint voucher regardless of
  // whether the user mints immediately or after later attaching map context.
  return `0x${createHash('sha256').update(`voxelpop-local-property:${taskId}`).digest('hex')}`;
}

async function signVoucher(walletAddress: string, metadataUrl: string, voucherId: string) {
  const secret = signerSecret();
  if (!secret) return null;
  const signer = new Wallet(secret);
  const uriHash = keccak256(toUtf8Bytes(metadataUrl));
  const digest = solidityPackedKeccak256(['address', 'bytes32', 'bytes32'], [walletAddress, uriHash, voucherId]);
  const signature = await signer.signMessage(getBytes(digest));
  return { signature, signer: signer.address };
}

export async function POST(request: Request) {
  const auth = await requireVoxelVaultUser(request);
  if (auth.ok === false) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  try {
    const body = await request.json().catch(() => ({}));
    const draftId = normalizePropertyDraftId(body?.draftId);
    const wallet = clean(body?.wallet, 60);
    const requestedTaskId = clean(body?.taskId, 160);
    if (!ADDRESS_RE.test(wallet)) {
      return NextResponse.json({ ok: false, error: 'Connect a valid wallet before minting.' }, { status: 400 });
    }

    let taskId = requestedTaskId;
    let label = safeLabel(body?.label || 'VoxelPop Property');
    let model = null;

    if (requestedTaskId) {
      // Immediate mint path: the reviewed voxel has already been persisted under
      // an account-scoped item ID by /api/property-local-voxel. No address/map
      // record is required just to mint the digital asset.
      if (!requestedTaskId.startsWith('local-v1:')) {
        return NextResponse.json({ ok: false, error: 'Create and approve the local 3D voxel before minting.' }, { status: 409 });
      }
      model = await readCatalog3DByTask(requestedTaskId);
      const expectedItemId = propertyDraftItemId(auth.user.id, draftId, 'voxel');
      if (!model || model.item_id !== expectedItemId) {
        return NextResponse.json({ ok: false, error: 'This reviewed voxel is not bound to your signed-in creation.' }, { status: 403 });
      }
    } else {
      // Saved-Vault path: recover the exact model task from the signed-in user's
      // saved property draft and verify that model below.
      const { data: profile, error: profileError } = await auth.admin
        .from('vault_profiles')
        .select('avatar_style')
        .eq('user_id', auth.user.id)
        .maybeSingle();
      if (profileError) throw new Error(`Your saved property could not be opened: ${profileError.message}`);

      const draft = propertyLibrary(profile).find((item) => String(item.id) === draftId);
      if (!draft) return NextResponse.json({ ok: false, error: 'This saved property is not in your signed-in Vault.' }, { status: 404 });
      taskId = clean(draft?.voxelpop?.modelTaskId, 160);
      label = safeLabel(draft?.label || draft?.world?.publicLabel || label);
      if (!taskId.startsWith('local-v1:')) {
        return NextResponse.json({ ok: false, error: 'Create and approve the local 3D voxel before minting.' }, { status: 409 });
      }
      model = await readCatalog3DByTask(taskId);
      const expectedItemId = propertyDraftItemId(auth.user.id, draft?.voxelpop?.creationDraftId || draftId, 'voxel');
      if (!model || model.item_id !== expectedItemId) {
        return NextResponse.json({ ok: false, error: 'The saved reviewed voxel is not bound to this signed-in account.' }, { status: 403 });
      }
    }

    if (!model || model.provider !== LOCAL_PROVIDER || model.status !== 'SUCCEEDED' || !model.model_url) {
      return NextResponse.json({ ok: false, error: 'The reviewed local voxel is not available for minting yet.' }, { status: 409 });
    }

    const deployment = await getVoxelFlipDeployment();
    if (!ADDRESS_RE.test(deployment?.address || '') || !ADDRESS_RE.test(deployment?.mintSigner || '')) {
      return NextResponse.json({ ok: false, error: 'VoxelFlip minting is not configured on this deployment yet.' }, { status: 503 });
    }
    if (!signerSecret()) {
      return NextResponse.json({ ok: false, error: 'VoxelFlip mint signing is not configured on this deployment yet.' }, { status: 503 });
    }

    const metadataSig = hmac(`local-property-metadata:${draftId}:${taskId}:${label}`);
    const origin = new URL(request.url).origin;
    const metadataUrl = `${origin}/api/property-local-voxel/nft/metadata?${new URLSearchParams({ draftId, taskId, label, sig: metadataSig }).toString()}`;
    const voucherId = voucherIdFor(taskId);
    const voucher = await signVoucher(wallet, metadataUrl, voucherId);
    if (!voucher) return NextResponse.json({ ok: false, error: 'VoxelFlip mint signing is unavailable.' }, { status: 503 });
    if (voucher.signer.toLowerCase() !== deployment.mintSigner.toLowerCase()) {
      return NextResponse.json({ ok: false, error: 'VoxelFlip mint signer does not match the reviewed production collection.' }, { status: 503 });
    }

    return NextResponse.json({
      ok: true,
      ready: true,
      draftId,
      taskId,
      label,
      wallet,
      metadataUrl,
      modelUrl: model.model_url,
      voucherId,
      signature: voucher.signature,
      signer: voucher.signer,
      contractAddress: deployment.address,
      chainId: deployment.chainId || 8453,
      note: 'This voucher mints the reviewed digital voxel only. It does not represent the deed or physical-property rights.',
    }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'The local property voxel could not be prepared for minting.' }, { status: 500 });
  }
}
