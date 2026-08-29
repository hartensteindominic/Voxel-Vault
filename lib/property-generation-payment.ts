import { createHash } from 'node:crypto';
import { normalizePropertyDraftId } from './property-generation-ids';

export const PROPERTY_VOXEL_GENERATION_PRICE_CENTS = 499;
export const PROPERTY_VOXEL_GENERATION_PRICE_LABEL = '$4.99';
export const PROPERTY_VOXEL_GENERATION_KIND = 'property_voxel_generation_v1';

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function clean(value: unknown, max = 500) {
  return String(value || '').trim().slice(0, max);
}

export async function describePaidPropertyPhoto(draftIdRaw: unknown, photo: File) {
  const draftId = normalizePropertyDraftId(clean(draftIdRaw, 100));
  if (!(photo instanceof File)) throw new Error('Choose a property photo first.');
  const contentType = String(photo.type || '').toLowerCase();
  if (!ALLOWED_TYPES.has(contentType)) throw new Error('Use a JPG, PNG, or WebP property photo.');
  if (photo.size <= 0 || photo.size > MAX_BYTES) throw new Error('Property photos must be smaller than 8 MB after preparation.');

  const bytes = Buffer.from(await photo.arrayBuffer());
  return {
    draftId,
    digest: createHash('sha256').update(bytes).digest('hex'),
    contentType,
    fileName: clean(photo.name || 'property-photo', 120) || 'property-photo',
    sizeBytes: bytes.length,
  };
}

// Kept as a compatibility no-op for older callers. Checkout photos are no longer
// uploaded to Supabase or any server staging bucket before Stripe.
export async function deleteStagedPropertyPhoto(_auth: any, _draftIdRaw: unknown) {
  return null;
}

export async function paidPropertyGenerationReceipt(auth: any, stripe: any, sessionIdRaw: unknown) {
  const sessionId = clean(sessionIdRaw, 260);
  if (!sessionId) throw new Error('The VoxelPop payment session is missing.');
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const metadata = session?.metadata || {};
  const draftId = normalizePropertyDraftId(clean(metadata.draft_id, 100));

  if (metadata.kind !== PROPERTY_VOXEL_GENERATION_KIND) throw new Error('This payment is not for a VoxelPop 3D creation.');
  if (session.payment_status !== 'paid') throw new Error('Payment has not completed yet.');
  if (session.client_reference_id !== auth.user.id || metadata.voxelpop_user_id !== auth.user.id) {
    throw new Error('This VoxelPop purchase belongs to a different account.');
  }
  if (session.currency !== 'usd' || Number(session.amount_total || 0) !== PROPERTY_VOXEL_GENERATION_PRICE_CENTS) {
    throw new Error('The VoxelPop payment amount could not be verified.');
  }
  if (metadata.price_cents !== String(PROPERTY_VOXEL_GENERATION_PRICE_CENTS) || metadata.rights_confirmed !== 'true') {
    throw new Error('The VoxelPop creation authorization is incomplete.');
  }

  const digest = clean(metadata.source_sha256, 80);
  const contentType = clean(metadata.source_content_type, 80).toLowerCase();
  if (!/^[a-f0-9]{64}$/i.test(digest)) throw new Error('The paid source photo fingerprint is invalid.');
  if (!ALLOWED_TYPES.has(contentType)) throw new Error('The paid source photo format is unsupported.');

  return {
    session,
    draftId,
    digest,
    contentType,
    fileName: clean(metadata.source_name, 120) || 'property-photo',
    sizeBytes: Math.max(0, Number(metadata.source_size_bytes || 0)),
  };
}

export async function verifyPaidPropertyPhoto(receipt: any, photo: File) {
  if (!(photo instanceof File)) throw new Error('Choose the same property photo again to finish your paid creation.');
  const contentType = String(photo.type || '').toLowerCase();
  if (!ALLOWED_TYPES.has(contentType)) throw new Error('Use a JPG, PNG, or WebP property photo.');
  if (photo.size <= 0 || photo.size > MAX_BYTES) throw new Error('Property photos must be smaller than 8 MB after preparation.');
  const bytes = Buffer.from(await photo.arrayBuffer());
  const digest = createHash('sha256').update(bytes).digest('hex');
  if (digest !== receipt.digest) throw new Error('This is not the same photo that was authorized at checkout. Choose the original photo and try again.');
  return { ...receipt, bytes, contentType };
}

export async function paidPropertyGenerationInput(auth: any, stripe: any, sessionIdRaw: unknown, photo: File) {
  const receipt = await paidPropertyGenerationReceipt(auth, stripe, sessionIdRaw);
  return verifyPaidPropertyPhoto(receipt, photo);
}
