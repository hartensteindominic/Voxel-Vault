import { keccak256, randomBytes, toUtf8Bytes } from 'ethers';

export const VOXELFORGE_VOUCHER_PRIMARY_TYPE = 'ForgeVoucher';

export const VOXELFORGE_VOUCHER_TYPES = {
  ForgeVoucher: [
    { name: 'account', type: 'address' },
    { name: 'parentTokenId0', type: 'uint256' },
    { name: 'parentTokenId1', type: 'uint256' },
    { name: 'parentTokenId2', type: 'uint256' },
    { name: 'parentMetadataHash0', type: 'bytes32' },
    { name: 'parentMetadataHash1', type: 'bytes32' },
    { name: 'parentMetadataHash2', type: 'bytes32' },
    { name: 'recipeHash', type: 'bytes32' },
    { name: 'descendantUriHash', type: 'bytes32' },
    { name: 'feeWei', type: 'uint256' },
    { name: 'voucherId', type: 'bytes32' },
    { name: 'deadline', type: 'uint64' },
  ],
} as const;

export function hashParentTokenUri(tokenUri: string) {
  return keccak256(toUtf8Bytes(String(tokenUri || '')));
}

export function hashDescendantUri(descendantUri: string) {
  return keccak256(toUtf8Bytes(String(descendantUri || '')));
}

export function hashLockedRecipe(input: {
  collectionAddress: string;
  account: string;
  parentTokenIds: string[];
  descendant: any;
}) {
  const payload = {
    version: 'deterministic-preview-v1',
    collectionAddress: String(input.collectionAddress || '').toLowerCase(),
    account: String(input.account || '').toLowerCase(),
    parentTokenIds: input.parentTokenIds.map((value) => String(value)),
    descendant: {
      forgeId: String(input.descendant?.forgeId || ''),
      name: String(input.descendant?.name || ''),
      forgeClass: String(input.descendant?.forgeClass || ''),
      signature: String(input.descendant?.signature || ''),
      inheritedTraits: Array.isArray(input.descendant?.inheritedTraits)
        ? input.descendant.inheritedTraits.map((trait: any) => ({
            fromTokenId: String(trait?.fromTokenId || ''),
            traitType: String(trait?.traitType || ''),
            value: String(trait?.value || ''),
          }))
        : [],
      attributes: Array.isArray(input.descendant?.attributes)
        ? input.descendant.attributes.map((trait: any) => ({
            traitType: String(trait?.traitType || ''),
            value: String(trait?.value || ''),
          }))
        : [],
    },
  };

  return keccak256(toUtf8Bytes(JSON.stringify(payload)));
}

export function newVoucherId() {
  return `0x${Buffer.from(randomBytes(32)).toString('hex')}`;
}

export function buildVoucherDraft(input: {
  account: string;
  parentTokenIds: string[];
  parentTokenUris: string[];
  recipeHash: string;
  descendantUri?: string | null;
  feeWei?: string | null;
  deadline: number;
}) {
  if (input.parentTokenIds.length !== 3 || input.parentTokenUris.length !== 3) {
    throw new Error('ForgeVoucher requires exactly three parents.');
  }

  const descendantUriHash = input.descendantUri ? hashDescendantUri(input.descendantUri) : null;
  const feeWei = input.feeWei && /^\d+$/.test(input.feeWei) ? input.feeWei : null;

  return {
    account: input.account,
    parentTokenId0: input.parentTokenIds[0],
    parentTokenId1: input.parentTokenIds[1],
    parentTokenId2: input.parentTokenIds[2],
    parentMetadataHash0: hashParentTokenUri(input.parentTokenUris[0]),
    parentMetadataHash1: hashParentTokenUri(input.parentTokenUris[1]),
    parentMetadataHash2: hashParentTokenUri(input.parentTokenUris[2]),
    recipeHash: input.recipeHash,
    descendantUriHash,
    feeWei,
    voucherId: newVoucherId(),
    deadline: String(input.deadline),
  };
}
