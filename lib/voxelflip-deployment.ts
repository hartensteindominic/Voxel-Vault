import { getSupabaseAdmin } from './supabase-admin';

const BUCKET = 'voxelflip-config';
const FILE = 'deployment.json';
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const TX_RE = /^0x[a-fA-F0-9]{64}$/;
const APPROVED_OWNER = '0x02f93c7547309ca50EEAB446DaEBE8ce8E694cBb';

/**
 * Production VoxelFlip is deliberately pinned here.
 *
 * A mutable Supabase object or a stale Vercel environment variable must never
 * be able to switch the contract used for mint verification, market actions,
 * or Neural Core. A future production contract change therefore requires a
 * reviewed code deployment that updates this record.
 */
const VERIFIED_PRODUCTION_FALLBACK: VoxelFlipDeployment = {
  address: '0xa00758b05f96ef4409d97c3ffebb6794b2eafbde',
  chainId: 8453,
  network: 'base',
  owner: APPROVED_OWNER,
  mintSigner: APPROVED_OWNER,
  royaltyReceiver: APPROVED_OWNER,
  royaltyBps: 500,
  deploymentTxHash: '0xc2f198a3730169bc5c61f0a1251301f16d40441c022b6cc30e9cf06bb8ea31bb',
  deployedAt: '',
  registeredAt: '2026-08-25T15:40:00.000Z',
};

export type VoxelFlipDeployment = {
  address: string;
  chainId: number;
  network: string;
  owner: string;
  mintSigner: string;
  royaltyReceiver: string;
  royaltyBps: number;
  deploymentTxHash: string;
  deployedAt: string;
  registeredAt: string;
};

let memoryCache: { value: VoxelFlipDeployment; expiresAt: number } | null = null;
let warnedAboutStoredConflict = false;
let warnedAboutEnvConflict = false;

function normalizeAddress(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function normalizeTx(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function validDeployment(value: any): value is VoxelFlipDeployment {
  return Boolean(
    value
    && ADDRESS_RE.test(String(value.address || ''))
    && Number(value.chainId) === 8453
    && ADDRESS_RE.test(String(value.owner || ''))
    && ADDRESS_RE.test(String(value.mintSigner || ''))
    && ADDRESS_RE.test(String(value.royaltyReceiver || ''))
    && Number.isInteger(Number(value.royaltyBps))
    && Number(value.royaltyBps) >= 0
    && Number(value.royaltyBps) <= 1000
    && TX_RE.test(String(value.deploymentTxHash || ''))
  );
}

function normalizeDeployment(value: VoxelFlipDeployment): VoxelFlipDeployment {
  return {
    ...value,
    address: String(value.address).trim(),
    chainId: 8453,
    network: 'base',
    owner: String(value.owner).trim(),
    mintSigner: String(value.mintSigner).trim(),
    royaltyReceiver: String(value.royaltyReceiver).trim(),
    royaltyBps: Number(value.royaltyBps),
    deploymentTxHash: String(value.deploymentTxHash).trim(),
    deployedAt: String(value.deployedAt || ''),
    registeredAt: String(value.registeredAt || ''),
  };
}

function matchesVerifiedProduction(value: VoxelFlipDeployment) {
  const trusted = VERIFIED_PRODUCTION_FALLBACK;
  return (
    normalizeAddress(value.address) === normalizeAddress(trusted.address)
    && Number(value.chainId) === trusted.chainId
    && String(value.network || '').trim().toLowerCase() === trusted.network
    && normalizeAddress(value.owner) === normalizeAddress(trusted.owner)
    && normalizeAddress(value.mintSigner) === normalizeAddress(trusted.mintSigner)
    && normalizeAddress(value.royaltyReceiver) === normalizeAddress(trusted.royaltyReceiver)
    && Number(value.royaltyBps) === trusted.royaltyBps
    && normalizeTx(value.deploymentTxHash) === normalizeTx(trusted.deploymentTxHash)
  );
}

function warnAboutConflictingEnvironment() {
  if (warnedAboutEnvConflict) return;
  const configured = [
    process.env.NEXT_PUBLIC_VOXELFLIP_NFT_ADDRESS,
    process.env.VOXELFLIP_NFT_ADDRESS,
  ].map(value => String(value || '').trim()).filter(Boolean);

  const conflict = configured.find(value => ADDRESS_RE.test(value) && normalizeAddress(value) !== normalizeAddress(VERIFIED_PRODUCTION_FALLBACK.address));
  if (!conflict) return;

  warnedAboutEnvConflict = true;
  console.warn('Ignoring stale VoxelFlip contract environment override; production is pinned to the reviewed deployment.', {
    configuredAddress: conflict,
    productionAddress: VERIFIED_PRODUCTION_FALLBACK.address,
  });
}

export async function getVoxelFlipDeployment(options: { bypassCache?: boolean } = {}): Promise<VoxelFlipDeployment> {
  if (!options.bypassCache && memoryCache && memoryCache.expiresAt > Date.now()) return memoryCache.value;

  warnAboutConflictingEnvironment();

  try {
    const supabase = getSupabaseAdmin();
    const downloaded = await supabase.storage.from(BUCKET).download(FILE);
    if (!downloaded.error && downloaded.data) {
      const parsed = JSON.parse(await downloaded.data.text());
      if (validDeployment(parsed)) {
        const stored = normalizeDeployment(parsed);
        if (matchesVerifiedProduction(stored)) {
          // Stored timestamps may be newer, but security-sensitive deployment
          // fields are accepted only when they exactly match reviewed code.
          const value: VoxelFlipDeployment = {
            ...VERIFIED_PRODUCTION_FALLBACK,
            deployedAt: stored.deployedAt || VERIFIED_PRODUCTION_FALLBACK.deployedAt,
            registeredAt: stored.registeredAt || VERIFIED_PRODUCTION_FALLBACK.registeredAt,
          };
          memoryCache = { value, expiresAt: Date.now() + 30_000 };
          return value;
        }

        if (!warnedAboutStoredConflict) {
          warnedAboutStoredConflict = true;
          console.warn('Ignoring untrusted VoxelFlip deployment.json; it does not match the reviewed production deployment.', {
            storedAddress: stored.address,
            productionAddress: VERIFIED_PRODUCTION_FALLBACK.address,
          });
        }
      }
    }
  } catch (error) {
    console.warn('VoxelFlip deployment metadata storage is unavailable; using the reviewed production deployment.', error);
  }

  const value = { ...VERIFIED_PRODUCTION_FALLBACK };
  memoryCache = { value, expiresAt: Date.now() + 30_000 };
  return value;
}
