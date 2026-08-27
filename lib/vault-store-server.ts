import { type VaultStoreSku } from './vault-store-products';

const STORAGE_PATHS: Record<VaultStoreSku, string> = {
  'voxel-commerce-kit': 'vault-store/voxelvault-3d-commerce-kit.zip',
  'fail-closed-audit-pack': 'vault-store/fail-closed-audit-pack.zip',
};

export function vaultStoreEnabled() {
  return process.env.VAULT_STORE_ENABLED === 'true';
}

export function getVaultStoreStoragePath(sku: VaultStoreSku) {
  return STORAGE_PATHS[sku];
}

export function getVaultStoreBucket() {
  return process.env.VAULT_STORE_BUCKET || 'assets-private';
}
