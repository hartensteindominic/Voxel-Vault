import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireVoxelVaultUser } from '../../../../../../../lib/user-auth';
import { canTenantUseProperty } from '../../../../../../../lib/real-estate/property-rental';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BUCKET = 'voxel-system';
const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

type Context = { params: Promise<{ leaseId: string }> };

function clean(value: unknown, max = 240) {
  return String(value || '').trim().slice(0, max);
}

function safeSegment(value: unknown, fallback = 'room') {
  const text = clean(value, 180).replace(/[^a-zA-Z0-9_.:-]+/g, '-').replace(/^-+|-+$/g, '');
  return text || fallback;
}

function missingRoomTable(error: any) {
  return error?.code === '42P01' || /vault_rental_room_references/i.test(String(error?.message || ''));
}

async function ensureBucket(admin: any) {
  const { data, error } = await admin.storage.listBuckets();
  if (error) throw new Error('Private room-photo storage is unavailable.');
  if (!data?.some((bucket: any) => bucket.name === BUCKET)) {
    const created = await admin.storage.createBucket(BUCKET, { public: false, fileSizeLimit: '75MB' });
    if (created.error && !/already exists/i.test(String(created.error.message || ''))) {
      throw new Error('Private room-photo storage could not be prepared.');
    }
  }
}

async function ownLease(admin: any, userId: string, leaseId: string) {
  const { data, error } = await admin
    .from('vault_property_leases')
    .select('id,tenant_user_id,status,lease_verified_at,termination_verified_at')
    .eq('id', leaseId)
    .eq('tenant_user_id', userId)
    .maybeSingle();
  if (error) throw new Error('Rental storage is unavailable.');
  return data || null;
}

async function readReference(admin: any, userId: string, leaseId: string) {
  const { data, error } = await admin
    .from('vault_rental_room_references')
    .select('lease_id,tenant_user_id,storage_path,content_type,file_digest,rights_confirmed_at,updated_at')
    .eq('lease_id', leaseId)
    .eq('tenant_user_id', userId)
    .maybeSingle();
  if (error) {
    if (missingRoomTable(error)) return { setupRequired: true, row: null };
    throw new Error('Your private room reference could not be loaded.');
  }
  return { setupRequired: false, row: data || null };
}

async function signedReference(admin: any, row: any) {
  if (!row?.storage_path) return null;
  const signed = await admin.storage.from(BUCKET).createSignedUrl(row.storage_path, 6 * 60 * 60);
  if (signed.error || !signed.data?.signedUrl) throw new Error('The private room photo could not be opened.');
  return {
    url: signed.data.signedUrl,
    storagePath: row.storage_path,
    uploadedAt: row.updated_at,
    rightsConfirmedAt: row.rights_confirmed_at,
    rightsBasis: 'tenant-supplied-room-reference',
    truth: 'Private decoration reference only. It is not a verified floor plan or canonical property geometry.',
  };
}

export async function GET(request: Request, context: Context) {
  const auth = await requireVoxelVaultUser(request);
  if (auth.ok === false) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  try {
    const { leaseId: rawLeaseId } = await context.params;
    const leaseId = clean(rawLeaseId, 80);
    const lease = await ownLease(auth.admin, auth.user.id, leaseId);
    if (!lease) return NextResponse.json({ ok: false, error: 'That rental is not in your Vault.' }, { status: 404 });

    const result = await readReference(auth.admin, auth.user.id, leaseId);
    if (result.setupRequired) {
      return NextResponse.json({ ok: true, setupRequired: true, reference: null }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
    }
    return NextResponse.json({ ok: true, setupRequired: false, reference: await signedReference(auth.admin, result.row) }, {
      headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Room photo could not be loaded.' }, { status: 400 });
  }
}

export async function POST(request: Request, context: Context) {
  const auth = await requireVoxelVaultUser(request);
  if (auth.ok === false) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  try {
    const { leaseId: rawLeaseId } = await context.params;
    const leaseId = clean(rawLeaseId, 80);
    const lease = await ownLease(auth.admin, auth.user.id, leaseId);
    if (!lease) return NextResponse.json({ ok: false, error: 'That rental is not in your Vault.' }, { status: 404 });
    if (!canTenantUseProperty({ status: lease.status, leaseVerifiedAt: lease.lease_verified_at, terminationVerifiedAt: lease.termination_verified_at })) {
      return NextResponse.json({ ok: false, error: 'Room decoration is read-only until a verified active lease exists.' }, { status: 409 });
    }

    const form = await request.formData();
    const photo = form.get('photo');
    const rightsConfirmed = clean(form.get('rightsConfirmed'), 16) === 'true';
    if (!(photo instanceof File)) return NextResponse.json({ ok: false, error: 'Choose a room photo first.' }, { status: 400 });
    if (!rightsConfirmed) return NextResponse.json({ ok: false, error: 'Confirm that you took this room photo or have permission to use it.' }, { status: 400 });

    const extension = ALLOWED_TYPES.get(String(photo.type || '').toLowerCase());
    if (!extension) return NextResponse.json({ ok: false, error: 'Use a JPG, PNG, or WebP room photo.' }, { status: 415 });
    if (photo.size <= 0 || photo.size > MAX_BYTES) return NextResponse.json({ ok: false, error: 'Room photos must be smaller than 8 MB.' }, { status: 413 });

    const existing = await readReference(auth.admin, auth.user.id, leaseId);
    if (existing.setupRequired) {
      return NextResponse.json({ ok: false, setupRequired: true, error: 'Room-photo storage needs migration 021 before uploads can be saved.' }, { status: 503 });
    }

    const bytes = await photo.arrayBuffer();
    const digest = createHash('sha256').update(Buffer.from(bytes)).digest('hex');
    const path = `rental-room-references/${safeSegment(auth.user.id, 'user')}/${safeSegment(leaseId, 'lease')}/${digest}.${extension}`;
    await ensureBucket(auth.admin);

    const uploaded = await auth.admin.storage.from(BUCKET).upload(path, bytes, {
      contentType: photo.type,
      cacheControl: '0',
      upsert: true,
    });
    if (uploaded.error) throw new Error('The room photo could not be stored privately.');

    const now = new Date().toISOString();
    const { data, error } = await auth.admin
      .from('vault_rental_room_references')
      .upsert({
        lease_id: leaseId,
        tenant_user_id: auth.user.id,
        storage_path: path,
        content_type: photo.type,
        file_digest: digest,
        rights_confirmed_at: now,
        updated_at: now,
      }, { onConflict: 'lease_id' })
      .select('lease_id,tenant_user_id,storage_path,content_type,file_digest,rights_confirmed_at,updated_at')
      .single();
    if (error) throw new Error('The room photo could not be linked to this rental.');

    if (existing.row?.storage_path && existing.row.storage_path !== path) {
      await auth.admin.storage.from(BUCKET).remove([existing.row.storage_path]).catch(() => {});
    }

    return NextResponse.json({ ok: true, setupRequired: false, reference: await signedReference(auth.admin, data) }, {
      headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Room photo upload failed.' }, { status: 400 });
  }
}

export async function DELETE(request: Request, context: Context) {
  const auth = await requireVoxelVaultUser(request);
  if (auth.ok === false) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  try {
    const { leaseId: rawLeaseId } = await context.params;
    const leaseId = clean(rawLeaseId, 80);
    const lease = await ownLease(auth.admin, auth.user.id, leaseId);
    if (!lease) return NextResponse.json({ ok: false, error: 'That rental is not in your Vault.' }, { status: 404 });

    const existing = await readReference(auth.admin, auth.user.id, leaseId);
    if (existing.setupRequired) return NextResponse.json({ ok: true, setupRequired: true, removed: false });
    if (existing.row?.storage_path) await auth.admin.storage.from(BUCKET).remove([existing.row.storage_path]).catch(() => {});

    const { error } = await auth.admin
      .from('vault_rental_room_references')
      .delete()
      .eq('lease_id', leaseId)
      .eq('tenant_user_id', auth.user.id);
    if (error) throw new Error('The room photo could not be removed.');

    return NextResponse.json({ ok: true, removed: true }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Room photo removal failed.' }, { status: 400 });
  }
}
