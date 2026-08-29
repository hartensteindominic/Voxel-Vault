import { getAddress } from 'ethers';
import { NextResponse } from 'next/server';
import { stripe } from '../../../../../lib/stripe-server';
import { requireVoxelVaultUser } from '../../../../../lib/user-auth';
import { readCatalog3DByTask } from '../../../../../lib/catalog3dStore';
import { propertyDraftItemId, normalizePropertyDraftId } from '../../../../../lib/property-generation-ids';
import { paidPropertyGenerationReceipt } from '../../../../../lib/property-generation-payment';
import {
  buildPropertyVoxelVoucher,
  findExistingPropertyVoxelMint,
  propertyVoxelMintReady,
  propertyVoxelVoucherId,
} from '../../../../../lib/property-voxel-mint';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
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
    const walletRaw = String(body?.wallet || '').trim();
    if (!generationSessionId || !taskId || !ADDRESS_RE.test(walletRaw)) {
      return privateJson({ ok: false, error: 'A paid property creation, finished local voxel, and connected wallet are required.' }, { status: 400 });
    }
    const wallet = getAddress(walletRaw);

    const receipt = await paidPropertyGenerationReceipt(auth, stripe, generationSessionId);
    if (receipt.draftId !== draftId) return privateJson({ ok: false, error: 'This payment does not belong to the selected property creation.' }, { status: 403 });

    const saved = await readCatalog3DByTask(taskId);
    const expectedItemId = propertyDraftItemId(auth.user.id, draftId, 'voxel');
    if (!saved || saved.provider !== LOCAL_PROVIDER || saved.item_id !== expectedItemId || !saved.model_url) {
      return privateJson({ ok: false, error: 'Finish and save this local property voxel before minting.' }, { status: 409 });
    }

    const voucherId = propertyVoxelVoucherId(auth.user.id, draftId, taskId);
    const existing = await findExistingPropertyVoxelMint(wallet, voucherId);
    if (!existing.checked) {
      return privateJson({ ok: false, error: 'Base could not be checked safely, so no mint was prepared. Try again before approving any wallet transaction.' }, { status: 503 });
    }
    if (existing.used) {
      if (existing.mint?.walletMatches) {
        return privateJson({
          ok: true,
          ready: false,
          alreadyMinted: true,
          voucherId,
          contractAddress: existing.deployment.address,
          existingMint: existing.mint,
          message: `VoxelFlip #${existing.mint.tokenId} already represents this property voxel. No duplicate mint is needed.`,
        });
      }
      return privateJson({ ok: false, alreadyMinted: true, error: 'This one-time property voxel voucher was already used. VoxelFlip blocked a duplicate mint.' }, { status: 409 });
    }

    if (!propertyVoxelMintReady()) {
      return privateJson({ ok: false, error: 'The secure VoxelFlip mint signer is not configured on this deployment.' }, { status: 503 });
    }

    const voucher = await buildPropertyVoxelVoucher({
      userId: auth.user.id,
      draftId,
      taskId,
      wallet,
      origin: new URL(request.url).origin,
    });

    return privateJson({
      ok: true,
      ready: true,
      wallet,
      contractAddress: existing.deployment.address,
      chainId: existing.deployment.chainId,
      taskId,
      draftId,
      modelUrl: saved.model_url,
      ...voucher,
      disclosure: 'This optional NFT represents the digital VoxelPop 3D voxel only. It is not a deed, title record, property share, lease, rent right, or investment security.',
    });
  } catch (error) {
    return privateJson({ ok: false, error: error instanceof Error ? error.message : 'This property voxel mint could not be prepared.' }, { status: 400 });
  }
}
