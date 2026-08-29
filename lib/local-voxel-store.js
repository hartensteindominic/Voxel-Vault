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

export async function saveLocalVoxelRecord(itemId, patch = {}) {
  const payload = normalizeRow({
    item_id: itemId,
    ...patch,
    updated_at: new Date().toISOString(),
  });
  if (!payload?.item_id) return null;

  // Use the shared catalog store instead of a table-only write. The catalog
  // store already handles current and legacy table schemas and falls back to
  // private Supabase Storage metadata when the table is unavailable. A local
  // VoxelPop build should not fail just because one persistence backend is
  // temporarily unavailable or a deployment is still on an older schema.
  return saveCatalog3D(itemId, payload);
}
