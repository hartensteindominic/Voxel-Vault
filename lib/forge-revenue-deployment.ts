import { createHmac } from 'node:crypto';
import { Wallet, getAddress, isAddress } from 'ethers';
import { getSupabaseAdmin } from './supabase-admin';

const SYSTEM_BUCKET = 'voxel-system';
const CONFIG_PATH = 'forge/revenue-deployment.json';
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const TX_RE = /^0x[a-fA-F0-9]{64}$/;

// This deployment reached the persistence step only after the production
// registration route had verified its Base runtime shape, EIP-712 domain,
// owner, treasury, protected signer, launch fee, royalty, approved VoxelFlip
// parent collection, pause state and interface support. Pin it in reviewed code
// so production does not depend on optional Supabase admin credentials.
const VERIFIED_PRODUCTION_ADDRESS = '0x34d7E9d8Cae07B61eb1f0c1dABD4876F2429cd3D';
const VERIFIED_OWNER = '0x02f93c7547309ca50EEAB446DaEBE8ce8E694cBb';
const VERIFIED_PARENT_COLLECTION = '0xa00758b05f96ef4409d97c3ffebb6794b2eafbde';
const VERIFIED_FORGE_FEE_WEI = '1000000000000000'; // 0.001 ETH
const VERIFIED_ROYALTY_BPS = 500;

export type RevenueForgeDeployment = {
  chainId: 8453;
  network: 'base';
  address: string;
  deploymentTxHash: string;
  owner: string;
  forgeSigner: string;
  treasury: string;
  parentCollection: string;
  forgeFeeWei: string;
  royaltyBps: number;
  deployedAt: string;
  registeredAt: string;
};

function normalizePrivateKey(value: string) {
  const trimmed = value.trim();
  if (/^[a-fA-F0-9]{64}$/.test(trimmed)) return `0x${trimmed}`;
  if (/^0X[a-fA-F0-9]{64}$/.test(trimmed)) return `0x${trimmed.slice(2)}`;
  return trimmed;
}

export function revenueForgeSigningWallet() {
  const dedicated = String(process.env.VOXELFORGE_SIGNER_PRIVATE_KEY || '').trim();
  if (dedicated) return new Wallet(normalizePrivateKey(dedicated));

  const mintSignerSeed = String(process.env.VOXELFLIP_MINT_SIGNER_PRIVATE_KEY || '').trim();
  if (!mintSignerSeed) throw new Error('No server signing seed is configured for the Base revenue Forge.');

  const derivedHex = createHmac('sha256', normalizePrivateKey(mintSignerSeed))
    .update('VoxelForgeRevenue:v1')
    .digest('hex');
  return new Wallet(`0x${derivedHex}`);
}

function verifiedProductionFallback(): RevenueForgeDeployment {
  return {
    chainId: 8453,
    network: 'base',
    address: getAddress(VERIFIED_PRODUCTION_ADDRESS),
    deploymentTxHash: '',
    owner: getAddress(VERIFIED_OWNER),
    forgeSigner: getAddress(revenueForgeSigningWallet().address),
    treasury: getAddress(VERIFIED_OWNER),
    parentCollection: getAddress(VERIFIED_PARENT_COLLECTION),
    forgeFeeWei: VERIFIED_FORGE_FEE_WEI,
    royaltyBps: VERIFIED_ROYALTY_BPS,
    deployedAt: '',
    registeredAt: '',
  };
}

function validDeployment(value: any): value is RevenueForgeDeployment {
  const txHash = String(value?.deploymentTxHash || '');
  return Boolean(
    value
    && Number(value.chainId) === 8453
    && String(value.network || '').toLowerCase() === 'base'
    && ADDRESS_RE.test(String(value.address || ''))
    && (!txHash || TX_RE.test(txHash))
    && ADDRESS_RE.test(String(value.owner || ''))
    && ADDRESS_RE.test(String(value.forgeSigner || ''))
    && ADDRESS_RE.test(String(value.treasury || ''))
    && ADDRESS_RE.test(String(value.parentCollection || ''))
    && /^\d+$/.test(String(value.forgeFeeWei || ''))
    && Number.isInteger(Number(value.royaltyBps))
    && Number(value.royaltyBps) >= 0
    && Number(value.royaltyBps) <= 1000
  );
}

function normalizeDeployment(value: RevenueForgeDeployment): RevenueForgeDeployment {
  return {
    chainId: 8453,
    network: 'base',
    address: getAddress(value.address),
    deploymentTxHash: String(value.deploymentTxHash || ''),
    owner: getAddress(value.owner),
    forgeSigner: getAddress(value.forgeSigner),
    treasury: getAddress(value.treasury),
    parentCollection: getAddress(value.parentCollection),
    forgeFeeWei: String(value.forgeFeeWei),
    royaltyBps: Number(value.royaltyBps),
    deployedAt: String(value.deployedAt || ''),
    registeredAt: String(value.registeredAt || ''),
  };
}

function matchesVerifiedProduction(value: RevenueForgeDeployment) {
  const expected = verifiedProductionFallback();
  const actual = normalizeDeployment(value);
  return (
    actual.address === expected.address
    && actual.owner === expected.owner
    && actual.forgeSigner === expected.forgeSigner
    && actual.treasury === expected.treasury
    && actual.parentCollection === expected.parentCollection
    && actual.forgeFeeWei === expected.forgeFeeWei
    && actual.royaltyBps === expected.royaltyBps
  );
}

async function ensureBucket() {
  const supabase = getSupabaseAdmin();
  const listed = await supabase.storage.listBuckets();
  if (listed.error) throw listed.error;
  if (!listed.data?.some(bucket => bucket.name === SYSTEM_BUCKET)) {
    const created = await supabase.storage.createBucket(SYSTEM_BUCKET, { public: false, fileSizeLimit: '1MB' });
    if (created.error && !/already exists/i.test(created.error.message || '')) throw created.error;
  }
  return supabase;
}

export async function getRevenueForgeDeployment(): Promise<RevenueForgeDeployment | null> {
  const fallback = verifiedProductionFallback();
  const envAddress = String(process.env.VOXELFORGE_REVENUE_ADDRESS || process.env.NEXT_PUBLIC_VOXELFORGE_REVENUE_ADDRESS || '').trim();
  if (isAddress(envAddress) && getAddress(envAddress) !== fallback.address) {
    console.warn('Ignoring stale revenue Forge environment override; production is pinned to the reviewed Base deployment.', {
      configuredAddress: getAddress(envAddress),
      productionAddress: fallback.address,
    });
  }

  try {
    const supabase = await ensureBucket();
    const downloaded = await supabase.storage.from(SYSTEM_BUCKET).download(CONFIG_PATH);
    if (!downloaded.error && downloaded.data) {
      const parsed = JSON.parse(await downloaded.data.text());
      if (validDeployment(parsed) && matchesVerifiedProduction(parsed)) {
        const stored = normalizeDeployment(parsed);
        return {
          ...fallback,
          deploymentTxHash: stored.deploymentTxHash || fallback.deploymentTxHash,
          deployedAt: stored.deployedAt || fallback.deployedAt,
          registeredAt: stored.registeredAt || fallback.registeredAt,
        };
      }
    }
  } catch (error) {
    console.warn('Revenue Forge deployment storage is unavailable; using the reviewed production deployment.', error);
  }

  return fallback;
}

export async function saveRevenueForgeDeployment(value: RevenueForgeDeployment) {
  if (!validDeployment(value)) throw new Error('Invalid revenue Forge deployment record.');
  const normalized = normalizeDeployment(value);
  if (!matchesVerifiedProduction(normalized)) {
    throw new Error('Revenue Forge deployment does not match the reviewed Base production deployment.');
  }

  try {
    const supabase = await ensureBucket();
    const body = JSON.stringify(normalized, null, 2);
    const uploaded = await supabase.storage.from(SYSTEM_BUCKET).upload(CONFIG_PATH, body, {
      contentType: 'application/json',
      cacheControl: '0',
      upsert: true,
    });
    if (uploaded.error) throw uploaded.error;
  } catch (error) {
    // Persistence is optional because the deployment itself is now pinned in
    // reviewed code. Do not turn missing Supabase admin credentials into a
    // customer-facing activation failure.
    console.warn('Revenue Forge deployment verified but optional Supabase persistence is unavailable.', error);
  }

  return normalized;
}
