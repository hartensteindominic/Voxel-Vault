export const VOXELFORGE_CHAIN_ID = 8453;
export const VOXELFORGE_INTENT_VERSION = '1';
export const VOXELFORGE_INTENT_PRIMARY_TYPE = 'ForgeIntent';

/**
 * This is the protocol-level authorization schema for future delegated Forge execution.
 * It does not enable delegation, create a session key, request a signature, or authorize
 * any transaction by itself.
 */
export const VOXELFORGE_INTENT_TYPES = {
  ForgeIntent: [
    { name: 'account', type: 'address' },
    { name: 'collection', type: 'address' },
    { name: 'parentTokenId0', type: 'uint256' },
    { name: 'parentTokenId1', type: 'uint256' },
    { name: 'parentTokenId2', type: 'uint256' },
    { name: 'parentMetadataHash0', type: 'bytes32' },
    { name: 'parentMetadataHash1', type: 'bytes32' },
    { name: 'parentMetadataHash2', type: 'bytes32' },
    { name: 'recipeHash', type: 'bytes32' },
    { name: 'forgeRouter', type: 'address' },
    { name: 'forgeSelector', type: 'bytes4' },
    { name: 'feeToken', type: 'address' },
    { name: 'maxForgeFee', type: 'uint256' },
    { name: 'maxCallValue', type: 'uint256' },
    { name: 'maxGasCost', type: 'uint256' },
    { name: 'policyHash', type: 'bytes32' },
    { name: 'deadline', type: 'uint64' },
    { name: 'nonce', type: 'uint256' },
    { name: 'intentId', type: 'bytes32' },
  ],
} as const;

export const VOXELFORGE_EIP712_DOMAIN = {
  name: 'VoxelForge',
  version: VOXELFORGE_INTENT_VERSION,
  chainId: VOXELFORGE_CHAIN_ID,
  verifyingContract: null,
} as const;

export const VOXELFORGE_SESSION_POLICY_TEMPLATE = {
  chainId: VOXELFORGE_CHAIN_ID,
  allowedTargets: [] as string[],
  allowedFunctionSelectors: [] as string[],
  maxForgeFeeAtomic: null as string | null,
  maxNativeValuePerForgeAtomic: null as string | null,
  maxGasCostAtomic: null as string | null,
  maxForgesPerDay: null as number | null,
  maxForgesTotal: null as number | null,
  expiresAt: null as string | null,
  minimumNativeBalanceReserveAtomic: null as string | null,
  allowArbitraryCalls: false,
  allowTransfers: false,
  allowListings: false,
  allowTokenApprovalsOutsideForge: false,
  emergencyRevocationRequired: true,
} as const;

export function voxelforgeAuthorizationSchema() {
  return {
    schemaVersion: 'voxelforge-authorization-v1',
    executionEnabled: false,
    delegationEnabled: false,
    chain: 'base',
    chainId: VOXELFORGE_CHAIN_ID,
    standards: {
      intentSignature: 'EIP-712',
      eoaDelegation: 'EIP-7702-planned',
      accountAbstraction: 'ERC-4337-compatible-planned',
    },
    eip7702: {
      transactionType: '0x04',
      delegationPersistence: 'persistent-until-explicitly-cleared',
      sessionKeysProvidedByEip7702Itself: false,
      delegateContractMustEnforceSessionPolicy: true,
      delegationWriteRollsBackWhenExecutionReverts: false,
      privateKeyExportRequired: false,
      notice: 'EIP-7702 delegates account code persistently. Scoped session permissions must be enforced by reviewed delegate-contract logic and remain independently revocable.',
    },
    eip712: {
      domain: VOXELFORGE_EIP712_DOMAIN,
      primaryType: VOXELFORGE_INTENT_PRIMARY_TYPE,
      types: VOXELFORGE_INTENT_TYPES,
    },
    sessionPolicyTemplate: VOXELFORGE_SESSION_POLICY_TEMPLATE,
    requiredExecutionChecks: [
      'delegation-or-smart-account-policy-is-active',
      'session-key-is-not-revoked-or-expired',
      'chain-id-is-base-8453',
      'forge-router-is-allowlisted',
      'forge-selector-is-allowlisted',
      'exactly-three-distinct-parent-token-ids-match-intent',
      'parent-ownership-is-reverified-immediately-before-execution',
      'parent-metadata-hashes-match-intent',
      'recipe-hash-matches-locked-preview',
      'forge-fee-is-at-or-below-signed-maximum',
      'call-value-is-at-or-below-signed-maximum',
      'gas-cost-is-at-or-below-signed-maximum',
      'wallet-reserve-remains-at-or-above-policy-minimum',
      'deadline-has-not-expired',
      'nonce-and-intent-id-have-not-been-used',
      'atomic-consume-and-mint-path-is-enabled',
    ],
  } as const;
}
