import { NextResponse } from 'next/server';
import { readCatalog3DByTask } from '../../../../lib/catalog3dStore';
import { normalizePropertyDraftId } from '../../../../lib/property-generation-ids';
import { propertyGenerationModelUrl } from '../../../../lib/property-generation-model';
import { verifyPropertyVoxelMetadataSignature } from '../../../../lib/property-voxel-mint';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LOCAL_PROVIDER = 'voxelpop-local-webgl-v1';
const RECIPE_PREFIX = 'local-voxel-recipe-v1:';

function clean(value: unknown, max = 300) { return String(value || '').trim().slice(0, max); }
function escapeXml(value: unknown) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}
function decodeRecipe(value: unknown) {
  const text = clean(value, 12000);
  if (!text.startsWith(RECIPE_PREFIX)) throw new Error('Local voxel recipe is unavailable.');
  const parsed = JSON.parse(Buffer.from(text.slice(RECIPE_PREFIX.length), 'base64url').toString('utf8'));
  const width = Math.trunc(Number(parsed?.width));
  const height = Math.trunc(Number(parsed?.height));
  const count = width * height;
  const colors = Array.isArray(parsed?.colors) ? parsed.colors.slice(0, count).map((item: unknown) => clean(item, 6).toLowerCase()) : [];
  const depths = Array.isArray(parsed?.depths) ? parsed.depths.slice(0, count).map((item: unknown) => Math.max(0, Math.min(9, Math.trunc(Number(item) || 0)))) : [];
  if (Number(parsed?.version) !== 1 || width < 8 || height < 8 || width > 24 || height > 24 || colors.length !== count || depths.length !== count) throw new Error('Local voxel recipe is invalid.');
  if (colors.some((entry: string) => !/^[a-f0-9]{6}$/.test(entry))) throw new Error('Local voxel colors are invalid.');
  return { width, height, colors, depths };
}
function localThumbnail(recipe: ReturnType<typeof decodeRecipe>, name: string) {
  const cell = 34;
  const artWidth = recipe.width * cell;
  const artHeight = recipe.height * cell;
  const offsetX = Math.round((1200 - artWidth) / 2);
  const offsetY = 170 + Math.round((760 - artHeight) / 2);
  const blocks: string[] = [];
  for (let row = 0; row < recipe.height; row += 1) {
    for (let column = 0; column < recipe.width; column += 1) {
      const index = row * recipe.width + column;
      const depth = recipe.depths[index];
      if (depth <= 0) continue;
      const x = offsetX + column * cell;
      const y = offsetY + row * cell;
      const lift = Math.round(depth * 1.4);
      blocks.push(`<rect x="${x}" y="${y - lift}" width="${cell - 2}" height="${cell - 2 + lift}" rx="3" fill="#${recipe.colors[index]}"/>`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
    <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#20172a"/><stop offset="1" stop-color="#473168"/></linearGradient></defs>
    <rect width="1200" height="1200" fill="url(#bg)"/>
    <circle cx="990" cy="190" r="140" fill="#c9ff54" opacity=".14"/>
    <g>${blocks.join('')}</g>
    <text x="70" y="86" fill="#c9ff54" font-family="Arial,sans-serif" font-size="25" font-weight="800" letter-spacing="6">VOXELPOP · PROPERTY VOXEL</text>
    <text x="70" y="1060" fill="#ffffff" font-family="Arial,sans-serif" font-size="62" font-weight="800">${escapeXml(name)}</text>
    <text x="70" y="1115" fill="#cfc4dc" font-family="Arial,sans-serif" font-size="23">PHOTO → VOXEL IMAGE → 3D VOXEL → DIGITAL NFT</text>
    <text x="70" y="1150" fill="#9286a0" font-family="Arial,sans-serif" font-size="18">DIGITAL COLLECTIBLE ONLY · NOT A DEED OR PHYSICAL-PROPERTY RIGHT</text>
  </svg>`;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const draftId = normalizePropertyDraftId(clean(url.searchParams.get('draftId'), 100));
    const taskId = clean(url.searchParams.get('taskId'), 420);
    const name = clean(url.searchParams.get('name'), 72) || 'VoxelPop Property';
    const sig = clean(url.searchParams.get('sig'), 128);
    if (!taskId || !verifyPropertyVoxelMetadataSignature(draftId, taskId, name, sig)) {
      return NextResponse.json({ error: 'Property voxel metadata is unavailable.' }, { status: 404 });
    }

    const model = await readCatalog3DByTask(taskId);
    if (!model || (!model.model_storage_path && !model.model_url && model.provider !== LOCAL_PROVIDER)) {
      return NextResponse.json({ error: 'Property voxel metadata is unavailable.' }, { status: 404 });
    }

    let image = '';
    let animationUrl = '';
    let engine = 'VoxelPop AI 3D';
    const local = model.provider === LOCAL_PROVIDER && taskId.startsWith('local-v1:');

    if (local) {
      if (!model.source_image_url) return NextResponse.json({ error: 'Property voxel metadata is unavailable.' }, { status: 404 });
      const svg = localThumbnail(decodeRecipe(model.source_image_url), name);
      image = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
      animationUrl = `${url.origin}/api/property-local-voxel?taskId=${encodeURIComponent(taskId)}`;
      engine = 'VoxelPop Local WebGL';
    } else {
      const apiKey = process.env.MESHY_API_KEY?.trim();
      if (!apiKey) return NextResponse.json({ error: 'Property voxel metadata is temporarily unavailable.' }, { status: 503 });
      const modelPath = propertyGenerationModelUrl(apiKey, taskId);
      if (!modelPath) return NextResponse.json({ error: 'Property voxel metadata is unavailable.' }, { status: 404 });
      const absoluteModel = new URL(modelPath, url.origin);
      const preview = new URL(absoluteModel);
      preview.searchParams.set('preview', '1');
      animationUrl = absoluteModel.toString();
      image = preview.toString();
    }

    return NextResponse.json({
      name: `${name} · VoxelPop`,
      description: 'A one-of-one VoxelPop digital property voxel created from an authorized house photo after confirming the property address. The NFT represents the finished digital 3D voxel only and does not convey deed/title, occupancy, rent, investment, appraisal, or other rights in physical real estate.',
      image,
      animation_url: animationUrl,
      external_url: `${url.origin}/property`,
      attributes: [
        { trait_type: 'Asset Type', value: 'VoxelPop Property Voxel' },
        { trait_type: 'Creation Flow', value: local ? 'Photo → Voxel → 3D' : 'Photo → Voxel Image → Generated 3D Voxel' },
        { trait_type: '3D Engine', value: engine },
        { trait_type: 'Property Identity', value: 'Address Confirmed' },
        { trait_type: 'Mint Limit', value: 'One per property' },
        { trait_type: 'Real Property Rights', value: 'None' },
        { trait_type: 'Deed / Title', value: 'None' },
      ],
      properties: {
        digital_only: true,
        one_property_one_mint: true,
        source_photo_in_metadata: false,
        real_property_rights: false,
        deed_or_title: false,
      },
    }, {
      headers: { 'Cache-Control': 'public, max-age=300, s-maxage=3600', 'X-Robots-Tag': 'noindex' },
    });
  } catch {
    return NextResponse.json({ error: 'Property voxel metadata is unavailable.' }, { status: 404 });
  }
}
