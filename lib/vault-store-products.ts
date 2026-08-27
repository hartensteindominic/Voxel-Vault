export type VaultStoreSku = 'voxel-commerce-kit' | 'fail-closed-audit-pack';

export type VaultStoreProduct = {
  sku: VaultStoreSku;
  name: string;
  priceCents: number;
  currency: 'usd';
  badge: string;
  description: string;
  features: string[];
};

export const VAULT_STORE_PRODUCTS: readonly VaultStoreProduct[] = [
  {
    sku: 'voxel-commerce-kit',
    name: 'VoxelVault 3D Commerce Kit',
    priceCents: 4900,
    currency: 'usd',
    badge: 'FLAGSHIP 3D SYSTEM',
    description:
      'A production-minded spatial commerce starter with an interactive Three.js vault, authenticated Stripe checkout patterns, private delivery, and tamper-evident accounting examples.',
    features: [
      'Interactive Three.js voxel vault source',
      'Orbit controls, lighting, and mobile-safe WebGL cleanup',
      'Authenticated Stripe Checkout integration example',
      'Idempotent webhook fulfillment pattern',
      'Private signed-download entitlement pattern',
    ],
  },
  {
    sku: 'fail-closed-audit-pack',
    name: 'Fail-Closed Audit Pack',
    priceCents: 2900,
    currency: 'usd',
    badge: 'CORE LEDGER SECURITY',
    description:
      'Drop-in TypeScript and SQL patterns for balanced journals, tamper-evident hash chaining, idempotency, and fail-closed verification.',
    features: [
      'SHA-256 tamper-evident audit-chain example',
      'PostgreSQL chain-integrity verification query',
      'Balanced-journal invariant test examples',
      'Idempotency and duplicate-event guard patterns',
      'Node and Next.js integration notes',
    ],
  },
] as const;

export function getVaultStoreProduct(value: string | null | undefined): VaultStoreProduct | null {
  if (!value) return null;
  return VAULT_STORE_PRODUCTS.find(product => product.sku === value) ?? null;
}

export function formatVaultStorePrice(priceCents: number) {
  return `$${(priceCents / 100).toFixed(0)}`;
}
