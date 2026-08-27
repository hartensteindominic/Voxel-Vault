import { getSupabaseAdmin } from './supabase-admin';
import { type VaultStoreSku } from './vault-store-products';

const STORAGE_PATHS: Record<VaultStoreSku, string> = {
  'voxel-commerce-kit': 'vault-store/voxelvault-3d-commerce-kit.zip',
  'fail-closed-audit-pack': 'vault-store/fail-closed-audit-pack.zip',
};

export type VaultStorePreflight = {
  available: boolean;
  reason: 'READY' | 'STORE_DISABLED' | 'INVALID_STORAGE_PATH' | 'STORAGE_UNAVAILABLE' | 'ASSET_MISSING';
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

export async function preflightVaultStoreProduct(sku: VaultStoreSku): Promise<VaultStorePreflight> {
  if (!vaultStoreEnabled()) return { available: false, reason: 'STORE_DISABLED' };

  const storagePath = getVaultStoreStoragePath(sku);
  const lastSlash = storagePath.lastIndexOf('/');
  const folder = lastSlash >= 0 ? storagePath.slice(0, lastSlash) : '';
  const fileName = lastSlash >= 0 ? storagePath.slice(lastSlash + 1) : storagePath;
  if (!fileName || fileName.includes('..')) return { available: false, reason: 'INVALID_STORAGE_PATH' };

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin.storage
      .from(getVaultStoreBucket())
      .list(folder, { limit: 20, search: fileName });

    if (error) {
      console.error('vault store storage preflight failed', { sku, reason: error.message });
      return { available: false, reason: 'STORAGE_UNAVAILABLE' };
    }

    const exact = (data || []).find(item => item.name === fileName);
    if (!exact) return { available: false, reason: 'ASSET_MISSING' };
    return { available: true, reason: 'READY' };
  } catch (error) {
    console.error('vault store storage preflight failed', { sku, error });
    return { available: false, reason: 'STORAGE_UNAVAILABLE' };
  }
}
