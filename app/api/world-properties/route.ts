import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function finite(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function publicCoordinate(value: unknown) {
  const number = finite(value);
  return number === null ? null : Number(number.toFixed(3));
}

function shiftCoordinates(value: any, deltaLng: number, deltaLat: number): any {
  if (!Array.isArray(value)) return value;
  if (value.length >= 2 && typeof value[0] === 'number' && typeof value[1] === 'number') {
    return [Number((value[0] + deltaLng).toFixed(7)), Number((value[1] + deltaLat).toFixed(7)), ...value.slice(2)];
  }
  return value.map((child) => shiftCoordinates(child, deltaLng, deltaLat));
}

function shiftedGeometry(geometry: any, exactLat: number, exactLng: number, publicLat: number, publicLng: number) {
  if (!geometry || !Array.isArray(geometry.coordinates)) return null;
  return {
    ...geometry,
    coordinates: shiftCoordinates(geometry.coordinates, publicLng - exactLng, publicLat - exactLat),
  };
}

function publicId(userId: string, draftId: string) {
  return createHash('sha256').update(`voxel-vault-world-v1:${userId}:${draftId}`).digest('hex').slice(0, 24);
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('vault_profiles')
      .select('user_id,handle,display_name,avatar_style')
      .limit(500);
    if (error) throw error;

    const items: any[] = [];
    for (const profile of data || []) {
      const library = Array.isArray(profile?.avatar_style?.property_draft_library)
        ? profile.avatar_style.property_draft_library
        : [];
      for (const draft of library) {
        if (draft?.type !== 'voxel-vault-property-3d-draft' || draft?.world?.public !== true) continue;
        const exactLat = finite(draft?.coordinates?.latitude);
        const exactLng = finite(draft?.coordinates?.longitude);
        if (exactLat === null || exactLng === null) continue;
        const latitude = publicCoordinate(exactLat);
        const longitude = publicCoordinate(exactLng);
        if (latitude === null || longitude === null) continue;
        items.push({
          id: publicId(String(profile.user_id || ''), String(draft.id || '')),
          kind: 'community-property',
          label: String(draft?.world?.publicLabel || '3D Property').slice(0, 60),
          owner: String(profile?.display_name || profile?.handle || 'Voxel Vault member').slice(0, 50),
          handle: String(profile?.handle || '').slice(0, 50),
          latitude,
          longitude,
          geometry: shiftedGeometry(draft?.geometry, exactLat, exactLng, latitude, longitude),
          geometryKind: draft?.geometryKind || 'location-reference',
          fidelity: draft?.fidelity || 'location-reference',
          minted: draft?.blockchain?.minted === true,
          rightsVerified: draft?.legal?.titleVerified === true,
          publishedAt: draft?.world?.publishedAt || draft?.updatedAt || null,
        });
      }
    }

    items.sort((a, b) => String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')));
    return NextResponse.json({
      ok: true,
      count: items.length,
      items: items.slice(0, 300),
      privacy: 'Only properties explicitly shared to World are returned. Public coordinates are rounded and saved geometry is shifted to that rounded location so the private exact saved coordinate is not exposed by this feed.',
      rights: 'World shows opt-in 3D representations and verified-status labels only. A marker, model or mint does not itself prove deed/title or investment rights.',
    }, { headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=120' } });
  } catch (error) {
    console.error('World property feed unavailable', error);
    return NextResponse.json({ ok: false, count: 0, items: [], error: 'Public 3D property World is temporarily unavailable.' }, { status: 503 });
  }
}
