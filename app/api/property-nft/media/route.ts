import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { readCatalog3DByTask } from '../../../../lib/catalog3dStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PRIVATE_KEY_RE = /^[a-fA-F0-9]{64}$/;
const RECIPE_PREFIX = 'local-voxel-recipe-v1:';

function clean(value: unknown, max = 500) {
  return String(value || '').trim().slice(0, max);
}
function normalizePrivateKey(value: string) {
  const trimmed = value.trim();
  if (PRIVATE_KEY_RE.test(trimmed)) return `0x${trimmed}`;
  if (/^0X[a-fA-F0-9]{64}$/.test(trimmed)) return `0x${trimmed.slice(2)}`;
  return trimmed;
}
function secret() {
  const raw = process.env.VOXELFLIP_MINT_SIGNER_PRIVATE_KEY?.trim() || '';
  return raw ? normalizePrivateKey(raw) : '';
}
function hmacHex(value: string) {
  const key = secret();
  return key ? createHmac('sha256', key).update(value).digest('hex') : '';
}
function validSignature(actual: string, expected: string) {
  if (!/^[a-f0-9]{64}$/i.test(actual) || !/^[a-f0-9]{64}$/i.test(expected)) return false;
  return timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
}
function decodeRecipe(value: unknown) {
  const text = clean(value, 40_000);
  if (!text.startsWith(RECIPE_PREFIX)) throw new Error('This property voxel recipe is unavailable.');
  return JSON.parse(Buffer.from(text.slice(RECIPE_PREFIX.length), 'base64url').toString('utf8'));
}
function svgPreview(recipe: any) {
  const width = Math.max(1, Math.trunc(Number(recipe?.width) || 1));
  const height = Math.max(1, Math.trunc(Number(recipe?.height) || 1));
  const colors = Array.isArray(recipe?.colors) ? recipe.colors : [];
  const depths = Array.isArray(recipe?.depths) ? recipe.depths : [];
  const cell = 18;
  const pad = 42;
  const artWidth = width * cell;
  const artHeight = height * cell;
  const canvasWidth = artWidth + pad * 2;
  const canvasHeight = artHeight + pad * 2;
  const rects: string[] = [];
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const index = row * width + column;
      if (Number(depths[index] || 0) <= 0) continue;
      const hex = /^[a-f0-9]{6}$/i.test(String(colors[index] || '')) ? `#${colors[index]}` : '#8b73c9';
      const x = pad + column * cell;
      const y = pad + row * cell;
      rects.push(`<rect x="${x}" y="${y}" width="${cell - 1}" height="${cell - 1}" rx="2" fill="${hex}"/>`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}"><defs><radialGradient id="bg" cx="50%" cy="35%" r="75%"><stop offset="0" stop-color="#47335b"/><stop offset="1" stop-color="#18101f"/></radialGradient></defs><rect width="100%" height="100%" rx="34" fill="url(#bg)"/><ellipse cx="${canvasWidth / 2}" cy="${canvasHeight - 25}" rx="${Math.max(70, artWidth * 0.38)}" ry="12" fill="#0c0810" opacity=".35"/><g>${rects.join('')}</g><text x="${canvasWidth / 2}" y="25" fill="#c9ff54" text-anchor="middle" font-family="Arial,sans-serif" font-size="12" font-weight="700" letter-spacing="2">VOXELPOP PROPERTY</text></svg>`;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const taskId = clean(url.searchParams.get('taskId'), 180);
    const draftId = clean(url.searchParams.get('draftId'), 100);
    const kind = url.searchParams.get('kind') === 'image' ? 'image' : 'model';
    const sig = clean(url.searchParams.get('sig'), 80);
    const expected = hmacHex(`property-media:${taskId}|${draftId}|${kind}`);
    if (!taskId.startsWith('local-v1:') || !draftId || !validSignature(sig, expected)) {
      return NextResponse.json({ error: 'Invalid property voxel media link.' }, { status: 403 });
    }

    const saved = await readCatalog3DByTask(taskId);
    if (!saved || saved.status !== 'SUCCEEDED' || saved.provider !== 'voxelpop-local-webgl-v1' || !String(saved.item_id || '').endsWith(`:${draftId}:voxel`)) {
      return NextResponse.json({ error: 'Property voxel media is unavailable.' }, { status: 404 });
    }

    if (kind === 'image') {
      const svg = svgPreview(decodeRecipe(saved.source_image_url));
      return new Response(svg, {
        status: 200,
        headers: {
          'Content-Type': 'image/svg+xml; charset=utf-8',
          'Cache-Control': 'public, max-age=86400, s-maxage=86400',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }

    const modelUrl = new URL(`/api/property-local-voxel?taskId=${encodeURIComponent(taskId)}`, url.origin);
    const modelResponse = await fetch(modelUrl, { cache: 'no-store' });
    if (!modelResponse.ok || !modelResponse.body) return NextResponse.json({ error: 'Property voxel model could not be loaded.' }, { status: 502 });
    return new NextResponse(modelResponse.body, {
      status: 200,
      headers: {
        'Content-Type': modelResponse.headers.get('content-type') || 'model/gltf+json; charset=utf-8',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
        'Content-Disposition': 'inline; filename="voxelpop-property.gltf"',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Property voxel media is unavailable.' }, { status: 404 });
  }
}
