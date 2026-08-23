import { NextResponse } from 'next/server';
import { catalog3DStoreHealth, readCatalog3D } from '../../../lib/catalog3dStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const itemId = new URL(request.url).searchParams.get('itemId');
  if (!itemId) return NextResponse.json({ error: 'itemId is required' }, { status: 400 });

  const health = await catalog3DStoreHealth();
  if (!health.ready) {
    return NextResponse.json({
      found: false,
      storageReady: false,
      storageBackend: health.backend,
      status: 'storage_unavailable',
      error: 'Persistent collectible storage is not ready.',
    }, { status: 503 });
  }

  const row = await readCatalog3D(itemId);
  if (!row) return NextResponse.json({ found: false, storageReady: true, storageBackend: health.backend, status: 'queued' });

  const hasModel = Boolean(row.model_storage_path || row.model_url);
  const modelUrl = hasModel ? `/api/catalog-3d/model?itemId=${encodeURIComponent(itemId)}` : null;

  return NextResponse.json({
    found: true,
    storageReady: true,
    storageBackend: health.backend,
    itemId: row.item_id,
    taskId: row.task_id || null,
    status: row.status || 'pending',
    progress: hasModel ? 100 : row.progress || 0,
    modelUrl,
    modelStored: Boolean(row.model_storage_path),
    thumbnailUrl: row.thumbnail_url || null,
    exactModelApproved: Boolean(row.exact_model_approved),
    error: row.error || null,
    updatedAt: row.updated_at || null,
  });
}
