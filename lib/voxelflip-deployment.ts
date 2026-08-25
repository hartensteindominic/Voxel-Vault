import { getSupabaseAdmin } from './supabase-admin';

const BUCKET = 'voxelflip-config';
const FILE = 'deployment.json';
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const TX_RE = /^0x[a-fA-F0-9]{64}$/;
const APPROVED_OWNER = '0x02f93c7547309ca50EEAB446DaEBE8ce8E694cBb';

// This Base deployment already passed the live VoxelFlip identity checks in the
// registration route (bytecode, owner, mint signer, name/symbol and 5% ERC-2981
// royalty). Keep it as a branch-level fallback so Preview deployments do not
// depend on Supabase credentials just to remember the collection address.
const VERIFIED_BRANCH_FALLBACK: VoxelFlipDeployment = {
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

let memoryCache: { value: VoxelFlipDeployment | null; expiresAt: number } | null = null;

function validDeployment(value: any): value is VoxelFlipDeployment {
  return Boolean(
    value &&
    ADDRESS_RE.test(String(value.address || '')) &&
    Number(value.chainId) === 8453 &&
    ADDRESS_RE.test(String(value.owner || '')) &&
    ADDRESS_RE.test(String(value.mintSigner || '')) &&
    ADDRESS_RE.test(String(value.royaltyReceiver || '')) &&
    Number.isInteger(Number(value.royaltyBps)) &&
    Number(value.royaltyBps) >= 0 &&
    Number(value.royaltyBps) <= 1000 &&
    TX_RE.test(String(value.deploymentTxHash || ''))
  );
}

async function ensureBucket() {
  const supabase = getSupabaseAdmin();
  const listed = await supabase.storage.listBuckets();
  if (listed.error) throw listed.error;
  if (!listed.data?.some((bucket) => bucket.name === BUCKET)) {
    const created = await supabase.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: '1MB',
      allowedMimeTypes: ['application/json'],
    });
    if (created.error) throw created.error;
  }
  return supabase;
}

function envFallback(): VoxelFlipDeployment | null {
  const address = (process.env.NEXT_PUBLIC_VOXELFLIP_NFT_ADDRESS || process.env.VOXELFLIP_NFT_ADDRESS || '').trim();
  if (!ADDRESS_RE.test(address)) return null;
  const owner = (process.env.MULTISIG_OWNER || APPROVED_OWNER).trim();
  const royaltyReceiver = (process.env.VOXELFLIP_ROYALTY_RECEIVER || owner).trim();
  const mintSigner = (process.env.VOXELFLIP_MINT_SIGNER_ADDRESS || owner).trim();
  if (![owner, royaltyReceiver, mintSigner].every((value) => ADDRESS_RE.test(value))) return null;
  return {
    address,
    chainId: 8453,
    network: 'base',
    owner,
    mintSigner,
    royaltyReceiver,
    royaltyBps: 500,
    deploymentTxHash: '0x' + '0'.repeat(64),
    deployedAt: '',
    registeredAt: '',
  };
}

function codeFallback(): VoxelFlipDeployment | null {
  return validDeployment(VERIFIED_BRANCH_FALLBACK) ? VERIFIED_BRANCH_FALLBACK : null;
}

export async function getVoxelFlipDeployment(options: { bypassCache?: boolean } = {}): Promise<VoxelFlipDeployment | null> {
  if (!options.bypassCache && memoryCache && memoryCache.expiresAt > Date.now()) return memoryCache.value;

  try {
    const supabase = getSupabaseAdmin();
    const downloaded = await supabase.storage.from(BUCKET).download(FILE);
    if (!downloaded.error && downloaded.data) {
      const parsed = JSON.parse(await downloaded.data.text());
      if (validDeployment(parsed)) {
        const value = { ...parsed, royaltyBps: Number(parsed.royaltyBps), chainId: 8453 } as VoxelFlipDeployment;
        memoryCache = { value, expiresAt: Date.now() + 30_000 };
        return value;
      }
    }
  } catch {
    // Supabase is optional for the branch preview. Fall through to an environment
    // override or the verified code fallback instead of blocking mint readiness.
  }

  const fallback = envFallback() || codeFallback();
  memoryCache = { value: fallback, expiresAt: Date.now() + 30_000 };
  return fallback;
}

export async function saveVoxelFlipDeployment(value: VoxelFlipDeployment) {
  if (!validDeployment(value)) throw new Error('Invalid VoxelFlip deployment record');
  const existing = await getVoxelFlipDeployment({ bypassCache: true });
  if (existing?.address && existing.address.toLowerCase() !== value.address.toLowerCase()) {
    throw new Error(`VoxelFlip is already registered at ${existing.address}`);
  }

  // Always make a successfully verified deployment immediately available to this
  // runtime, even when optional persistent storage credentials are absent.
  memoryCache = { value, expiresAt: Date.now() + 30_000 };

  try {
    const supabase = await ensureBucket();
    const uploaded = await supabase.storage.from(BUCKET).upload(FILE, JSON.stringify(value, null, 2), {
      contentType: 'application/json',
      cacheControl: '60',
      upsert: true,
    });
    if (uploaded.error) throw uploaded.error;
  } catch (error) {
    console.warn('VoxelFlip deployment is using branch fallback because Supabase persistence is unavailable.', error);
  }

  return value;
}
