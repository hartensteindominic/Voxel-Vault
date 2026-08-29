import { NextResponse } from 'next/server';
import { cjProductImages, getCjProductBySku } from '../../../lib/cjApi';
import { persistModelBinary, readCatalog3D, readCatalog3DByTask, saveCatalog3D } from '../../../lib/catalog3dStore';
import { REAL_WORLD_CATALOG } from '../../../lib/realWorldCatalog';

export const runtime = 'nodejs';
export const maxDuration = 60;

const IMAGE_ENDPOINT = 'https://api.meshy.ai/openapi/v1/image-to-3d';
const MULTI_IMAGE_ENDPOINT = 'https://api.meshy.ai/openapi/v1/multi-image-to-3d';
const MAX_TEXTURE_PROMPT = 560;

function authorized(request) {
  const secret = String(process.env.CRON_SECRET || '').trim();
  return Boolean(secret && request.headers.get('authorization') === `Bearer ${secret}`);
}

function trustedCatalogItem(body = {}) {
  const requestedId = String(body?.item?.id || body?.itemId || '').trim();
  if (!requestedId) return null;
  return REAL_WORLD_CATALOG.find((item) => item.id === requestedId) || null;
}

function buildPrompt(item = {}) {
  const name = [item.name, item.type].filter(Boolean).join(' / ') || 'the product';
  const material = item.material ? `Material: ${item.material}.` : '';
  return [
    `Reconstruct the same manufactured product shown in every reference image: ${name}.`,
    material,
    'Treat all views as the same object. Preserve silhouette, proportions, thickness, openings, controls, hardware, seams, colors and visible construction.',
    'Do not redesign, stylize, simplify, add accessories, invent controls, logos, patterns or geometry.',
    'When views disagree, prefer geometry supported by multiple references. Prioritize faithful product reconstruction over artistic interpretation.'
  ].filter(Boolean).join(' ').slice(0, MAX_TEXTURE_PROMPT);
}

function isPlaceholderImage(url = '') { return /unsplash\.com/i.test(url); }
function isHttpUrl(value = '') { try { const url = new URL(value); return url.protocol === 'http:' || url.protocol === 'https:'; } catch { return false; } }
function uniqueImages(values = []) { return [...new Set(values.filter(value => isHttpUrl(value) && !isPlaceholderImage(value)))].slice(0, 4); }

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
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) { try { return new URL(match[1], sourceUrl).toString(); } catch {} }
    }
  } catch {}
  return '';
}

async function resolveProductImages(item) {
  const images = [];
  if (item?.supplierSku) {
    try {
      const product = await getCjProductBySku(item.supplierSku);
      images.push(...cjProductImages(product));
    } catch {}
  }
  if (!images.length) images.push(await scrapeProductImage(item?.sourceUrl || ''));
  return uniqueImages(images);
}

function parseTaskId(value = '') {
  if (value.startsWith('multi:')) return { mode: 'multi', id: value.slice(6) };
  if (value.startsWith('image:')) return { mode: 'image', id: value.slice(6) };
  return { mode: 'image', id: value };
}

export async function POST(request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const apiKey = process.env.MESHY_API_KEY;
  if (!apiKey) return NextResponse.json({ configured: false, error: 'Model generation is not configured.' }, { status: 503 });
  try {
    const body = await request.json();
    const item = trustedCatalogItem(body);
    if (!item) return NextResponse.json({ error: 'Trusted catalog item is required.' }, { status: 404 });
    const itemId = item.id;
    const forceRestart = body?.forceRestart === true;

    if (!forceRestart) {
      const saved = await readCatalog3D(itemId);
      if (saved?.model_url || saved?.model_storage_path) {
        return NextResponse.json({ configured: true, reused: true, modelUrl: saved.model_url || null, stored: Boolean(saved.model_storage_path), taskId: saved.task_id || null, progress: 100 });
      }
      if (saved?.task_id && ['PENDING', 'IN_PROGRESS'].includes(String(saved.status || '').toUpperCase())) {
        return NextResponse.json({ configured: true, reused: true, taskId: saved.task_id, progress: saved.progress || 0 });
      }
    }

    const imageUrls = await resolveProductImages(item);
    if (!imageUrls.length) return NextResponse.json({ error: 'Public product media could not be resolved.' }, { status: 400 });

    const useMultiView = imageUrls.length >= 2;
    const endpoint = useMultiView ? MULTI_IMAGE_ENDPOINT : IMAGE_ENDPOINT;
    const prompt = buildPrompt(item);
    const payload = useMultiView ? {
      image_urls: imageUrls,
      ai_model: 'latest',
      should_texture: true,
      enable_pbr: true,
      texture_resolution: '4k',
      texture_image_urls: imageUrls,
      image_enhancement: false,
      remove_lighting: true,
      should_remesh: false,
      target_formats: ['glb'],
      auto_size: true,
      origin_at: 'bottom',
      multi_view_thumbnails: true,
    } : {
      image_url: imageUrls[0],
      model_type: 'standard',
      ai_model: 'latest',
      image_enhancement: false,
      remove_lighting: true,
      should_texture: true,
      enable_pbr: true,
      texture_resolution: '4k',
      texture_image_url: imageUrls[0],
      texture_prompt: prompt,
      should_remesh: false,
      target_formats: ['glb'],
      auto_size: true,
      origin_at: 'bottom',
      multi_view_thumbnails: true,
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json({ error: data?.message || data?.error || data?.task_error?.message || 'Model provider rejected the request.' }, { status: response.status });

    const rawTaskId = data?.result || data?.id || null;
    const taskId = rawTaskId ? `${useMultiView ? 'multi' : 'image'}:${rawTaskId}` : null;
    if (taskId) {
      await saveCatalog3D(itemId, {
        supplier_sku: item?.supplierSku || null,
        task_id: taskId,
        source_image_url: imageUrls[0],
        source_image_urls: imageUrls,
        model_url: null,
        model_storage_path: null,
        thumbnail_url: null,
        status: 'PENDING',
        progress: 0,
        started_at: new Date().toISOString(),
        completed_at: null,
        error: forceRestart ? 'Previous build was stale or failed; server restarted generation automatically.' : null,
      });
    }
    return NextResponse.json({ configured: true, restarted: forceRestart, sourceImageUrl: imageUrls[0], sourceImageCount: imageUrls.length, generationMode: useMultiView ? 'multi-view' : 'single-view', taskId });
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Model request failed.' }, { status: 500 });
  }
}

export async function GET(request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const apiKey = process.env.MESHY_API_KEY;
  const taskId = new URL(request.url).searchParams.get('taskId');
  if (!apiKey) return NextResponse.json({ configured: false, error: 'Model generation is not configured.' }, { status: 503 });
  if (!taskId) return NextResponse.json({ error: 'taskId is required.' }, { status: 400 });

  try {
    const parsed = parseTaskId(taskId);
    const endpoint = parsed.mode === 'multi' ? MULTI_IMAGE_ENDPOINT : IMAGE_ENDPOINT;
    const response = await fetch(`${endpoint}/${encodeURIComponent(parsed.id)}`, { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json({ error: data?.message || data?.error || data?.task_error?.message || 'Unable to read model generation status.' }, { status: response.status });

    const status = data?.status || 'PENDING';
    const progress = Number(data?.progress ?? 0);
    const providerModelUrl = data?.model_urls?.glb || null;
    const thumbnailUrl = data?.thumbnail_url || null;
    const saved = await readCatalog3DByTask(taskId);
    let modelStoragePath = saved?.model_storage_path || null;

    if (providerModelUrl && saved?.item_id && !modelStoragePath) {
      modelStoragePath = await persistModelBinary(saved.item_id, providerModelUrl);
    }

    if (saved?.item_id) {
      await saveCatalog3D(saved.item_id, {
        task_id: taskId,
        status,
        progress: providerModelUrl ? 100 : progress,
        model_url: providerModelUrl || saved.model_url || null,
        model_storage_path: modelStoragePath || null,
        thumbnail_url: thumbnailUrl || saved.thumbnail_url || null,
        completed_at: providerModelUrl ? new Date().toISOString() : saved.completed_at || null,
        error: data?.task_error?.message || null,
      });
    }

    return NextResponse.json({
      configured: true,
      generationMode: parsed.mode === 'multi' ? 'multi-view' : 'single-view',
      status,
      progress: providerModelUrl ? 100 : progress,
      modelUrl: providerModelUrl,
      modelStored: Boolean(modelStoragePath),
      thumbnailUrl,
      thumbnailUrls: data?.thumbnail_urls || null,
      error: data?.task_error?.message || null,
    });
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Model generation status request failed.' }, { status: 500 });
  }
}
