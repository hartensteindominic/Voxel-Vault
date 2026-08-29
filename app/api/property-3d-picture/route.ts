import { NextResponse } from 'next/server';
import { stripe } from '../../../lib/stripe-server';
import { requireVoxelVaultUser } from '../../../lib/user-auth';
import { paidPropertyGenerationReceipt } from '../../../lib/property-generation-payment';
import { normalizePropertyDraftId } from '../../../lib/property-generation-ids';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const MAX_REFERENCE_CHARS = 4_200_000;
const OPENAI_EDIT_URL = 'https://api.openai.com/v1/images/edits';
const MESHY_IMAGE_URL = 'https://api.meshy.ai/openapi/v1/image-to-image';

function clean(value: unknown, max = 500) {
  return String(value || '').trim().slice(0, max);
}

function privateJson(body: unknown, init: ResponseInit = {}) {
  return NextResponse.json(body, {
    ...init,
    headers: { 'Cache-Control': 'private, no-store, max-age=0', ...(init.headers || {}) },
  });
}

function decodeReference(reference: string) {
  const match = reference.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/i);
  if (!match) throw new Error('Use a prepared JPG, PNG, or WebP house photo for the VoxelPop 3D picture.');
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > 3_100_000) {
    throw new Error('The prepared house photo is too large for the 3D picture renderer. Choose a smaller photo or screenshot.');
  }
  return { mime: match[1].toLowerCase(), bytes };
}

function renderPrompt() {
  return [
    'Transform the reference photo into a premium VoxelPop 3D collectible house render.',
    'The building in the reference is the subject and must remain recognizably the same building.',
    'Preserve every clearly visible identity cue: overall massing, roof shape and pitch, story count, facade width, window and door count and placement, porch or steps, trim, exterior colors, attached structures, and other permanent architectural details.',
    'Use crisp dimensional block and voxel-inspired architecture with refined realistic materials, clean edges, subtle bevels, soft studio daylight, grounded contact shadows, and a polished collectible/NFT-house presentation.',
    'Keep the visible facade geometry faithful. Do not add a floor, move windows, invent a garage, replace the roof, or turn it into a generic fantasy house.',
    'A slight three-quarter dimensional presentation is allowed only where it does not contradict the reference. Do not pretend the unseen rear or hidden sides are verified.',
    'Center one house, make it large and readable, use a simple warm neutral studio ground/background, and include no text, logos, labels, people, watermark, frame, or UI.',
  ].join(' ');
}

async function verifySavedPaidDraft(auth: any, draftId: string) {
  const { data, error } = await auth.admin
    .from('vault_profiles')
    .select('avatar_style')
    .eq('user_id', auth.user.id)
    .maybeSingle();
  if (error) throw new Error(`Your saved paid property could not be verified: ${error.message}`);
  const library = Array.isArray(data?.avatar_style?.property_draft_library)
    ? data.avatar_style.property_draft_library
    : [];
  const owned = library.some((draft: any) => (
    draft?.type === 'voxel-vault-property-3d-draft'
    && draft?.voxelpop?.paidCreation === true
    && clean(draft?.voxelpop?.creationDraftId, 100) === draftId
  ));
  if (!owned) throw new Error('This saved property is not verified as an already-paid VoxelPop creation for this account.');
}

async function verifyEntitlement(auth: any, draftId: string, generationSessionId: string) {
  if (generationSessionId === 'saved-property') {
    await verifySavedPaidDraft(auth, draftId);
    return 'saved-paid-property';
  }
  if (!generationSessionId) throw new Error('A paid VoxelPop creation is required before generating the 3D house picture.');
  const receipt = await paidPropertyGenerationReceipt(auth, stripe, generationSessionId);
  if (receipt.draftId !== draftId) throw new Error('This payment belongs to a different VoxelPop property creation.');
  return 'stripe-paid-creation';
}

async function openAiRender(reference: string, prompt: string) {
  const key = clean(process.env.OPENAI_API_KEY, 500);
  if (!key) return null;
  const { mime, bytes } = decodeReference(reference);
  const form = new FormData();
  form.append('model', 'gpt-image-2');
  form.append('prompt', prompt);
  form.append('size', '1024x1024');
  form.append('quality', 'medium');
  form.append('image', new Blob([bytes], { type: mime }), mime === 'image/png' ? 'house.png' : mime === 'image/webp' ? 'house.webp' : 'house.jpg');

  const response = await fetch(OPENAI_EDIT_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || 'The primary VoxelPop image renderer failed.');
  const first = payload?.data?.[0] || {};
  if (first?.b64_json) return { image: `data:image/png;base64,${first.b64_json}`, provider: 'openai-gpt-image-2' };
  if (first?.url) return { image: String(first.url), provider: 'openai-gpt-image-2' };
  throw new Error('The primary VoxelPop image renderer returned no image.');
}

async function pollMeshy(taskId: string, key: string) {
  for (let attempt = 0; attempt < 70; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1800));
    const response = await fetch(`${MESHY_IMAGE_URL}/${encodeURIComponent(taskId)}`, {
      headers: { Authorization: `Bearer ${key}` },
      cache: 'no-store',
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.message || payload?.error || 'Fallback VoxelPop image renderer failed.');
    const status = clean(payload?.status, 40).toUpperCase();
    const image = clean(payload?.image_url || payload?.output?.image_url || payload?.result?.image_url, 4000);
    if ((status === 'SUCCEEDED' || status === 'COMPLETED') && image) return image;
    if (status === 'FAILED' || status === 'CANCELED' || status === 'CANCELLED') {
      throw new Error(clean(payload?.task_error?.message || payload?.error || payload?.message, 600) || 'Fallback VoxelPop image renderer failed.');
    }
  }
  throw new Error('The fallback VoxelPop image renderer timed out.');
}

async function meshyRender(reference: string, prompt: string) {
  const key = clean(process.env.MESHY_API_KEY, 500);
  if (!key) return null;
  const response = await fetch(MESHY_IMAGE_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ai_model: 'nano-banana',
      prompt,
      reference_image_urls: [reference],
      aspect_ratio: '1:1',
      remove_background: false,
    }),
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || payload?.error || 'Fallback VoxelPop image renderer could not start.');
  const taskId = clean(payload?.result || payload?.id || payload?.task_id, 180);
  if (!taskId) throw new Error('Fallback VoxelPop image renderer returned no task ID.');
  const image = await pollMeshy(taskId, key);
  return { image, provider: 'meshy-nano-banana' };
}

export async function POST(request: Request) {
  const auth = await requireVoxelVaultUser(request);
  if (auth.ok === false) {
    return privateJson({ ok: false, error: auth.error, setupRequired: auth.setupRequired === true }, { status: auth.status });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const draftId = normalizePropertyDraftId(body?.draftId);
    const generationSessionId = clean(body?.generationSessionId, 260);
    const reference = String(body?.reference || '').trim();
    if (!reference || reference.length > MAX_REFERENCE_CHARS) {
      throw new Error('A prepared house reference image is required for the VoxelPop 3D picture.');
    }
    decodeReference(reference);
    const entitlement = await verifyEntitlement(auth, draftId, generationSessionId);
    const prompt = renderPrompt();

    let rendered = null;
    let primaryError = '';
    try {
      rendered = await openAiRender(reference, prompt);
    } catch (error) {
      primaryError = error instanceof Error ? error.message : String(error || 'Primary renderer failed.');
    }
    if (!rendered) {
      try {
        rendered = await meshyRender(reference, prompt);
      } catch (error) {
        const fallbackError = error instanceof Error ? error.message : String(error || 'Fallback renderer failed.');
        throw new Error([primaryError, fallbackError].filter(Boolean).join(' Fallback: '));
      }
    }
    if (!rendered?.image) {
      throw new Error(primaryError || 'No VoxelPop image-generation provider is configured.');
    }

    return privateJson({
      ok: true,
      draftId,
      entitlement,
      image: rendered.image,
      provider: rendered.provider,
      sourceStoredByVoxelVault: false,
      note: 'The authorized source photo was used transiently to create this VoxelPop 3D house render. The original photo was not written to Voxel Vault generation storage.',
    });
  } catch (error) {
    return privateJson({
      ok: false,
      error: error instanceof Error ? error.message : 'The VoxelPop 3D house picture could not be generated.',
    }, { status: 400 });
  }
}
