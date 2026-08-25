import { getSupabaseAdmin } from './supabase-admin';

const TABLE = 'voxelpop_crypto_purchases';
const BUCKET = 'voxel-system';
const PREFIX = 'voxelpop-crypto';
let tableReadyPromise: Promise<boolean> | null = null;
let storageReadyPromise: Promise<boolean> | null = null;

export type CryptoPurchaseRow = {
  session_id: string;
  wallet: string;
  tx_hash?: string | null;
  chain_id: number;
  status: 'quoted' | 'paid' | 'expired';
  quote_wei: string;
  quote_usd_cents: number;
  quote_expires_at: string;
  metadata: Record<string, string>;
  created_at?: string;
  updated_at?: string;
};

function normalize(value: any): CryptoPurchaseRow | null {
  if (!value?.session_id || !value?.wallet) return null;
  return {
    session_id: String(value.session_id),
    wallet: String(value.wallet).toLowerCase(),
    tx_hash: value.tx_hash ? String(value.tx_hash).toLowerCase() : null,
    chain_id: Number(value.chain_id || 8453),
    status: ['paid', 'expired'].includes(String(value.status)) ? value.status : 'quoted',
    quote_wei: String(value.quote_wei || '0'),
    quote_usd_cents: Number(value.quote_usd_cents || 199),
    quote_expires_at: String(value.quote_expires_at || ''),
    metadata: value.metadata && typeof value.metadata === 'object' ? value.metadata : {},
    created_at: value.created_at || undefined,
    updated_at: value.updated_at || undefined,
  };
}

async function tableReady() {
  if (!tableReadyPromise) {
    tableReadyPromise = (async () => {
      try {
        const { error } = await getSupabaseAdmin().from(TABLE).select('session_id', { count: 'exact', head: true });
        return !error;
      } catch { return false; }
    })();
  }
  return tableReadyPromise;
}

async function storageReady() {
  if (!storageReadyPromise) {
    storageReadyPromise = (async () => {
      try {
        const supabase = getSupabaseAdmin();
        const { data, error } = await supabase.storage.listBuckets();
        if (error) return false;
        if (!data?.some((bucket) => bucket.name === BUCKET)) {
          const created = await supabase.storage.createBucket(BUCKET, { public: false, fileSizeLimit: '1MB' });
          if (created.error && !/already exists/i.test(created.error.message || '')) return false;
        }
        return true;
      } catch { return false; }
    })();
  }
  return storageReadyPromise;
}

function pathFor(sessionId: string) { return `${PREFIX}/${encodeURIComponent(sessionId)}.json`; }

async function readStorage(sessionId: string) {
  if (!(await storageReady())) return null;
  try {
    const { data, error } = await getSupabaseAdmin().storage.from(BUCKET).download(pathFor(sessionId));
    if (error || !data) return null;
    return normalize(JSON.parse(await data.text()));
  } catch { return null; }
}

async function writeStorage(row: CryptoPurchaseRow, upsert = true) {
  if (!(await storageReady())) throw new Error('Crypto purchase storage is unavailable');
  const normalized = normalize({ ...row, updated_at: new Date().toISOString() });
  if (!normalized) throw new Error('Invalid crypto purchase row');
  const { error } = await getSupabaseAdmin().storage.from(BUCKET).upload(pathFor(normalized.session_id), JSON.stringify(normalized), {
    contentType: 'application/json', cacheControl: '0', upsert,
  });
  if (error) throw error;
  return normalized;
}

export async function readCryptoPurchase(sessionId: string) {
  if (await tableReady()) {
    try {
      const { data, error } = await getSupabaseAdmin().from(TABLE).select('*').eq('session_id', sessionId).maybeSingle();
      if (!error && data) return normalize(data);
    } catch {}
  }
  return readStorage(sessionId);
}

export async function createCryptoPurchase(row: CryptoPurchaseRow) {
  const normalized = normalize({ ...row, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  if (!normalized) throw new Error('Invalid crypto purchase row');
  if (await tableReady()) {
    const { data, error } = await getSupabaseAdmin().from(TABLE).insert(normalized).select('*').single();
    if (error) throw error;
    return normalize(data)!;
  }
  return writeStorage(normalized, false);
}

export async function updateCryptoPurchase(sessionId: string, patch: Partial<CryptoPurchaseRow>) {
  const current = await readCryptoPurchase(sessionId);
  if (!current) throw new Error('Crypto purchase not found');
  const next = normalize({ ...current, ...patch, session_id: current.session_id, updated_at: new Date().toISOString() });
  if (!next) throw new Error('Invalid crypto purchase update');
  if (await tableReady()) {
    const { data, error } = await getSupabaseAdmin().from(TABLE).update({ ...patch, updated_at: new Date().toISOString() }).eq('session_id', sessionId).select('*').single();
    if (error) throw error;
    return normalize(data)!;
  }
  return writeStorage(next, true);
}

export async function findCryptoPurchaseByTxHash(txHash: string) {
  const target = String(txHash || '').toLowerCase();
  if (!target) return null;
  if (await tableReady()) {
    try {
      const { data, error } = await getSupabaseAdmin().from(TABLE).select('*').eq('tx_hash', target).maybeSingle();
      if (!error && data) return normalize(data);
    } catch {}
  }
  if (!(await storageReady())) return null;
  try {
    const bucket = getSupabaseAdmin().storage.from(BUCKET);
    const { data, error } = await bucket.list(PREFIX, { limit: 1000, sortBy: { column: 'name', order: 'desc' } });
    if (error) return null;
    for (const file of data || []) {
      if (!file.name?.endsWith('.json')) continue;
      const sessionId = decodeURIComponent(file.name.replace(/\.json$/i, ''));
      const row = await readStorage(sessionId);
      if (row?.tx_hash === target) return row;
    }
  } catch {}
  return null;
}
