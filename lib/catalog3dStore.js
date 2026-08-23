import { getSupabaseAdmin } from './supabase-admin';

const SYSTEM_BUCKET = 'voxel-system';
const META_PREFIX = 'catalog-3d';
let storageReadyPromise;

function normalizeRow(value = {}) {
  if (!value || typeof value !== 'object') return null;
  return {
    item_id: value.item_id || value.itemId || null,
    supplier_sku: value.supplier_sku || value.supplierSku || null,
    task_id: value.task_id || value.taskId || null,
    source_image_url: value.source_image_url || value.sourceImageUrl || null,
    source_image_urls: value.source_image_urls || value.sourceImageUrls || null,
    model_url: value.model_url || value.modelUrl || null,
    model_storage_path: value.model_storage_path || value.modelStoragePath || null,
    thumbnail_url: value.thumbnail_url || value.thumbnailUrl || null,
    provider: value.provider || 'meshy',
    status: value.status || 'pending',
    progress: Number(value.progress || 0),
    exact_model_approved: Boolean(value.exact_model_approved || value.exactModelApproved),
    error: value.error || null,
    started_at: value.started_at || value.startedAt || null,
    completed_at: value.completed_at || value.completedAt || null,
    updated_at: value.updated_at || value.updatedAt || new Date().toISOString(),
  };
}

function metadataPath(itemId) {
  return `${META_PREFIX}/${encodeURIComponent(String(itemId))}.json`;
}

async function tableReady() {
  try {
    const { error } = await getSupabaseAdmin()
      .from('catalog_3d_media')
      .select('item_id,source_image_urls,model_storage_path', { count: 'exact', head: true });
    return !error;
  } catch { return false; }
}

async function ensureStorageReady() {
  if (!storageReadyPromise) {
    storageReadyPromise = (async () => {
      try {
        const supabase = getSupabaseAdmin();
        const { data, error } = await supabase.storage.listBuckets();
        if (error) return false;
        if (!data?.some(bucket => bucket.name === SYSTEM_BUCKET)) {
          const created = await supabase.storage.createBucket(SYSTEM_BUCKET, { public: false, fileSizeLimit: '75MB' });
          if (created.error && !/already exists/i.test(created.error.message || '')) return false;
        }
        return true;
      } catch { return false; }
    })();
  }
  return storageReadyPromise;
}

async function readStorageRow(itemId) {
  if (!itemId || !(await ensureStorageReady())) return null;
  try {
    const { data, error } = await getSupabaseAdmin().storage.from(SYSTEM_BUCKET).download(metadataPath(itemId));
    if (error || !data) return null;
    return normalizeRow(JSON.parse(await data.text()));
  } catch { return null; }
}

async function writeStorageRow(itemId, patch = {}) {
  if (!itemId || !(await ensureStorageReady())) return null;
  const previous = await readStorageRow(itemId);
  const payload = normalizeRow({ ...(previous || {}), item_id: itemId, ...patch, updated_at: new Date().toISOString() });
  try {
    const body = JSON.stringify(payload);
    const { error } = await getSupabaseAdmin().storage.from(SYSTEM_BUCKET).upload(metadataPath(itemId), body, {
      contentType: 'application/json',
      cacheControl: '0',
      upsert: true,
    });
    if (error) return null;
    return payload;
  } catch { return null; }
}

async function listStorageRows() {
  if (!(await ensureStorageReady())) return [];
  try {
    const bucket = getSupabaseAdmin().storage.from(SYSTEM_BUCKET);
    const { data, error } = await bucket.list(META_PREFIX, { limit: 1000, sortBy: { column: 'name', order: 'asc' } });
    if (error) return [];
    const rows = await Promise.all((data || []).filter(file => file.name?.endsWith('.json')).map(async file => {
      const itemId = decodeURIComponent(file.name.replace(/\.json$/i, ''));
      return readStorageRow(itemId);
    }));
    return rows.filter(Boolean);
  } catch { return []; }
}

export async function catalog3DStoreHealth() {
  const table = await tableReady();
  const storage = table ? true : await ensureStorageReady();
  return { ready: table || storage, backend: table ? 'table' : storage ? 'storage' : 'unavailable', table, storage };
}

export async function catalog3DStoreReady() {
  return (await catalog3DStoreHealth()).ready;
}

export async function readCatalog3D(itemId) {
  if (!itemId) return null;
  if (await tableReady()) {
    try {
      const { data, error } = await getSupabaseAdmin().from('catalog_3d_media').select('*').eq('item_id', itemId).maybeSingle();
      if (!error && data) return normalizeRow(data);
    } catch {}
  }
  return readStorageRow(itemId);
}

export async function readCatalog3DByTask(taskId) {
  if (!taskId) return null;
  if (await tableReady()) {
    try {
      const { data, error } = await getSupabaseAdmin().from('catalog_3d_media').select('*').eq('task_id', taskId).maybeSingle();
      if (!error && data) return normalizeRow(data);
    } catch {}
  }
  const rows = await listStorageRows();
  return rows.find(row => row.task_id === taskId) || null;
}

export async function listCatalog3D() {
  if (await tableReady()) {
    try {
      const { data, error } = await getSupabaseAdmin().from('catalog_3d_media').select('*');
      if (!error) return (data || []).map(normalizeRow).filter(Boolean);
    } catch {}
  }
  return listStorageRows();
}

export async function saveCatalog3D(itemId, patch = {}) {
  if (!itemId) return null;
  const payload = normalizeRow({ item_id: itemId, ...patch, updated_at: new Date().toISOString() });
  if (await tableReady()) {
    try {
      const { data, error } = await getSupabaseAdmin().from('catalog_3d_media').upsert(payload, { onConflict: 'item_id' }).select('*').single();
      if (!error && data) return normalizeRow(data);
    } catch {}
  }
  return writeStorageRow(itemId, payload);
}

export async function persistModelBinary(itemId, remoteUrl) {
  if (!itemId || !remoteUrl || !(await ensureStorageReady())) return null;
  try {
    const response = await fetch(remoteUrl, { cache: 'no-store' });
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type') || 'model/gltf-binary';
    const bytes = await response.arrayBuffer();
    const path = `models/${encodeURIComponent(String(itemId))}.glb`;
    const { error } = await getSupabaseAdmin().storage.from(SYSTEM_BUCKET).upload(path, bytes, {
      contentType,
      cacheControl: '31536000',
      upsert: true,
    });
    if (error) return null;
    return path;
  } catch { return null; }
}

export async function createModelSignedUrl(storagePath, expiresIn = 3600) {
  if (!storagePath || !(await ensureStorageReady())) return null;
  try {
    const { data, error } = await getSupabaseAdmin().storage.from(SYSTEM_BUCKET).createSignedUrl(storagePath, expiresIn);
    if (error) return null;
    return data?.signedUrl || null;
  } catch { return null; }
}
