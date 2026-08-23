import { NextResponse } from 'next/server';
import { cjProductImages, getCjProductBySku } from '../../../lib/cjApi';

export const runtime = 'nodejs';

function extractImage(html, sourceUrl) {
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      try { return new URL(match[1], sourceUrl).toString(); } catch {}
    }
  }
  return null;
}

async function scrapeFallback(sourceUrl) {
  if (!/^https?:\/\//i.test(sourceUrl)) return null;
  const response = await fetch(sourceUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VoxelVaultProductResolver/1.0)' }, cache: 'no-store' });
  if (!response.ok) return null;
  return extractImage(await response.text(), sourceUrl);
}

export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const sourceUrl = params.get('url') || '';
  const sku = params.get('sku') || '';

  if (sku) {
    try {
      const product = await getCjProductBySku(sku);
      const images = cjProductImages(product);
      if (images[0]) return NextResponse.json({ imageUrl: images[0], images, sourceUrl, sku, source: 'cj-api' });
    } catch (error) {
      if (!sourceUrl) return NextResponse.json({ error: error?.message || 'CJ product media unavailable.' }, { status: 502 });
    }
  }

  if (!/^https?:\/\//i.test(sourceUrl)) return NextResponse.json({ error: 'A valid supplier URL or CJ SKU is required.' }, { status: 400 });
  try {
    const imageUrl = await scrapeFallback(sourceUrl);
    if (!imageUrl) return NextResponse.json({ error: 'No product image could be resolved from CJ.' }, { status: 404 });
    return NextResponse.json({ imageUrl, images: [imageUrl], sourceUrl, sku, source: 'page-fallback' });
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Supplier image resolution failed.' }, { status: 500 });
  }
}
