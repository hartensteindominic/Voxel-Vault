import { NextResponse } from 'next/server';
import { requireVoxelVaultUser } from '../../../../lib/user-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function privateJson(body: unknown, init: ResponseInit = {}) {
  return NextResponse.json(body, {
    ...init,
    headers: { 'Cache-Control': 'private, no-store, max-age=0', ...(init.headers || {}) },
  });
}

export async function POST(request: Request) {
  const auth = await requireVoxelVaultUser(request);
  if (auth.ok === false) return privateJson({ ok: false, error: auth.error }, { status: auth.status });

  return privateJson({
    ok: false,
    migrated: true,
    error: 'VoxelPop creation no longer needs a pre-generation checkout, private photo staging, or Meshy credits. Refresh the Property maker to use the on-device VoxelPop preview and source-backed 3D map.',
  }, { status: 409 });
}

export async function DELETE(request: Request) {
  const auth = await requireVoxelVaultUser(request);
  if (auth.ok === false) return privateJson({ ok: false, error: auth.error }, { status: auth.status });
  return privateJson({ ok: true, deleted: false, migrated: true });
}
