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

export async function GET(request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await catalog3DStoreReady())) {
    return NextResponse.json({ ok: false, skipped: true, reason: 'catalog_3d_media persistence is not ready; generation skipped to prevent duplicate provider jobs.' }, { status: 503 });
  }

  const origin = new URL(request.url).origin;
  const rows = await listCatalog3D();
  const byItem = new Map(rows.map(row => [row.item_id, row]));
  const work = [];

  for (const row of rows) {
    if (!row.task_id || row.model_url || ['FAILED','CANCELED'].includes(String(row.status || '').toUpperCase())) continue;
    work.push(fetch(`${origin}/api/image-to-3d?taskId=${encodeURIComponent(row.task_id)}`, { cache: 'no-store' }).then(r => r.json()).catch(() => null));
  }

  const missing = REAL_WORLD_CATALOG.filter(item => {
    const row = byItem.get(item.id);
    return !row?.model_url && !row?.task_id;
  });

  for (const item of missing) {
    work.push(fetch(`${origin}/api/image-to-3d`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ item }),
      cache: 'no-store',
    }).then(r => r.json()).catch(() => null));
  }

  const results = await Promise.allSettled(work);
  return NextResponse.json({ ok: true, checked: rows.length, started: missing.length, operations: results.length });
}
