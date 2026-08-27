import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../../lib/supabase-admin';
import { spatialMintMediaSignature, spatialMintSignatureValid } from '../../../../../lib/spatial-mint-server';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const assetId = url.searchParams.get('assetId') || '';
    const signature = url.searchParams.get('sig') || '';
    if (!/^[0-9a-f-]{36}$/i.test(assetId) || !spatialMintSignatureValid(assetId, signature)) {
      return NextResponse.json({ error: 'Invalid spatial NFT metadata signature.' }, { status: 403 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: asset, error } = await supabaseAdmin
      .from('spatial_assets')
      .select('id,title,description,prompt,source_kind,source_session_id,source_task_id,glb_storage_path,thumbnail_path,image_url,state,chain_id,contract_address,token_id,audit_hash')
      .eq('id', assetId)
      .maybeSingle();
    if (error) throw error;
    if (!asset) return NextResponse.json({ error: 'Spatial asset not found.' }, { status: 404 });
    if (!asset.glb_storage_path && !(asset.source_kind === 'voxelpop' && asset.source_session_id && asset.source_task_id)) {
      return NextResponse.json({ error: 'Spatial asset has no finished 3D model.' }, { status: 409 });
    }

    const origin = url.origin;
    const modelUrl = `${origin}/api/spatial-assets/mint/media?${new URLSearchParams({ assetId, kind: 'model', sig: spatialMintMediaSignature(assetId, 'model') }).toString()}`;
    const imageUrl = `${origin}/api/spatial-assets/mint/media?${new URLSearchParams({ assetId, kind: 'image', sig: spatialMintMediaSignature(assetId, 'image') }).toString()}`;
    const description = String(asset.description || asset.prompt || 'A 3D voxel creation minted through VoxelVault Spatial.').slice(0, 1000);

    return NextResponse.json({
      name: String(asset.title || 'VoxelVault Spatial Asset').slice(0, 120),
      description,
      image: imageUrl,
      animation_url: modelUrl,
      external_url: `${origin}/vault/space?asset=${encodeURIComponent(assetId)}`,
      attributes: [
        { trait_type: 'Source', value: asset.source_kind },
        { trait_type: 'Format', value: 'GLB' },
        { trait_type: 'Spatial Wallet', value: 'VoxelVault' },
        ...(asset.audit_hash ? [{ trait_type: 'Audit Hash', value: asset.audit_hash }] : []),
      ],
      properties: {
        asset_id: asset.id,
        model_format: 'model/gltf-binary',
        files: [{ uri: modelUrl, type: 'model/gltf-binary' }],
      },
    }, { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600' } });
  } catch (error) {
    console.error('spatial NFT metadata failed', error);
    return NextResponse.json({ error: 'Spatial NFT metadata is unavailable.' }, { status: 500 });
  }
}
