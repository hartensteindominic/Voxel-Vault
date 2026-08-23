import { NextResponse } from 'next/server';
import { catalog3DStoreHealth, listCatalog3D, readCatalog3D } from '../../../lib/catalog3dStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function publicRow(row) {
  if (!row) return null;
  const hasModel = Boolean(row.model_storage_path || row.model_url);
  return {
    itemId: row.item_id,
    taskId: row.task_id || null,
    status: row.status || 'pending',
    progress: hasModel ? 100 : row.progress || 0,
    modelUrl: hasModel ? `/api/catalog-3d/model?itemId=${encodeURIComponent(row.item_id)}` : null,
    modelStored: Boolean(row.model_storage_path),
    thumbnailUrl: row.thumbnail_url || null,
    exactModelApproved: Boolean(row.exact_model_approved),
    error: row.error || null,
    updatedAt: row.updated_at || null,
  };
}

export async function GET(request) {
  const itemId = new URL(request.url).searchParams.get('itemId');
  const health = await catalog3DStoreHealth();
  if (!health.ready) {
    return NextResponse.json({
      found: false,
      storageReady: false,
      status: 'preparing',
      message: 'Collectible preparation is temporarily unavailable.',
    }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  }

  if (!itemId) {
    const rows = await listCatalog3D();
    return NextResponse.json({
      storageReady: true,
      items: rows.map(publicRow).filter(Boolean),
    }, { headers: { 'Cache-Control': 'no-store' } });
  }

  const row = await readCatalog3D(itemId);
  if (!row) return NextResponse.json({ found: false, storageReady: true, status: 'queued' }, { headers: { 'Cache-Control': 'no-store' } });
  return NextResponse.json({ found: true, storageReady: true, ...publicRow(row) }, { headers: { 'Cache-Control': 'no-store' } });
}
