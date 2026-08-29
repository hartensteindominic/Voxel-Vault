import { createHash, randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireVoxelVaultUser } from '../../../lib/user-auth';
import { normalizePropertyDraftId } from '../../../lib/property-generation-ids';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const BUCKET = 'voxel-system';
const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

class PrivateStorageError extends Error {}

function clean(value: unknown, max = 240) {
  return String(value || '').trim().slice(0, max);
}

function safeSegment(value: unknown, fallback = 'property') {
  const text = clean(value, 180).replace(/[^a-zA-Z0-9_.:-]+/g, '-').replace(/^-+|-+$/g, '');
  return text || fallback;
}

function storageMessage(error: any) {
  return String(error?.message || error?.error || error || '').slice(0, 500);
}

async function ensureBucket(admin: any) {
  const { data, error } = await admin.storage.listBuckets();
  if (error) {
    console.error('Voxel Vault private storage bucket list failed', { message: storageMessage(error) });
    throw new PrivateStorageError('Private photo storage is temporarily unavailable. Please try again in a moment.');
  }
  if (data?.some((bucket: any) => bucket.name === BUCKET)) return;

  const created = await admin.storage.createBucket(BUCKET, { public: false, fileSizeLimit: '75MB' });
  if (created.error && !/already exists|duplicate/i.test(storageMessage(created.error))) {
    console.error('Voxel Vault private storage bucket creation failed', { message: storageMessage(created.error) });
    throw new PrivateStorageError('Private photo storage needs server setup before uploads can continue.');
  }
}

async function uploadPrivatePhoto(admin: any, path: string, bytes: Buffer, contentType: string) {
  let lastError: any = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await ensureBucket(admin);
    const uploaded = await admin.storage.from(BUCKET).upload(path, bytes, {
      contentType,
      cacheControl: '0',
      upsert: false,
    });
    if (!uploaded.error) return;
    lastError = uploaded.error;
    console.error('Voxel Vault private property photo upload failed', {
      attempt: attempt + 1,
      message: storageMessage(uploaded.error),
    });
    if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 180));
  }
  throw new PrivateStorageError(`Private photo storage could not save this upload. ${storageMessage(lastError) ? 'The storage service rejected the write.' : 'Please try again.'}`);
}

export async function POST(request: Request) {
  const auth = await requireVoxelVaultUser(request);
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error, setupRequired: auth.setupRequired === true }, { status: auth.status });
  }

  try {
    const form = await request.formData();
    const photo = form.get('photo');
    const draftIdRaw = clean(form.get('draftId'), 100);
    const draftId = draftIdRaw ? normalizePropertyDraftId(draftIdRaw) : '';
    const atlasId = clean(form.get('atlasId'), 180);
    const address = clean(form.get('address'), 220);
    const rightsConfirmed = clean(form.get('rightsConfirmed'), 16) === 'true';

    if (!(photo instanceof File)) {
      return NextResponse.json({ ok: false, error: 'Choose a property photo first.' }, { status: 400 });
    }
    if (!draftId && (!atlasId || !address)) {
      return NextResponse.json({ ok: false, error: 'Start a photo creation or resolve the property before uploading.' }, { status: 400 });
    }
    if (!rightsConfirmed) {
      return NextResponse.json({ ok: false, error: 'Confirm that you took this photo or have permission to use it.' }, { status: 400 });
    }
    const extension = ALLOWED_TYPES.get(String(photo.type || '').toLowerCase());
    if (!extension) {
      return NextResponse.json({ ok: false, error: 'Use a JPG, PNG, or WebP property photo.' }, { status: 415 });
    }
    if (photo.size <= 0 || photo.size > MAX_BYTES) {
      return NextResponse.json({ ok: false, error: 'Property photos must be smaller than 8 MB.' }, { status: 413 });
    }

    const bytes = Buffer.from(await photo.arrayBuffer());
    const digest = createHash('sha256').update(bytes).digest('hex');
    const userId = safeSegment(auth.user.id, 'user');
    const subjectId = safeSegment(draftId || atlasId);
    const objectId = `${digest.slice(0, 20)}-${randomUUID().slice(0, 12)}`;
    const path = `property-references/${userId}/${subjectId}/${objectId}.${extension}`;

    await uploadPrivatePhoto(auth.admin, path, bytes, photo.type);

    const signed = await auth.admin.storage.from(BUCKET).createSignedUrl(path, 6 * 60 * 60);
    if (signed.error || !signed.data?.signedUrl) {
      console.error('Voxel Vault property photo signed URL failed', { message: storageMessage(signed.error) });
      throw new PrivateStorageError('Your photo was saved, but it could not be opened for generation yet. Please try again shortly.');
    }

    const uploadedAt = new Date().toISOString();
    return NextResponse.json({
      ok: true,
      draftId: draftId || null,
      reference: {
        url: signed.data.signedUrl,
        rightsBasis: 'user-owned',
        rightsReference: 'Signed-in Voxel Vault user confirmed they took this photo or have permission to use it for this digital property creation.',
        label: 'Uploaded property photo',
        sourcePhotoId: `upload:${digest.slice(0, 20)}`,
        provider: 'user-upload',
        storagePath: path,
        uploadedAt,
      },
      privacy: 'The original upload is stored privately. Generation receives short-lived signed access only.',
    }, {
      headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    });
  } catch (error) {
    const setupRequired = error instanceof PrivateStorageError;
    return NextResponse.json({
      ok: false,
      setupRequired,
      error: error instanceof Error ? error.message : 'Property photo upload failed.',
    }, {
      status: setupRequired ? 503 : 400,
      headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    });
  }
}
