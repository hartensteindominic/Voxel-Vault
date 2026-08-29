import { NextResponse } from 'next/server';
import { readCatalog3DByTask } from '../../../../../../lib/catalog3dStore';
import { normalizePropertyDraftId } from '../../../../../../lib/property-generation-ids';
import { verifyPropertyVoxelMetadataSignature } from '../../../../../../lib/property-voxel-mint';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LOCAL_PROVIDER = 'voxelpop-local-webgl-v1';

function shortId(value: string) {
  const text = String(value || '').replace(/[^a-z0-9]/gi, '');
  return text.slice(-8).toUpperCase() || 'PROPERTY';
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const draftId = normalizePropertyDraftId(url.searchParams.get('draftId'));
    const taskId = String(url.searchParams.get('taskId') || '').trim().slice(0, 180);
    const sig = String(url.searchParams.get('sig') || '').trim();
    if (!taskId || !verifyPropertyVoxelMetadataSignature(draftId, taskId, sig)) {
      return NextResponse.json({ error: 'This VoxelPop property metadata link is invalid.' }, { status: 403 });
    }

    const saved = await readCatalog3DByTask(taskId);
    if (!saved || saved.provider !== LOCAL_PROVIDER || !saved.model_url) {
      return NextResponse.json({ error: 'This VoxelPop property voxel is unavailable.' }, { status: 404 });
    }

    const modelUrl = new URL(`/api/property-local-voxel?taskId=${encodeURIComponent(taskId)}`, request.url).toString();
    const imageUrl = new URL('/voxelpop/voxelpop-logo.png', request.url).toString();
    const externalUrl = new URL('/vault/property-drafts', request.url).toString();

    return NextResponse.json({
      name: `VoxelPop Property · ${shortId(draftId)}`,
      description: 'A user-approved digital VoxelPop 3D voxel created locally from an authorized property photo. The source photo is not included in this NFT. This token represents the digital voxel only and is not a deed, title record, property share, lease, rent right, or investment security.',
      image: imageUrl,
      animation_url: modelUrl,
      external_url: externalUrl,
      attributes: [
        { trait_type: 'Asset type', value: 'VoxelPop Property 3D' },
        { trait_type: '3D engine', value: 'VoxelPop Local WebGL' },
        { trait_type: 'Source photo storage', value: 'Device-local / not in NFT' },
        { trait_type: 'Blockchain meaning', value: 'Digital voxel only' },
      ],
      properties: {
        format: 'model/gltf+json',
        model_url: modelUrl,
        creation_id: draftId,
        local_task_id: taskId,
        source_photo_included: false,
        real_property_rights: false,
      },
    }, {
      headers: {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Property voxel metadata is unavailable.' }, { status: 400 });
  }
}
