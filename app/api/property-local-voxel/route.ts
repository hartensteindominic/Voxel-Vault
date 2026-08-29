import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireVoxelVaultUser } from '../../../lib/user-auth';
import { readCatalog3DByTask } from '../../../lib/catalog3dStore';
import { saveLocalVoxelRecord } from '../../../lib/local-voxel-store';
import { normalizePropertyDraftId, propertyDraftItemId } from '../../../lib/property-generation-ids';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PROVIDER = 'voxelpop-local-webgl-v1';
const RECIPE_PREFIX = 'local-voxel-recipe-v1:';
const MAX_SIDE = 32;
const MIN_SIDE = 8;

function clean(value: unknown, max = 500) {
  return String(value || '').trim().slice(0, max);
}

function privateJson(body: unknown, init: ResponseInit = {}) {
  return NextResponse.json(body, {
    ...init,
    headers: { 'Cache-Control': 'private, no-store, max-age=0', ...(init.headers || {}) },
  });
}

type LocalVoxelRecipe = {
  version: 1;
  width: number;
  height: number;
  colors: string[];
  depths: number[];
};

function normalizeRecipe(input: any): LocalVoxelRecipe {
  const width = Math.trunc(Number(input?.width));
  const height = Math.trunc(Number(input?.height));
  if (Number(input?.version) !== 1 || width < MIN_SIDE || height < MIN_SIDE || width > MAX_SIDE || height > MAX_SIDE) {
    throw new Error('The local VoxelPop model recipe is invalid.');
  }
  const count = width * height;
  const colors = Array.isArray(input?.colors) ? input.colors.slice(0, count).map((value: unknown) => clean(value, 6).toLowerCase()) : [];
  const depths = Array.isArray(input?.depths) ? input.depths.slice(0, count).map((value: unknown) => Math.max(0, Math.min(9, Math.trunc(Number(value) || 0)))) : [];
  if (colors.length !== count || depths.length !== count || colors.some((value) => !/^[a-f0-9]{6}$/.test(value))) {
    throw new Error('The local VoxelPop model recipe is incomplete.');
  }
  if (!depths.some((value) => value > 0)) throw new Error('The local VoxelPop model does not contain visible building geometry.');
  return { version: 1, width, height, colors, depths };
}

function encodeRecipe(recipe: LocalVoxelRecipe) {
  return Buffer.from(JSON.stringify(recipe), 'utf8').toString('base64url');
}

function decodeRecipe(value: unknown) {
  const text = clean(value, 24000);
  if (!text.startsWith(RECIPE_PREFIX)) throw new Error('This is not a local VoxelPop model.');
  const encoded = text.slice(RECIPE_PREFIX.length);
  const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  return normalizeRecipe(parsed);
}

function hexRgb(value: string) {
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

function buildGltf(recipe: LocalVoxelRecipe) {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const width = recipe.width;
  const height = recipe.height;
  const cell = 6.55 / Math.max(width, height);
  const cubeSize = cell * 0.90;
  const half = cubeSize / 2;
  const maxDepth = Math.max(1, ...recipe.depths);
  const backZ = -(maxDepth * cubeSize) / 2;
  const faceIndices = [
    0, 2, 1, 0, 3, 2,
    4, 5, 6, 4, 6, 7,
    0, 4, 7, 0, 7, 3,
    1, 2, 6, 1, 6, 5,
    0, 1, 5, 0, 5, 4,
    3, 7, 6, 3, 6, 2,
  ];

  let vertexBase = 0;
  let xMin = Infinity;
  let xMax = -Infinity;
  let yMin = Infinity;
  let yMax = -Infinity;
  let zMin = Infinity;
  let zMax = -Infinity;

  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const index = row * width + column;
      if (recipe.depths[index] <= 0) continue;

      const depth = Math.max(1, Math.trunc(recipe.depths[index]));
      const [red, green, blue] = hexRgb(recipe.colors[index]);
      const x = (column - (width - 1) / 2) * cell;
      const y = ((height - 1) / 2 - row) * cell - 0.12;

      for (let layer = 0; layer < depth; layer += 1) {
        const z = backZ + cubeSize * (layer + 0.5);
        const layerShade = 0.68 + 0.32 * ((layer + 1) / depth);
        const shadedRed = Math.max(0, Math.min(255, Math.round(red * layerShade)));
        const shadedGreen = Math.max(0, Math.min(255, Math.round(green * layerShade)));
        const shadedBlue = Math.max(0, Math.min(255, Math.round(blue * layerShade)));

        positions.push(
          x - half, y - half, z - half,
          x + half, y - half, z - half,
          x + half, y + half, z - half,
          x - half, y + half, z - half,
          x - half, y - half, z + half,
          x + half, y - half, z + half,
          x + half, y + half, z + half,
          x - half, y + half, z + half,
        );
        for (let vertex = 0; vertex < 8; vertex += 1) colors.push(shadedRed, shadedGreen, shadedBlue);
        for (const faceIndex of faceIndices) indices.push(vertexBase + faceIndex);
        vertexBase += 8;

        xMin = Math.min(xMin, x - half);
        xMax = Math.max(xMax, x + half);
        yMin = Math.min(yMin, y - half);
        yMax = Math.max(yMax, y + half);
        zMin = Math.min(zMin, z - half);
        zMax = Math.max(zMax, z + half);
      }
    }
  }

  if (!vertexBase) throw new Error('The local VoxelPop model does not contain visible building geometry.');

  const positionArray = new Float32Array(positions);
  const colorArray = Uint8Array.from(colors);
  const useUint32 = vertexBase > 65535;
  const indexArray = useUint32 ? new Uint32Array(indices) : new Uint16Array(indices);
  const indexComponentType = useUint32 ? 5125 : 5123;
  const positionBuffer = Buffer.from(positionArray.buffer);
  const colorBuffer = Buffer.from(colorArray.buffer);
  const padding = Buffer.alloc((4 - ((positionBuffer.length + colorBuffer.length) % 4)) % 4);
  const indexOffset = positionBuffer.length + colorBuffer.length + padding.length;
  const indexBuffer = Buffer.from(indexArray.buffer);
  const binary = Buffer.concat([positionBuffer, colorBuffer, padding, indexBuffer]);
  const uri = `data:application/octet-stream;base64,${binary.toString('base64')}`;

  return {
    asset: { version: '2.0', generator: 'VoxelPop stacked voxel volume v2' },
    extensionsUsed: ['KHR_materials_unlit'],
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: 'VoxelPop stacked property voxel' }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, COLOR_0: 1 }, indices: 2, material: 0, mode: 4 }] }],
    materials: [{
      name: 'Photo-matched stacked voxel colors',
      pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 1 },
      extensions: { KHR_materials_unlit: {} },
      doubleSided: true,
    }],
    buffers: [{ byteLength: binary.length, uri }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: positionBuffer.length, target: 34962 },
      { buffer: 0, byteOffset: positionBuffer.length, byteLength: colorBuffer.length, target: 34962 },
      { buffer: 0, byteOffset: indexOffset, byteLength: indexBuffer.length, target: 34963 },
    ],
    accessors: [
      {
        bufferView: 0,
        byteOffset: 0,
        componentType: 5126,
        count: positionArray.length / 3,
        type: 'VEC3',
        min: [xMin, yMin, zMin],
        max: [xMax, yMax, zMax],
      },
      { bufferView: 1, byteOffset: 0, componentType: 5121, normalized: true, count: colorArray.length / 3, type: 'VEC3' },
      { bufferView: 2, byteOffset: 0, componentType: indexComponentType, count: indexArray.length, type: 'SCALAR' },
    ],
  };
}

export async function POST(request: Request) {
  const auth = await requireVoxelVaultUser(request);
  if (auth.ok === false) return privateJson({ ok: false, error: auth.error }, { status: auth.status });

  try {
    const body = await request.json().catch(() => ({}));
    const draftId = normalizePropertyDraftId(body?.draftId);
    const recipe = normalizeRecipe(body?.recipe);
    const encodedRecipe = encodeRecipe(recipe);
    const digest = createHash('sha256')
      .update(`voxelpop-local-v1:${auth.user.id}:${draftId}:${encodedRecipe}`)
      .digest('hex');
    const taskId = `local-v1:${digest.slice(0, 48)}`;
    const itemId = propertyDraftItemId(auth.user.id, draftId, 'voxel');
    const modelUrl = new URL(`/api/property-local-voxel?taskId=${encodeURIComponent(taskId)}`, request.url).toString();
    const now = new Date().toISOString();
    const saved = await saveLocalVoxelRecord(itemId, {
      task_id: taskId,
      source_image_url: `${RECIPE_PREFIX}${encodedRecipe}`,
      model_url: modelUrl,
      thumbnail_url: null,
      provider: PROVIDER,
      status: 'SUCCEEDED',
      progress: 100,
      exact_model_approved: false,
      error: null,
      started_at: now,
      completed_at: now,
    });

    return privateJson({
      ok: true,
      engine: PROVIDER,
      taskId,
      modelUrl: saved?.model_url || null,
      persisted: Boolean(saved?.task_id),
      collectionReady: Boolean(saved?.task_id && saved?.model_url),
      note: saved?.task_id
        ? 'The stacked-cube silhouette-aware voxel recipe is account-bound in the catalog. The original source photo was not uploaded for generation.'
        : 'The stacked-cube local 3D preview is ready on this device, but durable catalog persistence is unavailable. The user can still continue to map and save locally.',
    });
  } catch (error) {
    return privateJson({ ok: false, error: error instanceof Error ? error.message : 'Local VoxelPop model could not be registered.' }, { status: 400 });
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const taskId = clean(url.searchParams.get('taskId'), 160);
    if (!taskId.startsWith('local-v1:')) throw new Error('A valid local VoxelPop model ID is required.');
    const saved = await readCatalog3DByTask(taskId);
    if (!saved || saved.provider !== PROVIDER || !saved.source_image_url) throw new Error('The local VoxelPop model is unavailable.');
    const recipe = decodeRecipe(saved.source_image_url);
    return new Response(JSON.stringify(buildGltf(recipe)), {
      status: 200,
      headers: {
        'Content-Type': 'model/gltf+json; charset=utf-8',
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Local VoxelPop model is unavailable.' }, { status: 404 });
  }
}
