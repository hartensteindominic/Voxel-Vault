import { NextResponse } from 'next/server';
import { requireVoxelVaultUser } from '../../../../../../lib/user-auth';
import { loadAccountVoxel } from '../../../../../../lib/voxelpop-account';
import { canAttachMintedVoxel, canTenantUseProperty } from '../../../../../../lib/real-estate/property-rental';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ leaseId: string }> };

function clean(value: unknown, max = 180) {
  return String(value || '').trim().slice(0, max);
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

export async function POST(request: Request, context: Context) {
  const auth = await requireVoxelVaultUser(request);
  if (auth.ok === false) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  try {
    const { leaseId: rawLeaseId } = await context.params;
    const leaseId = clean(rawLeaseId, 80);
    const body = await request.json().catch(() => ({}));
    const sessionId = clean(body?.sessionId, 180);
    if (!leaseId || !sessionId) return NextResponse.json({ ok: false, error: 'Choose a minted voxel first.' }, { status: 400 });

    const lease = await ownLease(auth.admin, auth.user.id, leaseId);
    if (!lease) return NextResponse.json({ ok: false, error: 'That rental is not in your Vault.' }, { status: 404 });

    const record = await loadAccountVoxel(auth.admin as any, auth.user, sessionId);
    const tokenId = clean(record?.payload?.mint?.tokenId, 96);
    const accountMintConfirmed = Boolean(record && tokenId);
    const allowed = canAttachMintedVoxel({
      status: lease.status,
      leaseVerifiedAt: lease.lease_verified_at,
      terminationVerifiedAt: lease.termination_verified_at,
      tokenId,
      accountMintConfirmed,
    });
    if (!allowed) {
      return NextResponse.json({
        ok: false,
        error: accountMintConfirmed
          ? 'This tenant layer is read-only until a verified active lease exists.'
          : 'Only a voxel with a confirmed mint in your signed-in Creator Gallery can be attached permanently.',
      }, { status: 409 });
    }

    const voxelName = clean(record?.payload?.asset?.name || 'Minted voxel', 120);
    const { data, error } = await auth.admin
      .from('vault_tenant_voxel_attachments')
      .upsert({
        lease_id: leaseId,
        tenant_user_id: auth.user.id,
        voxel_session_id: sessionId,
        token_id: tokenId,
        voxel_name: voxelName,
        status: 'active',
        archived_at: null,
      }, { onConflict: 'lease_id,voxel_session_id' })
      .select('id,lease_id,voxel_session_id,token_id,voxel_name,status,placed_transform,created_at,archived_at')
      .single();
    if (error) throw new Error('The minted voxel could not be attached to this rental.');

    return NextResponse.json({
      ok: true,
      attachment: data,
      truth: 'The voxel stays your separate digital asset. Attaching it does not change the real property, lease, deed or ownership rights.',
    }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Tenant voxel attachment failed.' }, { status: 400 });
  }
}

export async function DELETE(request: Request, context: Context) {
  const auth = await requireVoxelVaultUser(request);
  if (auth.ok === false) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  try {
    const { leaseId: rawLeaseId } = await context.params;
    const leaseId = clean(rawLeaseId, 80);
    const body = await request.json().catch(() => ({}));
    const attachmentId = clean(body?.attachmentId, 80);
    if (!leaseId || !attachmentId) return NextResponse.json({ ok: false, error: 'Attachment ID is required.' }, { status: 400 });

    const lease = await ownLease(auth.admin, auth.user.id, leaseId);
    if (!lease) return NextResponse.json({ ok: false, error: 'That rental is not in your Vault.' }, { status: 404 });
    if (!canTenantUseProperty({ status: lease.status, leaseVerifiedAt: lease.lease_verified_at, terminationVerifiedAt: lease.termination_verified_at })) {
      return NextResponse.json({ ok: false, error: 'An ended or unverified tenant layer is read-only.' }, { status: 409 });
    }

    const { error } = await auth.admin
      .from('vault_tenant_voxel_attachments')
      .delete()
      .eq('id', attachmentId)
      .eq('lease_id', leaseId)
      .eq('tenant_user_id', auth.user.id);
    if (error) throw new Error('The voxel could not be removed from this tenant layer.');

    return NextResponse.json({ ok: true, assetStillOwned: true }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Tenant voxel removal failed.' }, { status: 400 });
  }
}
