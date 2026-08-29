import { getSupabaseAdminCandidates } from './supabase-admin';

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

function adminCandidates() {
  try {
    return getSupabaseAdminCandidates();
  } catch {
    return [];
  }
}

async function tableReadyFor(admin) {
  try {
    const { error } = await admin
      .from('catalog_3d_media')
      .select('item_id,task_id', { count: 'exact', head: true });
    return !error;
  } catch {
    return false;
  }
}

async function firstReadableTableClient() {
  for (const admin of adminCandidates()) {
    if (await tableReadyFor(admin)) return admin;
  }
  return null;
}

async function tableReady() {
  return Boolean(await firstReadableTableClient());
}

function legacyTablePayload(payload = {}) {
  const {
    source_image_urls: _sourceImageUrls,
    model_storage_path: _modelStoragePath,
    ...legacy
  } = payload;
  return legacy;
}

async function writeTableRow(admin, payload) {
  try {
    const full = await admin
      .from('catalog_3d_media')
      .upsert(payload, { onConflict: 'item_id' })
      .select('*')
      .single();
    if (!full.error && full.data) return normalizeRow(full.data);

    // Production deployments may still have the original 007/008 schema.
    // Those tables are valid for generation ownership/status records but do not
    // yet have the optional 009 source_image_urls/model_storage_path columns.
    const legacy = await admin
      .from('catalog_3d_media')
      .upsert(legacyTablePayload(payload), { onConflict: 'item_id' })
      .select('*')
      .single();
    if (!legacy.error && legacy.data) return normalizeRow(legacy.data);
  } catch {}
  return null;
}

async function storageReadyFor(supabase) {
  try {
    const { data, error } = await supabase.storage.listBuckets();
    if (!error) {
      if (data?.some(bucket => bucket.name === SYSTEM_BUCKET)) return true;
      const created = await supabase.storage.createBucket(SYSTEM_BUCKET, { public: false, fileSizeLimit: '75MB' });
      return !created.error || /already exists/i.test(created.error?.message || '');
    }
  } catch {}

  // Bucket listing can be temporarily unavailable even when object access works.
  // Try idempotent creation anyway; an "already exists" response proves the
  // target bucket is present and avoids turning a transient list failure into a
  // permanent generation-record failure.
  try {
    const created = await supabase.storage.createBucket(SYSTEM_BUCKET, { public: false, fileSizeLimit: '75MB' });
    return !created.error || /already exists/i.test(created.error?.message || '');
  } catch {
    return false;
  }
}

async function discoverStorageClient() {
  for (const supabase of adminCandidates()) {
    if (await storageReadyFor(supabase)) return supabase;
  }
  return null;
}

async function ensureStorageReady() {
  if (!storageReadyPromise) storageReadyPromise = discoverStorageClient();
  const ready = await storageReadyPromise;
  // Never pin a transient failure for the lifetime of a warm server instance.
  if (!ready) storageReadyPromise = null;
  return ready;
}

async function readStorageRow(itemId) {
  if (!itemId) return null;
  const supabase = await ensureStorageReady();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.storage.from(SYSTEM_BUCKET).download(metadataPath(itemId));
    if (error || !data) return null;
    return normalizeRow(JSON.parse(await data.text()));
  } catch { return null; }
}

async function writeStorageRow(itemId, patch = {}) {
  if (!itemId) return null;
  const previous = await readStorageRow(itemId);
  const payload = normalizeRow({ ...(previous || {}), item_id: itemId, ...patch, updated_at: new Date().toISOString() });
  const body = JSON.stringify(payload);

  // A credential that can inspect Storage is not necessarily the one that can
  // write objects. Try every configured backend credential, just as table
  // persistence does, and only cache a client after a successful upload.
  for (const supabase of adminCandidates()) {
    if (!(await storageReadyFor(supabase))) continue;
    try {
      const { error } = await supabase.storage.from(SYSTEM_BUCKET).upload(metadataPath(itemId), body, {
        contentType: 'application/json',
        cacheControl: '0',
        upsert: true,
      });
      if (error) continue;
      storageReadyPromise = Promise.resolve(supabase);
      return payload;
    } catch {}
  }

  storageReadyPromise = null;
  return null;
}

async function listStorageRows() {
  const supabase = await ensureStorageReady();
  if (!supabase) return [];
  try {
    const bucket = supabase.storage.from(SYSTEM_BUCKET);
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
  const storage = table ? true : Boolean(await ensureStorageReady());
  return { ready: table || storage, backend: table ? 'table' : storage ? 'storage' : 'unavailable', table, storage };
}

export async function catalog3DStoreReady() {
  return (await catalog3DStoreHealth()).ready;
}

export async function readCatalog3D(itemId) {
  if (!itemId) return null;
  const admin = await firstReadableTableClient();
  if (admin) {
    try {
      const { data, error } = await admin.from('catalog_3d_media').select('*').eq('item_id', itemId).maybeSingle();
      if (!error && data) return normalizeRow(data);
    } catch {}
  }
  return readStorageRow(itemId);
}

export async function readCatalog3DByTask(taskId) {
  if (!taskId) return null;
  const admin = await firstReadableTableClient();
  if (admin) {
    try {
      const { data, error } = await admin.from('catalog_3d_media').select('*').eq('task_id', taskId).maybeSingle();
      if (!error && data) return normalizeRow(data);
    } catch {}
  }
  const rows = await listStorageRows();
  return rows.find(row => row.task_id === taskId) || null;
}

export async function listCatalog3D() {
  const admin = await firstReadableTableClient();
  if (admin) {
    try {
      const { data, error } = await admin.from('catalog_3d_media').select('*');
      if (!error) return (data || []).map(normalizeRow).filter(Boolean);
    } catch {}
  }
  return listStorageRows();
}

export async function saveCatalog3D(itemId, patch = {}) {
  if (!itemId) return null;
  const payload = normalizeRow({ item_id: itemId, ...patch, updated_at: new Date().toISOString() });

  // Try every configured server credential. This avoids a stale/limited first
  // credential hiding a valid service-role/secret-key candidate.
  for (const admin of adminCandidates()) {
    if (!(await tableReadyFor(admin))) continue;
    const saved = await writeTableRow(admin, payload);
    if (saved) return saved;
  }

  return writeStorageRow(itemId, payload);
}

export async function persistModelBinary(itemId, remoteUrl) {
  if (!itemId || !remoteUrl) return null;
  const supabase = await ensureStorageReady();
  if (!supabase) return null;
  try {
    const response = await fetch(remoteUrl, { cache: 'no-store' });
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type') || 'model/gltf-binary';
    const bytes = await response.arrayBuffer();
    const path = `models/${encodeURIComponent(String(itemId))}.glb`;
    const { error } = await supabase.storage.from(SYSTEM_BUCKET).upload(path, bytes, {
      contentType,
      cacheControl: '31536000',
      upsert: true,
    });
    if (error) {
      storageReadyPromise = null;
      return null;
    }
    return path;
  } catch {
    storageReadyPromise = null;
    return null;
  }
}

export async function createModelSignedUrl(storagePath, expiresIn = 3600) {
  if (!storagePath) return null;
  const supabase = await ensureStorageReady();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.storage.from(SYSTEM_BUCKET).createSignedUrl(storagePath, expiresIn);
    if (error) return null;
    return data?.signedUrl || null;
  } catch { return null; }
}
