import { createHash } from 'node:crypto';
import { normalizePropertyDraftId } from './property-generation-ids';
import { getSupabaseAdminCandidates } from './supabase-admin';

export const PROPERTY_VOXEL_GENERATION_PRICE_CENTS = 499;
export const PROPERTY_VOXEL_GENERATION_PRICE_LABEL = '$4.99';
export const PROPERTY_VOXEL_GENERATION_KIND = 'property_voxel_generation_v1';

const BUCKET = 'voxel-system';
const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function clean(value: unknown, max = 500) {
  return String(value || '').trim().slice(0, max);
}

function safeSegment(value: unknown, fallback = 'item') {
  const text = clean(value, 180).replace(/[^a-zA-Z0-9_.:-]+/g, '-').replace(/^-+|-+$/g, '');
  return text || fallback;
}

function storageClients(auth: any) {
  try {
    const candidates = getSupabaseAdminCandidates();
    if (candidates.length) return candidates;
  } catch {}
  return auth?.admin ? [auth.admin] : [];
}

function bucketMissing(error: any) {
  const status = Number(error?.statusCode ?? error?.status ?? 0);
  const message = String(error?.message || error || '');
  return status === 404 || /bucket.*not found|not found.*bucket|bucket.*does not exist/i.test(message);
}

async function ensureBucket(admin: any) {
  try {
    const created = await admin.storage.createBucket(BUCKET, { public: false, fileSizeLimit: '75MB' });
    return !created.error || /already exists/i.test(created.error?.message || '');
  } catch {
    return false;
  }
}

async function uploadStagedPhoto(admin: any, storagePath: string, bytes: Buffer, contentType: string) {
  const options = { contentType, cacheControl: '0', upsert: true };
  let uploaded = await admin.storage.from(BUCKET).upload(storagePath, bytes, options);
  if (!uploaded.error) return true;

  if (!bucketMissing(uploaded.error)) return false;
  if (!(await ensureBucket(admin))) return false;

  uploaded = await admin.storage.from(BUCKET).upload(storagePath, bytes, options);
  return !uploaded.error;
}

export function propertyGenerationStagePath(userId: unknown, draftIdRaw: unknown) {
  const draftId = normalizePropertyDraftId(clean(draftIdRaw, 100));
  return `property-paid-inputs/${safeSegment(userId, 'user')}/${safeSegment(draftId, 'draft')}/source`;
}

export async function stagePaidPropertyPhoto(auth: any, draftIdRaw: unknown, photo: File) {
  const draftId = normalizePropertyDraftId(clean(draftIdRaw, 100));
  if (!(photo instanceof File)) throw new Error('Choose a property photo first.');
  const contentType = String(photo.type || '').toLowerCase();
  if (!ALLOWED_TYPES.has(contentType)) throw new Error('Use a JPG, PNG, or WebP property photo.');
  if (photo.size <= 0 || photo.size > MAX_BYTES) throw new Error('Property photos must be smaller than 8 MB after preparation.');

  const bytes = Buffer.from(await photo.arrayBuffer());
  const digest = createHash('sha256').update(bytes).digest('hex');
  const storagePath = propertyGenerationStagePath(auth.user.id, draftId);

  let staged = false;
  for (const admin of storageClients(auth)) {
    try {
      if (await uploadStagedPhoto(admin, storagePath, bytes, contentType)) {
        staged = true;
        break;
      }
    } catch {}
  }
  if (!staged) {
    throw new Error('Private VoxelPop checkout storage is temporarily unavailable. No payment was started.');
  }

  return {
    draftId,
    storagePath,
    digest,
    contentType,
    fileName: clean(photo.name || 'property-photo', 120) || 'property-photo',
    sizeBytes: bytes.length,
  };
}

export async function deleteStagedPropertyPhoto(auth: any, draftIdRaw: unknown) {
  const storagePath = propertyGenerationStagePath(auth.user.id, draftIdRaw);
  for (const admin of storageClients(auth)) {
    try {
      const { error } = await admin.storage.from(BUCKET).remove([storagePath]);
      if (!error) break;
    } catch {}
  }
  return storagePath;
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

  const expectedPath = propertyGenerationStagePath(auth.user.id, draftId);
  const storagePath = clean(metadata.source_storage_path, 900);
  if (storagePath !== expectedPath) throw new Error('The paid source photo does not match this creation.');

  const digest = clean(metadata.source_sha256, 80);
  const contentType = clean(metadata.source_content_type, 80).toLowerCase();
  if (!/^[a-f0-9]{64}$/i.test(digest)) throw new Error('The paid source photo fingerprint is invalid.');
  if (!ALLOWED_TYPES.has(contentType)) throw new Error('The paid source photo format is unsupported.');

  return {
    session,
    draftId,
    storagePath,
    digest,
    contentType,
    fileName: clean(metadata.source_name, 120) || 'property-photo',
  };
}

export async function loadPaidPropertyGenerationPhoto(auth: any, receipt: any) {
  for (const admin of storageClients(auth)) {
    try {
      const { data, error } = await admin.storage.from(BUCKET).download(receipt.storagePath);
      if (error || !data) continue;
      const bytes = Buffer.from(await data.arrayBuffer());
      if (!bytes.length || bytes.length > MAX_BYTES) throw new Error('The paid source photo is invalid.');
      const digest = createHash('sha256').update(bytes).digest('hex');
      if (digest !== receipt.digest) throw new Error('The paid source photo changed after checkout started.');
      return { ...receipt, bytes };
    } catch (error) {
      if (error instanceof Error && /invalid|changed after checkout/i.test(error.message)) throw error;
    }
  }
  throw new Error('The paid source photo is no longer available.');
}

export async function paidPropertyGenerationInput(auth: any, stripe: any, sessionIdRaw: unknown) {
  const receipt = await paidPropertyGenerationReceipt(auth, stripe, sessionIdRaw);
  return loadPaidPropertyGenerationPhoto(auth, receipt);
}
