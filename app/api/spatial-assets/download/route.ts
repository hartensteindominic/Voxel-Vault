import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';

export const runtime = 'nodejs';
const BUCKET = process.env.SPATIAL_ASSET_BUCKET || 'assets-private';

export async function POST(request: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const auth = request.headers.get('authorization');
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const assetId = String(body?.assetId || '');
    if (!/^[0-9a-f-]{36}$/i.test(assetId)) return NextResponse.json({ error: 'Valid asset id required.' }, { status: 400 });

    const { data: asset, error } = await supabaseAdmin
      .from('spatial_assets')
      .select('id,title,source_kind,source_session_id,source_task_id,glb_storage_path')
      .eq('id', assetId)
      .eq('owner_user_id', user.id)
      .maybeSingle();
    if (error) throw error;
    if (!asset) return NextResponse.json({ error: 'Asset not found.' }, { status: 404 });

    if (asset.glb_storage_path) {
      const filename = `${String(asset.title || 'voxelvault-model').replace(/[^a-z0-9_-]+/gi, '-').slice(0, 70) || 'voxelvault-model'}.glb`;
      const { data, error: signedError } = await supabaseAdmin.storage
        .from(BUCKET)
        .createSignedUrl(asset.glb_storage_path, 60, { download: filename });
      if (signedError || !data?.signedUrl) throw signedError ?? new Error('Signed download failed.');
      return NextResponse.json({ url: data.signedUrl, expiresIn: 60 });
    }

    if (asset.source_kind === 'voxelpop' && asset.source_session_id && asset.source_task_id) {
      const url = `/api/creator-pack/mesh?${new URLSearchParams({
        sessionId: asset.source_session_id,
        taskId: asset.source_task_id,
        download: '1',
      }).toString()}`;
      return NextResponse.json({ url, expiresIn: null });
    }

    return NextResponse.json({ error: 'This asset does not have a downloadable GLB yet.' }, { status: 409 });
  } catch (error) {
    console.error('spatial asset download failed', error);
    return NextResponse.json({ error: 'Unable to authorize this model download.' }, { status: 500 });
  }
}
