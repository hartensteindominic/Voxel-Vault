import { normalizePropertyDraftId } from './property-generation-ids';

export const PROPERTY_VOXEL_GENERATION_PRICE_CENTS = 499;
export const PROPERTY_VOXEL_GENERATION_PRICE_LABEL = '$4.99';
export const PROPERTY_VOXEL_GENERATION_KIND = 'property_voxel_generation_v1';

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function clean(value: unknown, max = 500) {
  return String(value || '').trim().slice(0, max);
}

export function preparePropertyGenerationCheckoutPhoto(input: {
  draftId?: unknown;
  digest?: unknown;
  contentType?: unknown;
  fileName?: unknown;
  sizeBytes?: unknown;
}) {
  const draftId = normalizePropertyDraftId(clean(input.draftId, 100));
  const digest = clean(input.digest, 80).toLowerCase();
  const contentType = clean(input.contentType, 80).toLowerCase();
  const fileName = clean(input.fileName || 'property-photo', 120) || 'property-photo';
  const sizeBytes = Number(input.sizeBytes || 0);

  if (!/^[a-f0-9]{64}$/i.test(digest)) throw new Error('The checkout photo fingerprint is invalid.');
  if (!ALLOWED_TYPES.has(contentType)) throw new Error('Use a JPG, PNG, or WebP property photo.');
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_BYTES) {
    throw new Error('Property photos must be smaller than 8 MB after preparation.');
  }

  return { draftId, digest, contentType, fileName, sizeBytes };
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

  const digest = clean(metadata.source_sha256, 80).toLowerCase();
  const contentType = clean(metadata.source_content_type, 80).toLowerCase();
  const fileName = clean(metadata.source_name, 120) || 'property-photo';
  const sizeBytes = Number(metadata.source_size_bytes || 0);
  if (!/^[a-f0-9]{64}$/i.test(digest)) throw new Error('The paid source photo fingerprint is invalid.');
  if (!ALLOWED_TYPES.has(contentType)) throw new Error('The paid source photo format is unsupported.');
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_BYTES) {
    throw new Error('The paid source photo size is invalid.');
  }

  return { session, draftId, digest, contentType, fileName, sizeBytes };
}
