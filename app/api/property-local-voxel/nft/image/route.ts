import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { readCatalog3DByTask } from '../../../../../lib/catalog3dStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LOCAL_PROVIDER = 'voxelpop-local-webgl-v1';
const RECIPE_PREFIX = 'local-voxel-recipe-v1:';
const PRIVATE_KEY_RE = /^[a-fA-F0-9]{64}$/;

function clean(value: unknown, max = 18000) {
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

function hmac(value: string) {
  const key = secret();
  return key ? createHmac('sha256', key).update(value).digest('hex') : '';
}

function validSignature(expected: string, provided: string) {
  if (!expected || !/^[a-f0-9]{64}$/i.test(provided)) return false;
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(provided, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

function escapeXml(value: string) {
  return value.replace(/[<>&"']/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[char] || char));
}

function decodeRecipe(source: unknown) {
  const text = clean(source);
  if (!text.startsWith(RECIPE_PREFIX)) throw new Error('Local voxel recipe is unavailable.');
  const parsed = JSON.parse(Buffer.from(text.slice(RECIPE_PREFIX.length), 'base64url').toString('utf8'));
  const width = Math.trunc(Number(parsed?.width));
  const height = Math.trunc(Number(parsed?.height));
  const count = width * height;
  const colors = Array.isArray(parsed?.colors) ? parsed.colors.slice(0, count).map((value: unknown) => clean(value, 6).toLowerCase()) : [];
  const depths = Array.isArray(parsed?.depths) ? parsed.depths.slice(0, count).map((value: unknown) => Math.max(0, Math.min(9, Math.trunc(Number(value) || 0)))) : [];
  if (width < 8 || height < 8 || width > 32 || height > 24 || colors.length !== count || depths.length !== count) throw new Error('Local voxel recipe is invalid.');
  return { width, height, colors, depths };
}

function renderSvg(recipe: ReturnType<typeof decodeRecipe>) {
  const width = 960;
  const height = 720;
  const margin = 88;
  const cell = Math.min((width - margin * 2) / recipe.width, (height - margin * 2) / recipe.height);
  const gridWidth = cell * recipe.width;
  const gridHeight = cell * recipe.height;
  const originX = (width - gridWidth) / 2;
  const originY = (height - gridHeight) / 2 - 4;
  const blocks: string[] = [];

  for (let row = 0; row < recipe.height; row += 1) {
    for (let column = 0; column < recipe.width; column += 1) {
      const index = row * recipe.width + column;
      const depth = recipe.depths[index];
      if (depth <= 0) continue;
      const fill = /^[a-f0-9]{6}$/.test(recipe.colors[index]) ? `#${recipe.colors[index]}` : '#8264a3';
      const d = Math.max(2, (depth / 9) * cell * 0.42);
      const x = originX + column * cell;
      const y = originY + row * cell;
      const side = Math.max(1.5, d * 0.52);
      blocks.push(`<polygon points="${x + cell},${y} ${x + cell + side},${y - side} ${x + cell + side},${y + cell - side} ${x + cell},${y + cell}" fill="${fill}" opacity="0.66"/>`);
      blocks.push(`<polygon points="${x},${y} ${x + side},${y - side} ${x + cell + side},${y - side} ${x + cell},${y}" fill="#ffffff" opacity="0.17"/>`);
      blocks.push(`<rect x="${x}" y="${y}" width="${Math.max(1, cell - 0.7)}" height="${Math.max(1, cell - 0.7)}" rx="1.4" fill="${fill}"/>`);
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Reviewed VoxelPop property voxel">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2d2038"/><stop offset="0.58" stop-color="#17101d"/><stop offset="1" stop-color="#24152f"/></linearGradient>
    <radialGradient id="halo"><stop offset="0" stop-color="#c9ff54" stop-opacity=".18"/><stop offset="1" stop-color="#c9ff54" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="960" height="720" rx="42" fill="url(#bg)"/>
  <ellipse cx="480" cy="596" rx="340" ry="86" fill="url(#halo)"/>
  <g>${blocks.join('')}</g>
  <rect x="28" y="26" width="212" height="38" rx="19" fill="#17101d" fill-opacity=".78" stroke="#ffffff" stroke-opacity=".12"/>
  <text x="47" y="50" font-family="Arial, sans-serif" font-size="15" font-weight="700" letter-spacing="1.5" fill="#f5eff8">VOXELPOP · REVIEWED 3D</text>
  <text x="480" y="681" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="700" letter-spacing="1.2" fill="#d9cfe0">DIGITAL VOXEL · NOT A DEED OR PHYSICAL-PROPERTY RIGHT</text>
</svg>`;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const draftId = clean(url.searchParams.get('draftId'), 80);
    const taskId = clean(url.searchParams.get('taskId'), 160);
    const sig = clean(url.searchParams.get('sig'), 80);
    const expected = hmac(`local-property-image:${draftId}:${taskId}`);
    if (!draftId || !taskId.startsWith('local-v1:') || !validSignature(expected, sig)) {
      return NextResponse.json({ error: 'This VoxelPop image link is invalid.' }, { status: 403 });
    }

    const model = await readCatalog3DByTask(taskId);
    if (!model || model.provider !== LOCAL_PROVIDER || model.status !== 'SUCCEEDED' || !model.source_image_url) {
      return NextResponse.json({ error: 'This VoxelPop model is unavailable.' }, { status: 404 });
    }
    const svg = renderSvg(decodeRecipe(model.source_image_url));
    return new Response(svg, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
      },
    });
  } catch {
    return NextResponse.json({ error: 'This VoxelPop image could not be loaded.' }, { status: 500 });
  }
}
