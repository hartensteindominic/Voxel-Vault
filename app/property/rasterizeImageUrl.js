import { getSupabaseBrowserAsync } from '../../lib/supabase-browser';

const MAX_EDGE = 1600;
const PROBE_SIZE = 32;
const REFERENCE_MAX_EDGE = 1536;
const DEVICE_DB = 'voxelpop-property-device-v1';
const DEVICE_STORE = 'pending-photos';
const RENDER_MAP_KEY = '__VOXELPOP_PROPERTY_RENDER_MAP__';
const RENDER_PROMISES_KEY = '__VOXELPOP_PROPERTY_RENDER_PROMISES__';

function isLocalUrl(url) {
  const value = String(url || '');
  return value.startsWith('data:') || value.startsWith('blob:') || value.startsWith('/') || value.startsWith('./');
}

function renderMap() {
  if (typeof window === 'undefined') return null;
  if (!window[RENDER_MAP_KEY]) window[RENDER_MAP_KEY] = Object.create(null);
  return window[RENDER_MAP_KEY];
}

function renderPromises() {
  if (typeof window === 'undefined') return null;
  if (!window[RENDER_PROMISES_KEY]) window[RENDER_PROMISES_KEY] = Object.create(null);
  return window[RENDER_PROMISES_KEY];
}

async function openDeviceDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('Private on-device photo storage is unavailable.'));
    const request = indexedDB.open(DEVICE_DB, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(DEVICE_STORE)) request.result.createObjectStore(DEVICE_STORE, { keyPath: 'draftId' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Private photo storage could not open.'));
  });
}

async function sha256(bytes) {
  if (!globalThis.crypto?.subtle) return '';
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, '0')).join('');
}

async function findDraftIdForPhoto(url) {
  const response = await fetch(url);
  const blob = await response.blob();
  const bytes = await blob.arrayBuffer();
  const digest = await sha256(bytes);
  const db = await openDeviceDb();
  try {
    const records = await new Promise((resolve, reject) => {
      const request = db.transaction(DEVICE_STORE, 'readonly').objectStore(DEVICE_STORE).getAll();
      request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : []);
      request.onerror = () => reject(request.error || new Error('Private photo storage could not be read.'));
    });
    const candidates = records
      .filter((record) => String(record?.draftId || '').startsWith('vp-') && record?.bytes)
      .filter((record) => Number(record.bytes.byteLength || 0) === Number(bytes.byteLength || 0))
      .sort((a, b) => Number(b.savedAt || 0) - Number(a.savedAt || 0));

    if (!candidates.length) throw new Error('VoxelPop could not reconnect this photo to its paid creation.');
    if (!digest) return String(candidates[0].draftId);
    for (const record of candidates) {
      try {
        if (await sha256(record.bytes) === digest) return String(record.draftId);
      } catch {}
    }
    throw new Error('VoxelPop could not reconnect this photo to its paid creation.');
  } finally {
    db.close();
  }
}

async function loadRawImage(url) {
  if (typeof createImageBitmap === 'function') {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return await createImageBitmap(blob);
    } catch {}
  }

  const image = new Image();
  image.decoding = 'async';
  if (!isLocalUrl(url)) image.crossOrigin = 'anonymous';
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => reject(new Error('The house photo could not be prepared for VoxelPop.'));
    image.src = url;
  });
  try { await image.decode?.(); } catch {}
  return image;
}

async function prepareReference(url) {
  const image = await loadRawImage(url);
  try {
    const sourceW = Math.max(2, image.width || image.naturalWidth || 960);
    const sourceH = Math.max(2, image.height || image.naturalHeight || 640);
    const scale = Math.min(1, REFERENCE_MAX_EDGE / Math.max(sourceW, sourceH));
    const width = Math.max(2, Math.round(sourceW * scale));
    const height = Math.max(2, Math.round(sourceH * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('This browser cannot prepare the house photo for VoxelPop.');
    context.drawImage(image, 0, 0, width, height);
    for (const quality of [0.9, 0.82, 0.74, 0.66, 0.58]) {
      const data = canvas.toDataURL('image/jpeg', quality);
      if (data.length <= 5_200_000) return data;
    }
    throw new Error('This house photo is too large for VoxelPop. Try a screenshot or a smaller photo.');
  } finally {
    image.close?.();
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateVoxelPhoto(sourceUrl) {
  const [draftId, reference, client] = await Promise.all([
    findDraftIdForPhoto(sourceUrl),
    prepareReference(sourceUrl),
    getSupabaseBrowserAsync(),
  ]);
  const { data } = await client.auth.getSession();
  const token = String(data?.session?.access_token || '');
  if (!token) throw new Error('Sign in again before generating the VoxelPop image.');

  const start = await fetch('/api/property-voxel-photo', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ draftId, reference }),
  });
  const started = await start.json().catch(() => ({}));
  if (!start.ok || !started?.ok || !started?.taskId || !started?.taskToken) {
    throw new Error(started?.error || 'VoxelPop image generation could not start.');
  }

  for (let attempt = 0; attempt < 90; attempt += 1) {
    if (attempt > 0) await sleep(1500);
    const params = new URLSearchParams({
      draftId,
      taskId: String(started.taskId),
      taskToken: String(started.taskToken),
    });
    const response = await fetch(`/api/property-voxel-photo?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    const state = await response.json().catch(() => ({}));
    if (!response.ok || !state?.ok) throw new Error(state?.error || 'VoxelPop image generation failed.');
    if (state.ready && state.imageDataUrl) return String(state.imageDataUrl);
  }
  throw new Error('VoxelPop image generation took too long. Try the photo again; you will not be charged twice.');
}

async function resolvePropertyRender(url) {
  const sourceUrl = String(url || '');
  if (!sourceUrl.startsWith('blob:') || typeof window === 'undefined' || window.location.pathname !== '/property') {
    return sourceUrl;
  }

  const map = renderMap();
  if (map?.[sourceUrl]) return String(map[sourceUrl]);
  const promises = renderPromises();
  if (!promises) return sourceUrl;
  if (!promises[sourceUrl]) {
    promises[sourceUrl] = generateVoxelPhoto(sourceUrl)
      .then((generated) => {
        map[sourceUrl] = generated;
        return generated;
      })
      .catch((error) => {
        delete promises[sourceUrl];
        throw error;
      });
  }
  return promises[sourceUrl];
}

/**
 * Loads an image URL into a canvas raster. In the paid /property flow, a
 * device-local house photo is first transformed into the approved VoxelPop
 * image and cached in-memory for the later movable 3D voxel stage.
 *
 * @param {string} url - Any URL including blob: / data: object URLs.
 * @returns {Promise<{canvas: HTMLCanvasElement, width: number, height: number}>}
 */
export async function rasterizeImageUrl(url) {
  const resolvedUrl = await resolvePropertyRender(url);
  let bitmap = null;

  try {
    if (typeof createImageBitmap === 'function') {
      const response = await fetch(resolvedUrl);
      const blob = await response.blob();
      bitmap = await createImageBitmap(blob);
    }
  } catch {
    bitmap = null;
  }

  if (!bitmap) {
    const img = new Image();
    if (!isLocalUrl(resolvedUrl)) img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('The VoxelPop image could not be opened for the 3D voxel.'));
      img.src = resolvedUrl;
    });
    try { await img.decode?.(); } catch {}
    bitmap = img;
  }

  const srcW = Math.max(2, bitmap.width || bitmap.naturalWidth || 960);
  const srcH = Math.max(2, bitmap.height || bitmap.naturalHeight || 640);
  const scale = Math.min(1, MAX_EDGE / Math.max(srcW, srcH));
  const rasterW = Math.max(2, Math.round(srcW * scale));
  const rasterH = Math.max(2, Math.round(srcH * scale));

  const raster = document.createElement('canvas');
  raster.width = rasterW;
  raster.height = rasterH;
  const ctx = raster.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Image rasterization is unavailable in this browser.');
  ctx.drawImage(bitmap, 0, 0, rasterW, rasterH);
  if (bitmap.close) bitmap.close();

  const probeW = Math.min(PROBE_SIZE, rasterW);
  const probeH = Math.min(PROBE_SIZE, rasterH);
  const probe = ctx.getImageData(0, 0, probeW, probeH).data;
  let opaqueCount = 0;
  let lumaSum = 0;
  for (let i = 0; i < probe.length; i += 4) {
    if (probe[i + 3] > 30) {
      opaqueCount += 1;
      lumaSum += probe[i] * 0.2126 + probe[i + 1] * 0.7152 + probe[i + 2] * 0.0722;
    }
  }
  const totalProbe = probeW * probeH;
  const avgLuma = opaqueCount > 0 ? lumaSum / opaqueCount : 0;
  if (opaqueCount < totalProbe * 0.05 || avgLuma < 4) {
    throw new Error('The VoxelPop image appears empty or black — choose the photo again and retry.');
  }

  return { canvas: raster, width: rasterW, height: rasterH };
}
