import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../../lib/supabase-admin';
import { spatialMintSignatureValid } from '../../../../../lib/spatial-mint-server';

export const runtime = 'nodejs';
const BUCKET = process.env.SPATIAL_ASSET_BUCKET || 'assets-private';

function svgFallback(title: string) {
  const safe = String(title || 'VoxelVault Spatial').replace(/[<>&"']/g, '').slice(0, 60);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#07111f"/><stop offset="1" stop-color="#111827"/></linearGradient></defs><rect width="1200" height="1200" fill="url(#g)"/><g transform="translate(600 500) rotate(45)"><rect x="-150" y="-150" width="300" height="300" rx="38" fill="#172554" stroke="#67e8f9" stroke-width="14"/><rect x="-75" y="-75" width="150" height="150" rx="20" fill="#312e81" stroke="#a5f3fc" stroke-width="8"/></g><text x="600" y="880" text-anchor="middle" fill="#f8fafc" font-family="system-ui,sans-serif" font-weight="800" font-size="54">${safe}</text><text x="600" y="950" text-anchor="middle" fill="#67e8f9" font-family="monospace" font-size="28">VOXELVAULT SPATIAL</text></svg>`;
}

function decodeDataUrl(value: string) {
  const match = value.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/i);
  if (!match) return null;
  try { return { mime: match[1].toLowerCase(), bytes: Buffer.from(match[2], 'base64') }; }
  catch { return null; }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const assetId = url.searchParams.get('assetId') || '';
    const kind = url.searchParams.get('kind') === 'image' ? 'image' : 'model';
    const signature = url.searchParams.get('sig') || '';
    if (!/^[0-9a-f-]{36}$/i.test(assetId) || !spatialMintSignatureValid(assetId, signature, kind)) {
      return NextResponse.json({ error: 'Invalid spatial NFT media signature.' }, { status: 403 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: asset, error } = await supabaseAdmin
      .from('spatial_assets')
      .select('id,owner_user_id,title,source_kind,source_session_id,source_task_id,image_url,glb_storage_path,thumbnail_path')
      .eq('id', assetId)
      .maybeSingle();
    if (error) throw error;
    if (!asset) return NextResponse.json({ error: 'Spatial asset not found.' }, { status: 404 });

    if (kind === 'model') {
      if (asset.glb_storage_path) {
        const { data, error: storageError } = await supabaseAdmin.storage.from(BUCKET).download(asset.glb_storage_path);
        if (storageError || !data) throw storageError ?? new Error('Stored GLB unavailable.');
        return new NextResponse(data.stream(), { headers: { 'Content-Type': 'model/gltf-binary', 'Cache-Control': 'public, max-age=86400' } });
      }
      if (asset.source_kind === 'voxelpop' && asset.source_session_id && asset.source_task_id) {
        const upstream = await fetch(new URL(`/api/creator-pack/mesh?${new URLSearchParams({ sessionId: asset.source_session_id, taskId: asset.source_task_id, preview: '1' }).toString()}`, request.url), { cache: 'no-store' });
        if (!upstream.ok || !upstream.body) return NextResponse.json({ error: '3D model is not available.' }, { status: 502 });
        return new NextResponse(upstream.body, { headers: { 'Content-Type': 'model/gltf-binary', 'Cache-Control': 'public, max-age=3600' } });
      }
      return NextResponse.json({ error: '3D model is not available.' }, { status: 404 });
    }

    if (asset.thumbnail_path) {
      const { data, error: storageError } = await supabaseAdmin.storage.from(BUCKET).download(asset.thumbnail_path);
      if (!storageError && data) return new NextResponse(data.stream(), { headers: { 'Content-Type': data.type || 'image/webp', 'Cache-Control': 'public, max-age=86400' } });
    }

    const directData = decodeDataUrl(String(asset.image_url || ''));
    if (directData) return new NextResponse(directData.bytes, { headers: { 'Content-Type': directData.mime, 'Cache-Control': 'public, max-age=86400' } });
    if (/^https:\/\//i.test(String(asset.image_url || ''))) {
      const upstream = await fetch(asset.image_url, { cache: 'no-store' });
      if (upstream.ok && upstream.body) return new NextResponse(upstream.body, { headers: { 'Content-Type': upstream.headers.get('content-type') || 'image/webp', 'Cache-Control': 'public, max-age=3600' } });
    }

    if (asset.source_session_id) {
      const { data: profile } = await supabaseAdmin.from('vault_profiles').select('avatar_style').eq('user_id', asset.owner_user_id).maybeSingle();
      const library = Array.isArray(profile?.avatar_style?.voxelpop_library) ? profile.avatar_style.voxelpop_library : [];
      const record = library.find((item: any) => String(item?.sessionId || '') === asset.source_session_id);
      const decoded = decodeDataUrl(String(record?.payload?.asset?.dataUrl || ''));
      if (decoded) return new NextResponse(decoded.bytes, { headers: { 'Content-Type': decoded.mime, 'Cache-Control': 'public, max-age=86400' } });
    }

    return new NextResponse(svgFallback(asset.title), { headers: { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'public, max-age=86400' } });
  } catch (error) {
    console.error('spatial NFT media failed', error);
    return NextResponse.json({ error: 'Spatial NFT media is unavailable.' }, { status: 500 });
  }
}
