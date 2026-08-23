import { NextResponse } from 'next/server';
import { REAL_WORLD_CATALOG } from '../../../../lib/realWorldCatalog';
import { catalog3DStoreHealth, listCatalog3D } from '../../../../lib/catalog3dStore';

export const runtime = 'nodejs';
export const maxDuration = 60;

const STALE_AFTER_MS = 25 * 60 * 1000;

function authorized(request) {
  const secret = process.env.CRON_SECRET;
  if (secret) return request.headers.get('authorization') === `Bearer ${secret}`;
  return /vercel-cron/i.test(request.headers.get('user-agent') || '');
}

function terminalFailure(row) {
  return ['FAILED', 'CANCELED'].includes(String(row?.status || '').toUpperCase());
}

function hasFinishedModel(row) {
  return Boolean(row?.model_storage_path || row?.model_url);
}

function isStale(row) {
  if (!row?.task_id || hasFinishedModel(row)) return false;
  const stamp = Date.parse(row.updated_at || row.started_at || '');
  return Number.isFinite(stamp) && Date.now() - stamp > STALE_AFTER_MS;
}

export async function GET(request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const health = await catalog3DStoreHealth();
  if (!health.ready) {
    return NextResponse.json({
      ok: false,
      skipped: true,
      storageReady: false,
      storageBackend: health.backend,
      reason: 'Persistent collectible storage is unavailable. Generation is paused to avoid duplicate paid jobs.',
    }, { status: 503 });
  }

  const origin = new URL(request.url).origin;
  const rows = await listCatalog3D();
  const byItem = new Map(rows.map(row => [row.item_id, row]));
  const operations = [];

  for (const row of rows) {
    if (!row.task_id || hasFinishedModel(row) || terminalFailure(row) || isStale(row)) continue;
    operations.push(fetch(`${origin}/api/image-to-3d?taskId=${encodeURIComponent(row.task_id)}`, {
      cache: 'no-store',
    }).then(async response => ({ kind: 'poll', itemId: row.item_id, ok: response.ok, data: await response.json().catch(() => ({})) })));
  }

  const toRestart = REAL_WORLD_CATALOG.filter(item => {
    const row = byItem.get(item.id);
    return Boolean(row && !hasFinishedModel(row) && (terminalFailure(row) || isStale(row)));
  });

  const toStart = REAL_WORLD_CATALOG.filter(item => {
    const row = byItem.get(item.id);
    return !row || (!hasFinishedModel(row) && !row.task_id);
  });

  for (const item of toRestart) {
    operations.push(fetch(`${origin}/api/image-to-3d`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ item, forceRestart: true }),
      cache: 'no-store',
    }).then(async response => ({ kind: 'restart', itemId: item.id, ok: response.ok, data: await response.json().catch(() => ({})) })));
  }

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
  const ready = after.filter(hasFinishedModel).length;
  const building = after.filter(row => row.task_id && !hasFinishedModel(row) && !terminalFailure(row)).length;
  const failed = after.filter(terminalFailure).length;

  return NextResponse.json({
    ok: failures === 0,
    storageReady: true,
    storageBackend: health.backend,
    catalogTotal: REAL_WORLD_CATALOG.length,
    ready,
    building,
    failed,
    queued: Math.max(0, REAL_WORLD_CATALOG.length - ready - building - failed),
    started: toStart.length,
    restarted: toRestart.length,
    operations: settled.length,
    operationFailures: failures,
    updatedAt: new Date().toISOString(),
  });
}
