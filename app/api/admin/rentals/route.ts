import { NextResponse } from 'next/server';
import { requireVoxelVaultAdmin } from '../../../../lib/admin-auth';
import { assertRentalTransition } from '../../../../lib/real-estate/property-rental';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function clean(value: unknown, max = 180) {
  return String(value || '').trim().slice(0, max);
}
function integer(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : fallback;
}
function uuid(value: unknown) {
  const text = clean(value, 80);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text) ? text : '';
}
function sha256(value: unknown) {
  const text = clean(value, 128).toLowerCase();
  return /^[0-9a-f]{64}$/.test(text) ? text : '';
}
function dateOnly(value: unknown) {
  const text = clean(value, 16);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

async function getLease(admin: any, leaseId: string) {
  const { data, error } = await admin
    .from('vault_property_leases')
    .select('id,status,lease_verified_at,termination_verified_at,termination_reference_hash,tenant_user_id')
    .eq('id', leaseId)
    .maybeSingle();
  if (error) throw new Error('Rental storage is unavailable.');
  return data || null;
}

export async function POST(request: Request) {
  const auth = await requireVoxelVaultAdmin(request);
  if (auth.ok === false) return NextResponse.json({ ok: false, error: auth.error, setupRequired: auth.setupRequired === true }, { status: auth.status });

  try {
    const body = await request.json().catch(() => ({}));
    const action = clean(body?.action, 40);

    if (action === 'verify-lease') {
      const propertyFingerprint = sha256(body?.propertyFingerprint);
      const tenantUserId = uuid(body?.tenantUserId);
      const agreementHash = sha256(body?.agreementHash);
      const propertyLabel = clean(body?.propertyLabel, 160);
      const provider = clean(body?.provider, 80);
      const providerLeaseId = clean(body?.providerLeaseId, 160);
      const monthlyRentMinor = integer(body?.monthlyRentMinor, -1);
      const dueDay = integer(body?.dueDay, 0);
      const startsOn = dateOnly(body?.startsOn) || null;
      const endsOn = dateOnly(body?.endsOn) || null;
      const currency = clean(body?.currency || 'USD', 8).toUpperCase();

      if (!propertyFingerprint || !tenantUserId || !agreementHash || !propertyLabel || monthlyRentMinor < 0 || dueDay < 1 || dueDay > 28) {
        return NextResponse.json({ ok: false, error: 'Verified property identity, tenant, lease hash and valid rent terms are required.' }, { status: 400 });
      }

      const { data: identity, error: identityError } = await auth.admin
        .from('vault_property_identities')
        .select('id,canonical_state,registry_verified')
        .eq('property_fingerprint', propertyFingerprint)
        .maybeSingle();
      if (identityError) throw new Error('Canonical property identity storage is unavailable.');
      if (!identity || !['verified', 'passport-minted'].includes(String(identity.canonical_state || ''))) {
        return NextResponse.json({ ok: false, error: 'A real lease cannot activate until the exact parcel identity is verified.' }, { status: 409 });
      }

      const verifiedAt = new Date().toISOString();
      assertRentalTransition('pending-verification', 'current', { leaseVerifiedAt: verifiedAt });
      const { data, error } = await auth.admin
        .from('vault_property_leases')
        .insert({
          property_identity_id: identity.id,
          tenant_user_id: tenantUserId,
          property_label: propertyLabel,
          provider,
          provider_lease_id: providerLeaseId,
          monthly_rent_minor: monthlyRentMinor,
          currency,
          due_day: dueDay,
          starts_on: startsOn,
          ends_on: endsOn,
          status: 'current',
          agreement_hash: agreementHash,
          lease_verified_at: verifiedAt,
          updated_at: verifiedAt,
        })
        .select('id,property_identity_id,tenant_user_id,property_label,status,lease_verified_at')
        .single();
      if (error) throw new Error(`Verified lease could not be recorded: ${error.message}`);
      return NextResponse.json({ ok: true, lease: data, livePaymentCollectionEnabled: false });
    }

    if (action === 'record-payment') {
      const leaseId = uuid(body?.leaseId);
      const dueOn = dateOnly(body?.dueOn);
      const amountDueMinor = integer(body?.amountDueMinor, -1);
      const amountPaidMinor = integer(body?.amountPaidMinor, -1);
      const paymentStatus = clean(body?.status, 20);
      const provider = clean(body?.provider, 80);
      const providerPaymentId = clean(body?.providerPaymentId, 160);
      const paidAt = body?.paidAt ? clean(body.paidAt, 40) : null;
      if (!leaseId || !dueOn || amountDueMinor < 0 || amountPaidMinor < 0 || !['upcoming','due','paid','late','disputed'].includes(paymentStatus)) {
        return NextResponse.json({ ok: false, error: 'Valid reconciled payment data is required.' }, { status: 400 });
      }
      const lease = await getLease(auth.admin, leaseId);
      if (!lease) return NextResponse.json({ ok: false, error: 'Lease not found.' }, { status: 404 });
      if (lease.status === 'ended') return NextResponse.json({ ok: false, error: 'Ended leases are read-only.' }, { status: 409 });

      const now = new Date().toISOString();
      const { data: payment, error } = await auth.admin
        .from('vault_rental_payments')
        .upsert({
          lease_id: leaseId,
          due_on: dueOn,
          amount_due_minor: amountDueMinor,
          amount_paid_minor: amountPaidMinor,
          currency: clean(body?.currency || 'USD', 8).toUpperCase(),
          status: paymentStatus,
          provider,
          provider_payment_id: providerPaymentId,
          paid_at: paymentStatus === 'paid' ? (paidAt || now) : null,
          updated_at: now,
        }, { onConflict: 'lease_id,due_on' })
        .select('id,lease_id,due_on,amount_due_minor,amount_paid_minor,currency,status,paid_at')
        .single();
      if (error) throw new Error('Payment reconciliation could not be saved.');

      let nextLeaseStatus = lease.status;
      if (paymentStatus === 'late' && lease.status === 'current') nextLeaseStatus = 'late';
      if (paymentStatus === 'paid' && lease.status === 'late') nextLeaseStatus = 'current';
      if (nextLeaseStatus !== lease.status) {
        assertRentalTransition(lease.status, nextLeaseStatus, { leaseVerifiedAt: lease.lease_verified_at });
        await auth.admin.from('vault_property_leases').update({ status: nextLeaseStatus, updated_at: now }).eq('id', leaseId);
      }
      return NextResponse.json({ ok: true, payment, leaseStatus: nextLeaseStatus, automaticEviction: false });
    }

    if (action === 'set-status') {
      const leaseId = uuid(body?.leaseId);
      const toStatus = clean(body?.status, 32);
      if (!leaseId) return NextResponse.json({ ok: false, error: 'Lease ID is required.' }, { status: 400 });
      const lease = await getLease(auth.admin, leaseId);
      if (!lease) return NextResponse.json({ ok: false, error: 'Lease not found.' }, { status: 404 });

      const terminationVerifiedAt = toStatus === 'ended' ? clean(body?.terminationVerifiedAt, 40) : lease.termination_verified_at;
      const terminationReferenceHash = toStatus === 'ended' ? sha256(body?.terminationReferenceHash) : lease.termination_reference_hash;
      assertRentalTransition(lease.status, toStatus, {
        leaseVerifiedAt: lease.lease_verified_at,
        terminationVerifiedAt,
        terminationReferenceHash,
      });

      const now = new Date().toISOString();
      const { data, error } = await auth.admin
        .from('vault_property_leases')
        .update({
          status: toStatus,
          termination_verified_at: toStatus === 'ended' ? terminationVerifiedAt : lease.termination_verified_at,
          termination_reference_hash: toStatus === 'ended' ? terminationReferenceHash : lease.termination_reference_hash,
          updated_at: now,
        })
        .eq('id', leaseId)
        .select('id,status,lease_verified_at,termination_verified_at')
        .single();
      if (error) throw new Error('Rental status could not be updated.');

      if (toStatus === 'ended') {
        await auth.admin
          .from('vault_tenant_voxel_attachments')
          .update({ status: 'archived', archived_at: now })
          .eq('lease_id', leaseId)
          .eq('tenant_user_id', lease.tenant_user_id)
          .eq('status', 'active');
      }

      return NextResponse.json({
        ok: true,
        lease: data,
        tenantLayerArchived: toStatus === 'ended',
        ownedVoxelAssetsTransferredOrBurned: false,
        automaticEviction: false,
      });
    }

    return NextResponse.json({ ok: false, error: 'Unknown rental reconciliation action.' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Rental reconciliation failed.' }, { status: 400 });
  }
}
