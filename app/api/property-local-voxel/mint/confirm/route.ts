import { getAddress } from 'ethers';
import { NextResponse } from 'next/server';
import { stripe } from '../../../../../../lib/stripe-server';
import { requireVoxelVaultUser } from '../../../../../../lib/user-auth';
import { readCatalog3DByTask } from '../../../../../../lib/catalog3dStore';
import { propertyDraftItemId, normalizePropertyDraftId } from '../../../../../../lib/property-generation-ids';
import { paidPropertyGenerationReceipt } from '../../../../../../lib/property-generation-payment';
import { verifyPropertyVoxelMintOnBase } from '../../../../../../lib/property-voxel-mint';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const TX_RE = /^0x[a-fA-F0-9]{64}$/;
const LOCAL_PROVIDER = 'voxelpop-local-webgl-v1';

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
    const generationSessionId = String(body?.generationSessionId || '').trim().slice(0, 260);
    const draftId = normalizePropertyDraftId(body?.draftId);
    const taskId = String(body?.taskId || '').trim().slice(0, 180);
    const tokenId = String(body?.tokenId || '').trim();
    const txHash = String(body?.txHash || body?.hash || '').trim();
    const walletRaw = String(body?.wallet || body?.owner || '').trim();
    const metadataUrl = String(body?.metadataUrl || '').trim().slice(0, 1200);
    if (!generationSessionId || !taskId || !/^\d+$/.test(tokenId) || !TX_RE.test(txHash) || !ADDRESS_RE.test(walletRaw) || !/^https:\/\//i.test(metadataUrl)) {
      return privateJson({ ok: false, error: 'Mint confirmation details are incomplete.' }, { status: 400 });
    }
    const wallet = getAddress(walletRaw);

    const receipt = await paidPropertyGenerationReceipt(auth, stripe, generationSessionId);
    if (receipt.draftId !== draftId) return privateJson({ ok: false, error: 'This paid creation does not match the minted property voxel.' }, { status: 403 });

    const saved = await readCatalog3DByTask(taskId);
    const expectedItemId = propertyDraftItemId(auth.user.id, draftId, 'voxel');
    if (!saved || saved.provider !== LOCAL_PROVIDER || saved.item_id !== expectedItemId || !saved.model_url) {
      return privateJson({ ok: false, error: 'The minted model is not the signed-in account’s saved local property voxel.' }, { status: 403 });
    }

    const verified = await verifyPropertyVoxelMintOnBase({ tokenId, txHash, wallet, metadataUrl });
    return privateJson({
      ok: true,
      confirmed: true,
      tokenId,
      wallet: verified.owner,
      contractAddress: verified.deployment.address,
      txHash,
      metadataUrl,
      explorerUrl: `https://basescan.org/tx/${txHash}`,
      openSeaUrl: `https://opensea.io/assets/base/${verified.deployment.address}/${tokenId}`,
      disclosure: 'Confirmed as a Base VoxelFlip NFT of the digital VoxelPop 3D voxel. It does not create ownership or other rights in the physical property.',
    });
  } catch (error) {
    return privateJson({
      ok: false,
      error: error instanceof Error ? error.message : 'The Base mint is not verified yet. Do not mint again; retry verification.',
    }, { status: 409 });
  }
}
