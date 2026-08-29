import { getAddress } from 'ethers';
import { NextResponse } from 'next/server';
import { readCatalog3D } from '../../../../../lib/catalog3dStore';
import { requireVoxelVaultUser } from '../../../../../lib/user-auth';
import { getStripe } from '../../../../../lib/stripe-server';
import { paidPropertyGenerationReceipt } from '../../../../../lib/property-generation-payment';
import { normalizePropertyDraftId, propertyDraftItemId } from '../../../../../lib/property-generation-ids';
import {
  buildPropertyLocalMintVoucher,
  isPropertyLocalVoucherUsed,
  propertyLocalMintReady,
  propertyLocalVoucherId,
} from '../../../../../lib/property-local-mint';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

function clean(value: unknown, max = 180) {
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
  if (auth.ok === false) return privateJson({ ready: false, error: auth.error }, { status: auth.status });

  try {
    const body = await request.json().catch(() => ({}));
    const generationSessionId = clean(body?.generationSessionId, 260);
    const draftId = normalizePropertyDraftId(body?.draftId);
    const taskId = clean(body?.taskId, 180);
    const walletRaw = clean(body?.wallet, 80);
    const name = clean(body?.name, 90) || 'VoxelPop Property';
    if (!generationSessionId || !taskId || !ADDRESS_RE.test(walletRaw)) {
      return privateJson({ ready: false, error: 'A paid creation, finished local voxel, and connected wallet are required.' }, { status: 400 });
    }
    const wallet = getAddress(walletRaw);

    const stripe = getStripe();
    const receipt = await paidPropertyGenerationReceipt(auth, stripe, generationSessionId);
    if (receipt.draftId !== draftId) {
      return privateJson({ ready: false, error: 'This $4.99 creation receipt does not belong to the voxel being minted.' }, { status: 403 });
    }

    const itemId = propertyDraftItemId(auth.user.id, draftId, 'voxel');
    const model = await readCatalog3D(itemId);
    if (!model || model.task_id !== taskId || model.status !== 'SUCCEEDED' || !String(model.provider || '').startsWith('voxelpop-local-webgl')) {
      return privateJson({ ready: false, error: 'Finish and save the approved local voxel before minting it.' }, { status: 409 });
    }
    if (!model.model_url) {
      return privateJson({ ready: false, error: 'The local voxel exists, but its durable model link is not ready yet. Retry the voxel save before minting.' }, { status: 409 });
    }
    if (!propertyLocalMintReady()) {
      return privateJson({ ready: false, error: 'VoxelFlip mint signing is not configured on this deployment yet.' }, { status: 503 });
    }

    const voucherId = propertyLocalVoucherId(auth.user.id, draftId, taskId);
    let alreadyMinted = false;
    try {
      alreadyMinted = await isPropertyLocalVoucherUsed(voucherId);
    } catch {
      return privateJson({ ready: false, error: 'Base could not be checked safely, so no mint was prepared. Try again; no transaction was sent.' }, { status: 503 });
    }
    if (alreadyMinted) {
      return privateJson({ ready: false, alreadyMinted: true, error: 'This approved property voxel has already been minted. A duplicate mint was blocked.' }, { status: 409 });
    }

    const voucher = await buildPropertyLocalMintVoucher({
      userId: auth.user.id,
      draftId,
      taskId,
      wallet,
      name,
      origin: new URL(request.url).origin,
    });

    return privateJson({
      ready: true,
      draftId,
      taskId,
      wallet,
      name,
      modelUrl: model.model_url,
      provider: model.provider,
      chain: 'Base',
      contract: 'VoxelFlip',
      ...voucher,
    });
  } catch (error) {
    return privateJson({ ready: false, error: error instanceof Error ? error.message : 'The property voxel mint could not be prepared.' }, { status: 400 });
  }
}
