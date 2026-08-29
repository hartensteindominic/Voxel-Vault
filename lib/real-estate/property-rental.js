export const RENTAL_STATUSES = Object.freeze([
  'pending-verification',
  'current',
  'late',
  'notice',
  'legal-process',
  'ended',
]);

const tenantUseStatuses = new Set(['current', 'late', 'notice', 'legal-process']);

export function isRentalStatus(value) {
  return RENTAL_STATUSES.includes(String(value || ''));
}

export function canTenantUseProperty({ status, leaseVerifiedAt, terminationVerifiedAt } = {}) {
  if (!leaseVerifiedAt) return false;
  if (terminationVerifiedAt) return false;
  return tenantUseStatuses.has(String(status || ''));
}

export function canEndLease({ terminationVerifiedAt, terminationReferenceHash } = {}) {
  return Boolean(terminationVerifiedAt && String(terminationReferenceHash || '').trim());
}

export function assertRentalTransition(fromStatus, toStatus, evidence = {}) {
  const from = String(fromStatus || 'pending-verification');
  const to = String(toStatus || '');
  if (!isRentalStatus(from) || !isRentalStatus(to)) throw new Error('Unknown rental status.');

  const allowed = {
    'pending-verification': new Set(['pending-verification', 'current']),
    current: new Set(['current', 'late', 'notice', 'legal-process', 'ended']),
    late: new Set(['late', 'current', 'notice', 'legal-process', 'ended']),
    notice: new Set(['notice', 'current', 'legal-process', 'ended']),
    'legal-process': new Set(['legal-process', 'current', 'ended']),
    ended: new Set(['ended']),
  };

  if (!allowed[from]?.has(to)) throw new Error(`Rental status cannot move from ${from} to ${to}.`);
  if (to !== 'pending-verification' && !evidence.leaseVerifiedAt) {
    throw new Error('A real lease must be verified before tenant rights become active.');
  }
  if (to === 'ended' && !canEndLease(evidence)) {
    throw new Error('Lease-end status requires verified lawful termination evidence.');
  }
  return true;
}

export function canAttachMintedVoxel({ status, leaseVerifiedAt, terminationVerifiedAt, tokenId, accountMintConfirmed } = {}) {
  return canTenantUseProperty({ status, leaseVerifiedAt, terminationVerifiedAt })
    && Boolean(accountMintConfirmed)
    && Boolean(String(tokenId ?? '').trim());
}

export function archiveTenantAttachments(attachments = [], archivedAt = new Date().toISOString()) {
  return (Array.isArray(attachments) ? attachments : []).map((attachment) => ({
    ...attachment,
    status: 'archived',
    archivedAt,
  }));
}

export function rentalStatusLabel(status) {
  const labels = {
    'pending-verification': 'LEASE PENDING',
    current: 'CURRENT',
    late: 'LATE',
    notice: 'NOTICE',
    'legal-process': 'LEGAL PROCESS',
    ended: 'LEASE ENDED',
  };
  return labels[String(status || '')] || 'UNKNOWN';
}

export function rentalTruth() {
  return {
    automaticEviction: false,
    latePaymentEndsTenancy: false,
    leaseRequired: true,
    lawfulTerminationRequired: true,
    attachmentRequiresConfirmedMint: true,
    tenantKeepsOwnedVoxelAfterLease: true,
  };
}
