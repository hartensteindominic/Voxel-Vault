import { NextResponse } from 'next/server';
import { catalog3DStoreReady, readCatalog3D } from '../../../lib/catalog3dStore';

export const runtime = 'nodejs';

export async function GET(request) {
  const itemId = new URL(request.url).searchParams.get('itemId');
  if (!itemId) return NextResponse.json({ error: 'itemId is required' }, { status: 400 });

  const storageReady = await catalog3DStoreReady();
  if (!storageReady) {
    return NextResponse.json({
      found: false,
      storageReady: false,
      status: 'storage_unavailable',
      error: 'Persistent collectible storage is not ready.',
    }, { status: 503 });
  }

  const row = await readCatalog3D(itemId);
  if (!row) return NextResponse.json({ found: false, storageReady: true, status: 'queued' });

  return NextResponse.json({
    found: true,
    storageReady: true,
    itemId: row.item_id,
    taskId: row.task_id || null,
    status: row.status || 'pending',
    progress: row.progress || 0,
    modelUrl: row.model_url || null,
    thumbnailUrl: row.thumbnail_url || null,
    exactModelApproved: Boolean(row.exact_model_approved),
    error: row.error || null,
    updatedAt: row.updated_at || null,
  });
}
