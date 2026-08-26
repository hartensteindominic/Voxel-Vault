import { createHmac } from 'node:crypto';
import { Wallet, getAddress, isAddress } from 'ethers';
import { getSupabaseAdmin } from './supabase-admin';

const SYSTEM_BUCKET = 'voxel-system';
const CONFIG_PATH = 'forge/revenue-deployment.json';
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const TX_RE = /^0x[a-fA-F0-9]{64}$/;

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
  const envAddress = String(process.env.VOXELFORGE_REVENUE_ADDRESS || process.env.NEXT_PUBLIC_VOXELFORGE_REVENUE_ADDRESS || '').trim();
  if (isAddress(envAddress)) {
    try {
      const supabase = await ensureBucket();
      const downloaded = await supabase.storage.from(SYSTEM_BUCKET).download(CONFIG_PATH);
      if (!downloaded.error && downloaded.data) {
        const parsed = JSON.parse(await downloaded.data.text());
        if (validDeployment(parsed) && getAddress(parsed.address) === getAddress(envAddress)) return normalizeDeployment(parsed);
      }
    } catch {}
  }

  try {
    const supabase = await ensureBucket();
    const downloaded = await supabase.storage.from(SYSTEM_BUCKET).download(CONFIG_PATH);
    if (downloaded.error || !downloaded.data) return null;
    const parsed = JSON.parse(await downloaded.data.text());
    return validDeployment(parsed) ? normalizeDeployment(parsed) : null;
  } catch {
    return null;
  }
}

export async function saveRevenueForgeDeployment(value: RevenueForgeDeployment) {
  if (!validDeployment(value)) throw new Error('Invalid revenue Forge deployment record.');
  const normalized = normalizeDeployment(value);
  const supabase = await ensureBucket();
  const body = JSON.stringify(normalized, null, 2);
  const uploaded = await supabase.storage.from(SYSTEM_BUCKET).upload(CONFIG_PATH, body, {
    contentType: 'application/json',
    cacheControl: '0',
    upsert: true,
  });
  if (uploaded.error) throw uploaded.error;
  return normalized;
}
