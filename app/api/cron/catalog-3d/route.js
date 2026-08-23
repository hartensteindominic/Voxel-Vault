import { NextResponse } from 'next/server';
import { REAL_WORLD_CATALOG } from '../../../../lib/realWorldCatalog';
import { catalog3DStoreReady, listCatalog3D } from '../../../../lib/catalog3dStore';

export const runtime = 'nodejs';
export const maxDuration = 60;

function authorized(request) {
  const secret = process.env.CRON_SECRET;
  if (secret) return request.headers.get('authorization') === `Bearer ${secret}`;
  return /vercel-cron/i.test(request.headers.get('user-agent') || '');
}

function terminalFailure(row) {
  return ['FAILED', 'CANCELED'].includes(String(row?.status || '').toUpperCase());
}

export async function GET(request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const storeReady = await catalog3DStoreReady();
  if (!storeReady) {
    return NextResponse.json({
      ok: false,
      skipped: true,
      storageReady: false,
      reason: 'catalog_3d_media is unavailable. Apply supabase/migrations/007_catalog_3d_media.sql to production Supabase before background generation can persist safely.',
    }, { status: 503 });
  }

  const origin = new URL(request.url).origin;
  const rows = await listCatalog3D();
  const byItem = new Map(rows.map(row => [row.item_id, row]));
  const operations = [];

  // Advance every active provider task on every worker run.
  for (const row of rows) {
    if (!row.task_id || row.model_url || terminalFailure(row)) continue;
    operations.push(fetch(`${origin}/api/image-to-3d?taskId=${encodeURIComponent(row.task_id)}`, {
      cache: 'no-store',
    }).then(async response => ({ kind: 'poll', itemId: row.item_id, ok: response.ok, data: await response.json().catch(() => ({})) })));
  }

  // Prebuild every catalog item. Failed/canceled tasks are retried automatically.
  const toStart = REAL_WORLD_CATALOG.filter(item => {
    const row = byItem.get(item.id);
    if (!row) return true;
    if (row.model_url) return false;
    if (!row.task_id) return true;
    return terminalFailure(row);
  });

  for (const item of toStart) {
    operations.push(fetch(`${origin}/api/image-to-3d`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ item }),
      cache: 'no-store',
    }).then(async response => ({ kind: 'start', itemId: item.id, ok: response.ok, data: await response.json().catch(() => ({})) })));
  }

  const settled = await Promise.allSettled(operations);
  const failures = settled.filter(result => result.status === 'rejected' || (result.status === 'fulfilled' && !result.value?.ok)).length;
  const after = await listCatalog3D();
  const ready = after.filter(row => Boolean(row.model_url)).length;
  const building = after.filter(row => row.task_id && !row.model_url && !terminalFailure(row)).length;
  const failed = after.filter(terminalFailure).length;

  return NextResponse.json({
    ok: failures === 0,
    storageReady: true,
    catalogTotal: REAL_WORLD_CATALOG.length,
    ready,
    building,
    failed,
    started: toStart.length,
    operations: settled.length,
    operationFailures: failures,
  });
}
