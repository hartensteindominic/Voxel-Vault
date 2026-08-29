const MAX_EDGE = 1600;
const PROBE_SIZE = 32;

/**
 * Loads an image URL into a canvas raster, preferring createImageBitmap
 * (works for blob: URLs and same-origin assets) and falling back to
 * HTMLImageElement + decode(). Caps the longest edge at MAX_EDGE for
 * performance, then probes a corner for near-black or empty pixels.
 *
 * @param {string} url - Any URL including blob: object URLs.
 * @returns {Promise<{canvas: HTMLCanvasElement, width: number, height: number}>}
 * @throws {Error} If the image cannot be loaded or appears empty/black.
 */
export async function rasterizeImageUrl(url) {
  let bitmap = null;

  try {
    const response = await fetch(url);
    const blob = await response.blob();
    bitmap = await createImageBitmap(blob);
  } catch {
    const img = new Image();
    // Never set crossOrigin for data:, blob:, or same-origin relative paths —
    // it breaks canvas readback for those URL types.
    if (url && !url.startsWith('data:') && !url.startsWith('blob:') && /^https?:\/\//i.test(url)) {
      img.crossOrigin = 'anonymous';
    }
    img.src = url;
    await img.decode();
    bitmap = img;
  }

  const srcW = bitmap.width || bitmap.naturalWidth || 960;
  const srcH = bitmap.height || bitmap.naturalHeight || 640;
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
    throw new Error('The photo appears empty or black — please use a JPG or PNG photo and try again.');
  }

  return { canvas: raster, width: rasterW, height: rasterH };
}
