import { NextResponse } from 'next/server';
import { cjProductImages, getCjProductBySku } from '../../../lib/cjApi';

export const runtime = 'nodejs';

const MESHY_ENDPOINT = 'https://api.meshy.ai/openapi/v1/image-to-3d';
const MAX_TEXTURE_PROMPT = 760;

function buildPrompt(item = {}) {
  const name = [item.name, item.type].filter(Boolean).join(' / ') || 'the product';
  const material = item.material ? `Material: ${item.material}.` : '';
  const prompt = [
    `Photorealistic review model of the exact physical product in the reference image: ${name}.`,
    material,
    'Match silhouette, proportions, openings, controls, hardware, colors and visible construction.',
    'Do not redesign, stylize, simplify, invent logos, accessories, controls, patterns or geometry.',
    'Keep real-world scale, clean geometry and realistic PBR materials. Match the reference image as closely as possible.'
  ].filter(Boolean).join(' ');
  return prompt.slice(0, MAX_TEXTURE_PROMPT);
}

function isPlaceholderImage(url = '') { return /unsplash\.com/i.test(url); }
function isHttpUrl(value = '') { try { const url = new URL(value); return url.protocol === 'http:' || url.protocol === 'https:'; } catch { return false; } }

async function scrapeProductImage(sourceUrl) {
  if (!isHttpUrl(sourceUrl)) return '';
  try {
    const response = await fetch(sourceUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VoxelVaultProductResolver/1.0)' }, cache: 'no-store' });
    if (!response.ok) return '';
    const html = await response.text();
    const patterns = [
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
      /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
    ];
    for (const pattern of patterns) { const match = html.match(pattern); if (match?.[1]) { try { return new URL(match[1], sourceUrl).toString(); } catch {} } }
  } catch {}
  return '';
}

async function resolveProductImage(imageUrl, item) {
  if (imageUrl && !isPlaceholderImage(imageUrl)) return imageUrl;
  if (item?.supplierSku) {
    try {
      const product = await getCjProductBySku(item.supplierSku);
      const images = cjProductImages(product);
      if (images[0]) return images[0];
    } catch {}
  }
  return scrapeProductImage(item?.sourceUrl || '');
}

export async function POST(request) {
  const apiKey = process.env.MESHY_API_KEY;
  if (!apiKey) return NextResponse.json({ configured: false, error: 'Image-to-3D generation is not configured. Add MESHY_API_KEY to Vercel Production.' }, { status: 503 });
  try {
    const body = await request.json();
    const item = body?.item && typeof body.item === 'object' ? body.item : {};
    const requestedImageUrl = typeof body?.imageUrl === 'string' ? body.imageUrl.trim() : '';
    const imageUrl = await resolveProductImage(requestedImageUrl, item);
    if (!isHttpUrl(imageUrl)) return NextResponse.json({ error: 'A public CJ product image could not be resolved. Confirm CJ_API_KEY and the supplier SKU.' }, { status: 400 });
    const texturePrompt = buildPrompt(item);
    const response = await fetch(MESHY_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: imageUrl, model_type: 'standard', ai_model: 'latest', ultra_mode: true, image_enhancement: true, remove_lighting: true, should_texture: true, enable_pbr: true, texture_resolution: '4k', texture_image_url: imageUrl, texture_prompt: texturePrompt, target_formats: ['glb'], auto_size: true, origin_at: 'bottom', multi_view_thumbnails: true }),
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json({ error: data?.message || data?.error || data?.task_error?.message || 'Image-to-3D provider rejected the request.' }, { status: response.status });
    return NextResponse.json({ configured: true, sourceImageUrl: imageUrl, taskId: data?.result || data?.id || null, promptLength: texturePrompt.length });
  } catch (error) { return NextResponse.json({ error: error?.message || 'Image-to-3D request failed.' }, { status: 500 }); }
}

export async function GET(request) {
  const apiKey = process.env.MESHY_API_KEY;
  const taskId = new URL(request.url).searchParams.get('taskId');
  if (!apiKey) return NextResponse.json({ configured: false, error: 'Image-to-3D generation is not configured.' }, { status: 503 });
  if (!taskId) return NextResponse.json({ error: 'taskId is required.' }, { status: 400 });
  try {
    const response = await fetch(`${MESHY_ENDPOINT}/${encodeURIComponent(taskId)}`, { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json({ error: data?.message || data?.error || data?.task_error?.message || 'Unable to read 3D generation status.' }, { status: response.status });
    return NextResponse.json({ configured: true, status: data?.status || 'PENDING', progress: data?.progress ?? 0, modelUrl: data?.model_urls?.glb || null, thumbnailUrl: data?.thumbnail_url || null, thumbnailUrls: data?.thumbnail_urls || null, error: data?.task_error?.message || null });
  } catch (error) { return NextResponse.json({ error: error?.message || '3D generation status request failed.' }, { status: 500 }); }
}
