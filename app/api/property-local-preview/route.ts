import { NextResponse } from 'next/server';
import { requireVoxelVaultUser } from '../../../lib/user-auth';
import { normalizePropertyDraftId, propertyLocalPreviewTaskId } from '../../../lib/property-generation-ids';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const auth = await requireVoxelVaultUser(request);
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status, headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const draftId = normalizePropertyDraftId(body?.draftId);
    return NextResponse.json({
      ok: true,
      draftId,
      taskId: propertyLocalPreviewTaskId(auth.user.id, draftId),
      kind: 'source-backed-local-map-voxel',
      provider: 'world-atlas-local',
      status: 'COMPLETED',
      progress: 100,
      usesMeshyCredits: false,
    }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'The local map voxel could not be prepared.',
    }, { status: 400, headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  }
}
