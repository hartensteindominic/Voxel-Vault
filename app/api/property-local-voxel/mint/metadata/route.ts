import { NextResponse } from 'next/server';
import { readCatalog3DByTask } from '../../../../../lib/catalog3dStore';
import { normalizePropertyDraftId } from '../../../../../lib/property-generation-ids';
import { verifyPropertyLocalMetadataSignature } from '../../../../../lib/property-local-mint';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RECIPE_PREFIX = 'local-voxel-recipe-v1:';

function clean(value: unknown, max = 180) {
  return String(value || '').trim().slice(0, max);
}

function decodeRecipe(value: unknown) {
  const text = clean(value, 16000);
  if (!text.startsWith(RECIPE_PREFIX)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(text.slice(RECIPE_PREFIX.length), 'base64url').toString('utf8'));
    const width = Math.trunc(Number(parsed?.width));
    const height = Math.trunc(Number(parsed?.height));
    const count = width * height;
    if (Number(parsed?.version) !== 1 || width < 8 || height < 8 || width > 24 || height > 24) return null;
    if (!Array.isArray(parsed?.colors) || !Array.isArray(parsed?.depths) || parsed.colors.length !== count || parsed.depths.length !== count) return null;
    const colors = parsed.colors.map((item: unknown) => clean(item, 6).toLowerCase());
    const depths = parsed.depths.map((item: unknown) => Math.max(0, Math.min(9, Math.trunc(Number(item) || 0))));
    if (colors.some((item: string) => !/^[a-f0-9]{6}$/.test(item))) return null;
    return { width, height, colors, depths };
  } catch {
    return null;
  }
}

function voxelSvgDataUrl(recipe: any) {
  if (!recipe) return '';
  const cell = 18;
  const width = recipe.width * cell;
  const height = recipe.height * cell;
  const rects: string[] = [];
  for (let row = 0; row < recipe.height; row += 1) {
    for (let column = 0; column < recipe.width; column += 1) {
      const index = row * recipe.width + column;
      if (recipe.depths[index] <= 0) continue;
      const depth = recipe.depths[index];
      const inset = Math.max(0, Math.min(2.2, (9 - depth) * 0.16));
      rects.push(`<rect x="${column * cell + inset}" y="${row * cell + inset}" width="${cell - inset * 2}" height="${cell - inset * 2}" rx="2" fill="#${recipe.colors[index]}"/>`);
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#18101f"/><g>${rects.join('')}</g></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const taskId = clean(url.searchParams.get('taskId'), 180);
    const draftId = normalizePropertyDraftId(url.searchParams.get('draftId'));
    const name = clean(url.searchParams.get('name'), 90) || 'VoxelPop Property';
    const sig = clean(url.searchParams.get('sig'), 128);
    if (!taskId.startsWith('local-v1:') || !verifyPropertyLocalMetadataSignature(taskId, draftId, name, sig)) {
      return NextResponse.json({ error: 'Property voxel metadata link is invalid.' }, { status: 403 });
    }

    const model = await readCatalog3DByTask(taskId);
    if (!model || model.status !== 'SUCCEEDED' || !String(model.provider || '').startsWith('voxelpop-local-webgl')) {
      return NextResponse.json({ error: 'This property voxel model is unavailable.' }, { status: 404 });
    }
    if (!String(model.item_id || '').endsWith(`:${draftId}:voxel`)) {
      return NextResponse.json({ error: 'This property voxel does not match the signed creation.' }, { status: 403 });
    }

    const recipe = decodeRecipe(model.source_image_url);
    const modelUrl = new URL(`/api/property-local-voxel?taskId=${encodeURIComponent(taskId)}`, request.url).toString();
    return NextResponse.json({
      name: `${name} · VoxelFlip`,
      description: 'A photo-derived VoxelPop 3D voxel created from an approved property image. This NFT records the digital voxel asset only; it is not a deed, title record, rent right, investment interest, or ownership claim in the physical property.',
      image: voxelSvgDataUrl(recipe) || undefined,
      animation_url: modelUrl,
      external_url: new URL('/property', request.url).toString(),
      attributes: [
        { trait_type: 'Asset type', value: 'VoxelPop Property Voxel' },
        { trait_type: '3D engine', value: 'VoxelPop local WebGL' },
        { trait_type: 'Source photo storage', value: 'Device only' },
        { trait_type: 'Physical property rights', value: 'None' },
      ],
      properties: {
        draftId,
        taskId,
        modelFormat: 'glTF',
        sourcePhotoStoredByVoxelVault: false,
      },
    }, {
      headers: {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
        'Access-Control-Allow-Origin': '*',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Property voxel metadata is unavailable.' }, { status: 400 });
  }
}
