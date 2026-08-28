import crypto from 'node:crypto';

function normalizePart(value, label, maxLength) {
  const normalized = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

  if (!normalized) throw new Error(`${label} is required.`);
  if (normalized.length > maxLength) throw new Error(`${label} is too long.`);
  return normalized;
}

export function canonicalizeAuthoritativePropertyIdentity({ namespace, parcelId }) {
  const canonicalNamespace = normalizePart(namespace, 'Authoritative jurisdiction namespace', 96);
  const canonicalParcelId = normalizePart(parcelId, 'Authoritative parcel/APN', 128);
  return {
    namespace: canonicalNamespace,
    parcelId: canonicalParcelId,
    canonicalKey: `${canonicalNamespace}:${canonicalParcelId}`,
  };
}

export function authoritativePropertyFingerprint(input) {
  const identity = canonicalizeAuthoritativePropertyIdentity(input);
  return crypto.createHash('sha256').update(identity.canonicalKey).digest('hex');
}
