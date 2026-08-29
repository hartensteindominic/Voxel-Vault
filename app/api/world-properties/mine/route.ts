import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireVoxelVaultUser } from '../../../../lib/user-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function finite(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function worldId(userId: string, draftId: string) {
  return createHash('sha256').update(`voxel-vault-world-v1:${userId}:${draftId}`).digest('hex').slice(0, 24);
}

export async function GET(request: Request) {
  const auth = await requireVoxelVaultUser(request);
  if (auth.ok === false) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  try {
    const { data, error } = await auth.admin
      .from('vault_profiles')
      .select('handle,display_name,avatar_style')
      .eq('user_id', auth.user.id)
      .maybeSingle();
    if (error) throw error;
    const library = Array.isArray(data?.avatar_style?.property_draft_library)
      ? data.avatar_style.property_draft_library
      : [];
    const items = library.flatMap((draft: any) => {
      if (draft?.type !== 'voxel-vault-property-3d-draft') return [];
      const latitude = finite(draft?.coordinates?.latitude);
      const longitude = finite(draft?.coordinates?.longitude);
      if (latitude === null || longitude === null) return [];
      return [{
        id: worldId(auth.user.id, String(draft.id || '')),
        draftId: String(draft.id || ''),
        kind: 'my-property',
        mine: true,
        private: draft?.world?.public !== true,
        label: String(draft?.label || draft?.world?.publicLabel || 'My 3D Property').slice(0, 80),
        owner: 'You',
        handle: String(data?.handle || '').slice(0, 50),
        latitude,
        longitude,
        geometry: draft?.geometry || null,
        geometryKind: draft?.geometryKind || 'location-reference',
        fidelity: draft?.fidelity || 'location-reference',
        minted: draft?.blockchain?.minted === true,
        rightsVerified: draft?.legal?.titleVerified === true,
        purchasedDigitalCollectible: draft?.commerce?.kind === 'property_voxel_collectible' && draft?.commerce?.status === 'paid',
        priceCents: Number(draft?.commerce?.priceCents || 0) || null,
        modelUrl: draft?.visual?.modelUrl || null,
        thumbnailUrl: draft?.visual?.thumbnailUrl || null,
        worldPublic: draft?.world?.public === true,
        updatedAt: draft?.updatedAt || null,
      }];
    });
    items.sort((a: any, b: any) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    return NextResponse.json({
      ok: true,
      count: items.length,
      items,
      privacy: 'This authenticated My World feed is visible only to the signed-in account and can include exact saved coordinates. Public World remains a separate rounded opt-in feed.',
      rights: 'My World shows your digital models and purchase state. It does not treat a model, payment, or mint as proof of deed/title or real-property rights.',
    }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch (error) {
    return NextResponse.json({ ok: false, count: 0, items: [], error: error instanceof Error ? error.message : 'My World is unavailable.' }, { status: 503 });
  }
}
