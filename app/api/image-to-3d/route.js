import { NextResponse } from 'next/server';
import { cjProductImages, getCjProductBySku } from '../../../lib/cjApi';
import { readCatalog3D, readCatalog3DByTask, saveCatalog3D } from '../../../lib/catalog3dStore';

export const runtime = 'nodejs';

const MESHY_ENDPOINT = 'https://api.meshy.ai/openapi/v1/image-to-3d';
const MAX_TEXTURE_PROMPT = 700;

function buildPrompt(item = {}) {
  const name = [item.name, item.type].filter(Boolean).join(' / ') || 'the product';
  const material = item.material ? `Material: ${item.material}.` : '';
  return [
    `Reconstruct the exact physical product shown in the reference image: ${name}.`,
    material,
    'Preserve silhouette, proportions, openings, controls, hardware, colors, visible seams and construction.',
    'Do not redesign, stylize, simplify, add accessories, invent controls, logos, patterns or geometry.',
    'Favor geometric fidelity to the reference over artistic interpretation. Use realistic PBR materials and real-world scale.'
  ].filter(Boolean).join(' ').slice(0, MAX_TEXTURE_PROMPT);
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
  if (!apiKey) return NextResponse.json({ configured: false, error: 'Model generation is not configured.' }, { status: 503 });
  try {
    const body = await request.json();
    const item = body?.item && typeof body.item === 'object' ? body.item : {};
    const itemId = String(item?.id || body?.itemId || '').trim();
    if (itemId) {
      const saved = await readCatalog3D(itemId);
      if (saved?.model_url) return NextResponse.json({ configured: true, reused: true, modelUrl: saved.model_url, taskId: saved.task_id || null, progress: 100 });
      if (saved?.task_id && ['PENDING','IN_PROGRESS'].includes(String(saved.status || '').toUpperCase())) return NextResponse.json({ configured: true, reused: true, taskId: saved.task_id, progress: saved.progress || 0 });
    }
    const requestedImageUrl = typeof body?.imageUrl === 'string' ? body.imageUrl.trim() : '';
    const imageUrl = await resolveProductImage(requestedImageUrl, item);
    if (!isHttpUrl(imageUrl)) return NextResponse.json({ error: 'A public CJ product image could not be resolved.' }, { status: 400 });
    const texturePrompt = buildPrompt(item);
    const response = await fetch(MESHY_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: imageUrl, model_type: 'standard', ai_model: 'latest', ultra_mode: true, image_enhancement: true, remove_lighting: true, should_texture: true, enable_pbr: true, texture_resolution: '2k', texture_image_url: imageUrl, texture_prompt: texturePrompt, target_formats: ['glb'], auto_size: true, origin_at: 'bottom', multi_view_thumbnails: true }),
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json({ error: data?.message || data?.error || data?.task_error?.message || 'Model provider rejected the request.' }, { status: response.status });
    const taskId = data?.result || data?.id || null;
    if (itemId && taskId) await saveCatalog3D(itemId, { supplier_sku: item?.supplierSku || null, task_id: taskId, source_image_url: imageUrl, status: 'PENDING', progress: 0, started_at: new Date().toISOString(), error: null });
    return NextResponse.json({ configured: true, sourceImageUrl: imageUrl, taskId, promptLength: texturePrompt.length });
  } catch (error) { return NextResponse.json({ error: error?.message || 'Model request failed.' }, { status: 500 }); }
}

export async function GET(request) {
  const apiKey = process.env.MESHY_API_KEY;
  const taskId = new URL(request.url).searchParams.get('taskId');
  if (!apiKey) return NextResponse.json({ configured: false, error: 'Model generation is not configured.' }, { status: 503 });
  if (!taskId) return NextResponse.json({ error: 'taskId is required.' }, { status: 400 });
  try {
    const response = await fetch(`${MESHY_ENDPOINT}/${encodeURIComponent(taskId)}`, { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json({ error: data?.message || data?.error || data?.task_error?.message || 'Unable to read model generation status.' }, { status: response.status });
    const status = data?.status || 'PENDING';
    const progress = Number(data?.progress ?? 0);
    const modelUrl = data?.model_urls?.glb || null;
    const thumbnailUrl = data?.thumbnail_url || null;
    const saved = await readCatalog3DByTask(taskId);
    if (saved?.item_id) await saveCatalog3D(saved.item_id, { task_id: taskId, status, progress, model_url: modelUrl || saved.model_url || null, thumbnail_url: thumbnailUrl || saved.thumbnail_url || null, completed_at: modelUrl ? new Date().toISOString() : saved.completed_at || null, error: data?.task_error?.message || null });
    return NextResponse.json({ configured: true, status, progress, modelUrl, thumbnailUrl, thumbnailUrls: data?.thumbnail_urls || null, error: data?.task_error?.message || null });
  } catch (error) { return NextResponse.json({ error: error?.message || 'Model generation status request failed.' }, { status: 500 }); }
}
