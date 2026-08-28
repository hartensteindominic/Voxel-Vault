import { getAddress, isAddress, keccak256, toUtf8Bytes } from 'ethers';

export const BASE_SEPOLIA_CHAIN_ID = 84532;
export const BASE_SEPOLIA_CHAIN_HEX = '0x14a34';
export const BASE_SEPOLIA_RPC = 'https://sepolia.base.org';
export const BASE_SEPOLIA_EXPLORER = 'https://sepolia.basescan.org';

export const CANONICAL_PROPERTY_REGISTRY_ABI = [
  'function owner() view returns (address)',
  'function registerIdentity(bytes32 propertyId, bytes32 claimHash, bytes32 sourceHash, string metadataURI)',
  'function setVerified(bytes32 propertyId, bool verified)',
  'function getIdentity(bytes32 propertyId) view returns (tuple(bytes32 claimHash,bytes32 sourceHash,string metadataURI,bool verified,uint64 registeredAt,uint64 verifiedAt))',
  'event PropertyIdentityRegistered(bytes32 indexed propertyId, bytes32 indexed claimHash, bytes32 indexed sourceHash, string metadataURI)',
  'event PropertyIdentityVerificationUpdated(bytes32 indexed propertyId, bool verified)',
  'error PropertyNotRegistered(bytes32 propertyId)',
];

function exact64Hex(value, label) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(normalized)) throw new Error(`${label} is missing or invalid.`);
  return normalized;
}

export function registryAddressFromEnvironment() {
  const raw = String(
    process.env.CANONICAL_PROPERTY_REGISTRY_ADDRESS
      || process.env.NEXT_PUBLIC_CANONICAL_PROPERTY_REGISTRY_ADDRESS
      || ''
  ).trim();
  if (!raw || !isAddress(raw)) return '';
  return getAddress(raw);
}

export function buildCanonicalPropertyAnchor({ claimId, identity, appUrl }) {
  const fingerprint = exact64Hex(identity?.verified_property_fingerprint, 'Authoritative property fingerprint');
  const source = String(identity?.verified_property_source || '').trim();
  if (source.length < 5) throw new Error('Authoritative property source is missing.');
  if (!identity?.verified_property_source_checked_at) throw new Error('Authoritative property source review timestamp is missing.');

  const propertyId = `0x${fingerprint}`;
  const claimHash = keccak256(toUtf8Bytes(`voxel-vault:property-claim:${String(claimId)}`));
  const sourceHash = keccak256(toUtf8Bytes(`voxel-vault:property-source:${source}`));
  const base = String(appUrl || 'https://www.voxelvault.io').replace(/\/$/, '');
  const metadataURI = `${base}/vault/properties?property=${encodeURIComponent(String(identity.id || ''))}`;

  return { propertyId, claimHash, sourceHash, metadataURI };
}

export function isPropertyNotRegisteredError(error) {
  const name = String(error?.revert?.name || error?.errorName || '');
  const message = String(error?.shortMessage || error?.reason || error?.message || '');
  return name === 'PropertyNotRegistered' || /PropertyNotRegistered|Property not registered/i.test(message);
}

export function shortHash(value, length = 12) {
  const text = String(value || '');
  return text ? text.slice(-length) : '';
}
