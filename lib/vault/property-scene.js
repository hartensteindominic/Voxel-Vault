export const PROPERTY_SCENE_POLICY = Object.freeze({
  digitalOnly: true,
  changesDeed: false,
  changesPropertyAppraisal: false,
  createsRentRights: false,
  transfersAttachedNft: false,
  verifiedPropertyControllerRequired: true,
  currentVoxelOwnershipRequiredForAttachOrMove: true,
  userEnteredSceneValueAllowed: false,
  signatureMaxAgeMs: 5 * 60 * 1000,
});

function fixed(value, digits = 3) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error('Scene transform must use finite numbers.');
  return number.toFixed(digits);
}

export function normalizeSceneTransform(input = {}) {
  const transform = {
    x: Number(input.x ?? 0),
    y: Number(input.y ?? 0),
    z: Number(input.z ?? 0),
    rotationY: Number(input.rotationY ?? 0),
    scale: Number(input.scale ?? 1),
  };
  if (![transform.x, transform.y, transform.z, transform.rotationY, transform.scale].every(Number.isFinite)) {
    throw new Error('Scene transform must use finite numbers.');
  }
  if (transform.x < -50 || transform.x > 50 || transform.z < -50 || transform.z > 50) {
    throw new Error('Scene X/Z position is outside the property scene bounds.');
  }
  if (transform.y < -10 || transform.y > 50) throw new Error('Scene Y position is outside the property scene bounds.');
  if (transform.rotationY < -6.2832 || transform.rotationY > 6.2832) throw new Error('Scene rotation is outside the supported range.');
  if (transform.scale < 0.05 || transform.scale > 10) throw new Error('Scene scale must be between 0.05 and 10.');
  return transform;
}

export function buildPropertySceneWalletMessage({
  action,
  propertyIdentityId,
  chainId,
  contractAddress,
  tokenId,
  transform,
  timestamp,
}) {
  const verb = String(action || '').trim().toUpperCase();
  if (!['ATTACH', 'MOVE'].includes(verb)) throw new Error('Unsupported property scene wallet action.');
  const placement = normalizeSceneTransform(transform);
  return [
    'Voxel Vault Property Scene',
    `Action: ${verb}`,
    `Property: ${String(propertyIdentityId || '').trim()}`,
    `NFT: ${String(chainId)}:${String(contractAddress || '').toLowerCase()}:${String(tokenId || '').trim()}`,
    `Transform: ${fixed(placement.x)}|${fixed(placement.y)}|${fixed(placement.z)}|${fixed(placement.rotationY, 4)}|${fixed(placement.scale)}`,
    `Timestamp: ${Number(timestamp)}`,
    'Digital scene only. This does not change the deed, property appraisal, rent rights, or NFT ownership.',
  ].join('\n');
}
