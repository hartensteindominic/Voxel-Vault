import { NextResponse } from 'next/server';
import { requireVoxelVaultAdmin } from '../../../../lib/admin-auth';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

const BUCKET = 'voxel-system';
const MAX_BYTES = 12 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
const ALLOWED_RIGHTS = new Set(['user-owned', 'open-licensed', 'licensed-derivative']);

function extensionFor(type: string) {
  if (type === 'image/png') return 'png';
  if (type === 'image/webp') return 'webp';
  if (type === 'image/heic') return 'heic';
  if (type === 'image/heif') return 'heif';
  return 'jpg';
}

async function ensureBucket(admin: any) {
  const { data, error } = await admin.storage.listBuckets();
  if (error) throw new Error('Private model storage is unavailable.');
  if (data?.some((bucket: any) => bucket.name === BUCKET)) return;
  const created = await admin.storage.createBucket(BUCKET, { public: false, fileSizeLimit: '75MB' });
  if (created.error && !/already exists/i.test(created.error.message || '')) throw new Error('Private model storage could not be prepared.');
}

export async function POST(request: Request) {
  const auth = await requireVoxelVaultAdmin(request);
  if (auth.ok === false) return NextResponse.json({ error: auth.error, configured: false }, { status: auth.status });

  try {
    const form = await request.formData();
    const file = form.get('file');
    const rightsBasis = String(form.get('rightsBasis') || 'user-owned').trim().toLowerCase();
    const rightsReferenceInput = String(form.get('rightsReference') || '').trim().slice(0, 400);
    if (!(file instanceof File)) return NextResponse.json({ error: 'Choose a reference image first.' }, { status: 400 });
    if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: 'Reference must be JPEG, PNG, WebP, HEIC or HEIF.' }, { status: 415 });
    if (file.size <= 0 || file.size > MAX_BYTES) return NextResponse.json({ error: 'Reference image must be 12 MB or smaller.' }, { status: 413 });
    if (!ALLOWED_RIGHTS.has(rightsBasis)) return NextResponse.json({ error: 'A supported derivative-generation rights basis is required.' }, { status: 400 });

    await ensureBucket(auth.admin);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const nonce = crypto.randomUUID().slice(0, 12);
    const extension = extensionFor(file.type);
    const imagePath = `world-references/${auth.user.id}/${stamp}-${nonce}.${extension}`;
    const rightsPath = `${imagePath}.rights.json`;
    const bytes = await file.arrayBuffer();
    const { error: uploadError } = await auth.admin.storage.from(BUCKET).upload(imagePath, bytes, {
      contentType: file.type,
      cacheControl: '0',
      upsert: false,
    });
    if (uploadError) throw new Error('Reference image could not be stored.');

    const rightsReference = rightsReferenceInput || `Owner attestation ${new Date().toISOString()}`;
    const rightsRecord = {
      schema: 'voxel-vault-world-reference-rights-v1',
      uploadedAt: new Date().toISOString(),
      userId: auth.user.id,
      userEmail: auth.user.email || null,
      originalFileName: String(file.name || '').slice(0, 180),
      contentType: file.type,
      sizeBytes: file.size,
      rightsBasis,
      rightsReference,
      purpose: 'Meshy derivative-generation reference for a selected Voxel Vault world-atlas hero model',
    };
    const { error: rightsError } = await auth.admin.storage.from(BUCKET).upload(rightsPath, JSON.stringify(rightsRecord), {
      contentType: 'application/json',
      cacheControl: '0',
      upsert: false,
    });
    if (rightsError) {
      await auth.admin.storage.from(BUCKET).remove([imagePath]);
      throw new Error('Rights record could not be stored, so the image was not retained.');
    }

    const { data: signed, error: signedError } = await auth.admin.storage.from(BUCKET).createSignedUrl(imagePath, 2 * 60 * 60);
    if (signedError || !signed?.signedUrl) throw new Error('A temporary Meshy reference URL could not be created.');

    return NextResponse.json({
      ok: true,
      url: signed.signedUrl,
      rightsBasis,
      rightsReference: `stored-rights:${rightsPath}`,
      rightsRecordPath: rightsPath,
      expiresInSeconds: 7200,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Reference upload failed.' }, { status: 500 });
  }
}