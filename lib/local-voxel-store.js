import { getSupabaseAdminCandidates } from './supabase-admin';
import { saveCatalog3D } from './catalog3dStore';

function normalizeRow(value = {}) {
  if (!value || typeof value !== 'object') return null;
  return {
    item_id: value.item_id || value.itemId || null,
    supplier_sku: value.supplier_sku || value.supplierSku || null,
    task_id: value.task_id || value.taskId || null,
    source_image_url: value.source_image_url || value.sourceImageUrl || null,
    model_url: value.model_url || value.modelUrl || null,
    thumbnail_url: value.thumbnail_url || value.thumbnailUrl || null,
    provider: value.provider || 'voxelpop-local-webgl-v1',
    status: value.status || 'SUCCEEDED',
    progress: Number(value.progress || 100),
    exact_model_approved: Boolean(value.exact_model_approved || value.exactModelApproved),
    error: value.error || null,
    started_at: value.started_at || value.startedAt || null,
    completed_at: value.completed_at || value.completedAt || null,
    updated_at: value.updated_at || value.updatedAt || new Date().toISOString(),
  };
}

function legacyPayload(payload = {}) {
  const {
    source_image_urls: _sourceImageUrls,
    model_storage_path: _modelStoragePath,
    ...legacy
  } = payload;
  return legacy;
}

export async function saveLocalVoxelRecord(itemId, patch = {}) {
  const payload = normalizeRow({
    item_id: itemId,
    ...patch,
    updated_at: new Date().toISOString(),
  });
  if (!payload?.item_id) return null;

  let candidates = [];
  try {
    candidates = getSupabaseAdminCandidates();
  } catch {}

  // Prefer the compact catalog table when it is available. The local VoxelPop
  // path stores only the derived voxel recipe here; the source photo is never
  // uploaded as part of this save.
  for (const admin of candidates) {
    try {
      const full = await admin
        .from('catalog_3d_media')
        .upsert(payload, { onConflict: 'item_id' })
        .select('*')
        .single();
      if (!full.error && full.data) return normalizeRow(full.data);

      // Older production schemas (007/008) are sufficient for the local model.
      const legacy = await admin
        .from('catalog_3d_media')
        .upsert(legacyPayload(payload), { onConflict: 'item_id' })
        .select('*')
        .single();
      if (!legacy.error && legacy.data) return normalizeRow(legacy.data);
    } catch {}
  }

  // Do not turn a table/schema outage into a failed voxel. The shared catalog
  // store has a metadata-object fallback in the private voxel-system bucket and
  // readCatalog3DByTask already reads from that fallback. This keeps the model
  // durable without uploading the user's original property photo.
  try {
    return normalizeRow(await saveCatalog3D(itemId, payload));
  } catch {
    return null;
  }
}
