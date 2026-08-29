import { NextResponse } from 'next/server';
import { requireVoxelVaultUser } from '../../../../lib/user-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function missingRentalTables(error: any) {
  return error?.code === '42P01' || /vault_property_leases|vault_rental_payments|vault_tenant_voxel_attachments/i.test(String(error?.message || ''));
}

function paymentSort(a: any, b: any) {
  return String(a?.due_on || '').localeCompare(String(b?.due_on || ''));
}

export async function GET(request: Request) {
  const auth = await requireVoxelVaultUser(request);
  if (auth.ok === false) return NextResponse.json({ ok: false, error: auth.error, setupRequired: auth.setupRequired === true }, { status: auth.status });

  const { data: leases, error: leaseError } = await auth.admin
    .from('vault_property_leases')
    .select('id,property_identity_id,property_label,provider,monthly_rent_minor,currency,due_day,starts_on,ends_on,status,lease_verified_at,termination_verified_at,updated_at')
    .eq('tenant_user_id', auth.user.id)
    .order('updated_at', { ascending: false });

  if (leaseError) {
    if (missingRentalTables(leaseError)) {
      return NextResponse.json({
        ok: true,
        setupRequired: true,
        leases: [],
        note: 'Rental storage is not installed in this environment yet. Apply migration 020 before recording real leases.',
      }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
    }
    return NextResponse.json({ ok: false, error: 'Your private rental records could not be loaded.' }, { status: 500 });
  }

  const rows = Array.isArray(leases) ? leases : [];
  if (!rows.length) {
    return NextResponse.json({ ok: true, setupRequired: false, leases: [] }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  }

  const leaseIds = rows.map((lease: any) => lease.id);
  const [{ data: payments, error: paymentError }, { data: attachments, error: attachmentError }] = await Promise.all([
    auth.admin
      .from('vault_rental_payments')
      .select('id,lease_id,due_on,amount_due_minor,amount_paid_minor,currency,status,paid_at,updated_at')
      .in('lease_id', leaseIds)
      .order('due_on', { ascending: true }),
    auth.admin
      .from('vault_tenant_voxel_attachments')
      .select('id,lease_id,voxel_session_id,token_id,voxel_name,status,placed_transform,created_at,archived_at')
      .eq('tenant_user_id', auth.user.id)
      .in('lease_id', leaseIds)
      .order('created_at', { ascending: true }),
  ]);

  if (paymentError || attachmentError) {
    return NextResponse.json({ ok: false, error: 'Your rental details could not be loaded completely.' }, { status: 500 });
  }

  const paymentRows = Array.isArray(payments) ? payments : [];
  const attachmentRows = Array.isArray(attachments) ? attachments : [];
  const payload = rows.map((lease: any) => {
    const leasePayments = paymentRows.filter((payment: any) => payment.lease_id === lease.id).sort(paymentSort);
    const unpaid = leasePayments.find((payment: any) => !['paid'].includes(String(payment.status || '').toLowerCase())) || null;
    return {
      id: lease.id,
      propertyIdentityId: lease.property_identity_id,
      propertyLabel: lease.property_label,
      provider: lease.provider || '',
      monthlyRentMinor: Number(lease.monthly_rent_minor || 0),
      currency: lease.currency || 'USD',
      dueDay: Number(lease.due_day || 1),
      startsOn: lease.starts_on,
      endsOn: lease.ends_on,
      status: lease.status,
      leaseVerified: Boolean(lease.lease_verified_at),
      terminationVerified: Boolean(lease.termination_verified_at),
      nextPayment: unpaid,
      payments: leasePayments,
      attachments: attachmentRows.filter((attachment: any) => attachment.lease_id === lease.id),
    };
  });

  return NextResponse.json({ ok: true, setupRequired: false, leases: payload }, {
    headers: { 'Cache-Control': 'private, no-store, max-age=0' },
  });
}
