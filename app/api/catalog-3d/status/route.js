import { NextResponse } from 'next/server';
import { REAL_WORLD_CATALOG } from '../../../../lib/realWorldCatalog';
import { catalog3DStoreHealth, listCatalog3D } from '../../../../lib/catalog3dStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function hasFinishedModel(row) {
  return Boolean(row?.model_storage_path || row?.model_url);
}

export async function GET() {
  const health = await catalog3DStoreHealth();
  if (!health.ready) {
    return NextResponse.json({
      ok: false,
      storageReady: false,
      storageBackend: health.backend,
      catalogTotal: REAL_WORLD_CATALOG.length,
      ready: 0,
      building: 0,
      failed: 0,
      queued: REAL_WORLD_CATALOG.length,
      reason: 'Persistent collectible storage is not ready.',
    }, { status: 503 });
  }

  const rows = await listCatalog3D();
  const byItem = new Map(rows.map(row => [row.item_id, row]));
  let ready = 0;
  let building = 0;
  let failed = 0;
  let queued = 0;

  for (const item of REAL_WORLD_CATALOG) {
    const row = byItem.get(item.id);
    const status = String(row?.status || '').toUpperCase();
    if (hasFinishedModel(row)) ready += 1;
    else if (['FAILED', 'CANCELED'].includes(status)) failed += 1;
    else if (row?.task_id) building += 1;
    else queued += 1;
  }

  return NextResponse.json({
    ok: true,
    storageReady: true,
    storageBackend: health.backend,
    catalogTotal: REAL_WORLD_CATALOG.length,
    ready,
    building,
    failed,
    queued,
    updatedAt: new Date().toISOString(),
  });
}
