import type { Metadata } from 'next';
import VaultStoreClient from './VaultStoreClient';

export const metadata: Metadata = {
  title: 'VoxelVault Digital Foundry',
  description: 'Interactive 3D commerce components and fail-closed ledger security kits from VoxelVault.',
};

export default function VaultStorePage() {
  const checkoutEnabled = process.env.VAULT_STORE_ENABLED === 'true';
  return <VaultStoreClient checkoutEnabled={checkoutEnabled} />;
}
