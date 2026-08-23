import { NextResponse } from 'next/server';
import { createModelSignedUrl, readCatalog3D } from '../../../../lib/catalog3dStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const itemId = new URL(request.url).searchParams.get('itemId');
  if (!itemId) return NextResponse.json({ error: 'itemId is required' }, { status: 400 });

  const row = await readCatalog3D(itemId);
  if (!row) return NextResponse.json({ error: 'Model not found' }, { status: 404 });

  if (row.model_storage_path) {
    const signedUrl = await createModelSignedUrl(row.model_storage_path, 60 * 60);
    if (signedUrl) return NextResponse.redirect(signedUrl, { status: 307 });
  }

  if (row.model_url) return NextResponse.redirect(row.model_url, { status: 307 });
  return NextResponse.json({ error: 'Model is not ready yet' }, { status: 404 });
}
