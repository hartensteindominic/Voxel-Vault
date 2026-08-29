import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireVoxelVaultAdmin } from '../../../lib/admin-auth';

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

function clean(value: unknown, max = 240) {
  return String(value || '').trim().slice(0, max);
}

function safeSegment(value: unknown, fallback = 'property') {
  const text = clean(value, 180).replace(/[^a-zA-Z0-9_.:-]+/g, '-').replace(/^-+|-+$/g, '');
  return text || fallback;
}

async function ensureBucket(admin: any) {
  const { data, error } = await admin.storage.listBuckets();
  if (error) throw new Error('Private property-photo storage is unavailable.');
  if (!data?.some((bucket: any) => bucket.name === BUCKET)) {
    const created = await admin.storage.createBucket(BUCKET, { public: false, fileSizeLimit: '75MB' });
    if (created.error && !/already exists/i.test(String(created.error.message || ''))) {
      throw new Error('Private property-photo storage could not be prepared.');
    }
  }
}

export async function POST(request: Request) {
  const auth = await requireVoxelVaultAdmin(request);
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error, setupRequired: auth.setupRequired === true }, { status: auth.status });
  }

  try {
    const form = await request.formData();
    const photo = form.get('photo');
    const atlasId = clean(form.get('atlasId'), 180);
    const address = clean(form.get('address'), 220);
    const rightsConfirmed = clean(form.get('rightsConfirmed'), 16) === 'true';

    if (!(photo instanceof File)) {
      return NextResponse.json({ ok: false, error: 'Choose a property photo first.' }, { status: 400 });
    }
    if (!atlasId || !address) {
      return NextResponse.json({ ok: false, error: 'Resolve the property before uploading a photo.' }, { status: 400 });
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

    const bytes = await photo.arrayBuffer();
    const digest = createHash('sha256').update(Buffer.from(bytes)).digest('hex');
    const userId = safeSegment(auth.user.id, 'user');
    const propertyId = safeSegment(atlasId);
    const path = `property-references/${userId}/${propertyId}/${digest}.${extension}`;

    await ensureBucket(auth.admin);
    const uploaded = await auth.admin.storage.from(BUCKET).upload(path, bytes, {
      contentType: photo.type,
      cacheControl: '0',
      upsert: true,
    });
    if (uploaded.error) throw new Error('The property photo could not be stored privately.');

    const signed = await auth.admin.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
    if (signed.error || !signed.data?.signedUrl) throw new Error('The private property photo could not be opened for generation.');

    const uploadedAt = new Date().toISOString();
    return NextResponse.json({
      ok: true,
      reference: {
        url: signed.data.signedUrl,
        rightsBasis: 'user-owned',
        rightsReference: 'Signed-in Voxel Vault user confirmed they took this photo or have permission to use it for the property voxel.',
        label: 'Uploaded property photo',
        sourcePhotoId: `upload:${digest.slice(0, 20)}`,
        provider: 'user-upload',
        storagePath: path,
        uploadedAt,
      },
      privacy: 'The original upload is stored in a private bucket. The generator receives a short-lived signed URL only.',
    }, {
      headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Property photo upload failed.',
    }, { status: 400, headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  }
}
