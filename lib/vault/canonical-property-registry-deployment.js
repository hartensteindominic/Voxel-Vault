import crypto from 'node:crypto';

export const CANONICAL_REGISTRY_BYTECODE_PATH = '/property-registry/canonical-bytecode.txt';
export const CANONICAL_REGISTRY_CREATION_BYTECODE_LENGTH = 6028;
export const CANONICAL_REGISTRY_CREATION_BYTECODE_SHA256 = '0xdd013eb2b9102ed760c4d24144da6850534533ef53c4c35261a94abe4df528fd';
export const CANONICAL_REGISTRY_RUNTIME_BYTECODE_SHA256 = '0x4fc9f158da8a1b1ef0ef58d7f350dd700c569647f54e8d44ee8e435b65583ab8';
export const CANONICAL_REGISTRY_CONSTRUCTOR_ABI = [{
  inputs: [{ internalType: 'address', name: 'initialOwner', type: 'address' }],
  stateMutability: 'nonpayable',
  type: 'constructor',
}];

export function sha256HexBytes(hex) {
  const value = String(hex || '').trim();
  if (!/^0x[0-9a-fA-F]*$/.test(value) || value.length % 2 !== 0) throw new Error('Invalid hex bytecode.');
  return `0x${crypto.createHash('sha256').update(Buffer.from(value.slice(2), 'hex')).digest('hex')}`;
}
