import { NextResponse } from 'next/server';
import { stripe } from '../../../lib/stripe-server';
import { requireVoxelVaultUser } from '../../../lib/user-auth';
import { paidPropertyGenerationReceipt } from '../../../lib/property-generation-payment';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function clean(value: unknown, max = 260) {
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
  if (auth.ok === false) {
    return privateJson({ ok: false, error: auth.error, setupRequired: auth.setupRequired === true }, { status: auth.status });
  }

  try {
    const form = await request.formData();
    const generationSessionId = clean(form.get('generationSessionId'), 260);
    if (!generationSessionId) {
      return privateJson({
        ok: false,
        paymentRequired: true,
        migrated: true,
        error: 'Use the Property maker to pay $4.99 before creating a VoxelPop preview.',
      }, { status: 402 });
    }

    const receipt = await paidPropertyGenerationReceipt(auth, stripe, generationSessionId);
    return privateJson({
      ok: false,
      paid: true,
      migrated: true,
      draftId: receipt.draftId,
      meshyCredits: 0,
      sourcePhotoUploaded: false,
      error: 'Payment is verified. This creation now runs on-device and uses the source-backed 3D map; the legacy Meshy photo-upload handoff is disabled. Return to the Property maker to continue without spending Meshy credits.',
    }, { status: 409 });
  } catch (error) {
    return privateJson({
      ok: false,
      error: error instanceof Error ? error.message : 'The legacy property generation handoff is unavailable.',
    }, { status: 400 });
  }
}
