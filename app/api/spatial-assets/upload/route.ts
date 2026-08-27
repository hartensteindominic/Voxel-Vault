import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';
import { appendAuditChainEvent } from '../../../../lib/audit-chain';

export const runtime = 'nodejs';
export const maxDuration = 60;
const BUCKET = process.env.SPATIAL_ASSET_BUCKET || 'assets-private';
const MAX_GLB_BYTES = 30 * 1024 * 1024;
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

function validUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
function cleanText(value: unknown, max: number) {
  return String(value || '').trim().slice(0, max);
}

export async function POST(request: Request) {
  const uploadedPaths: string[] = [];
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const auth = request.headers.get('authorization');
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const form = await request.formData();
    const model = form.get('model');
    const preview = form.get('preview');
    const requestedAssetId = cleanText(form.get('assetId'), 64);
    const title = cleanText(form.get('title') || 'Imported 3D asset', 120) || 'Imported 3D asset';
    const prompt = cleanText(form.get('prompt'), 420);
    const description = cleanText(form.get('description'), 500);

    if (!(model instanceof File)) return NextResponse.json({ error: 'Choose a GLB model to import.' }, { status: 400 });
    const modelName = model.name.toLowerCase();
    if (!modelName.endsWith('.glb') && !['model/gltf-binary','application/octet-stream',''].includes(model.type)) {
      return NextResponse.json({ error: 'VoxelVault spatial imports currently accept GLB files.' }, { status: 415 });
    }
    if (model.size <= 0 || model.size > MAX_GLB_BYTES) return NextResponse.json({ error: 'GLB file must be between 1 byte and 30 MB.' }, { status: 413 });
    if (preview instanceof File && (preview.size > MAX_IMAGE_BYTES || !['image/png','image/jpeg','image/webp'].includes(preview.type))) {
      return NextResponse.json({ error: 'Preview must be PNG, JPEG, or WebP and no larger than 6 MB.' }, { status: 415 });
    }

    let assetId = validUuid(requestedAssetId) ? requestedAssetId : randomUUID();
    let existing: any = null;
    if (validUuid(requestedAssetId)) {
      const { data, error } = await supabaseAdmin.from('spatial_assets').select('id,state').eq('id', requestedAssetId).eq('owner_user_id', user.id).maybeSingle();
      if (error) throw error;
      if (!data) return NextResponse.json({ error: 'Draft asset was not found.' }, { status: 404 });
      existing = data;
    }

    const basePath = `spatial-assets/${user.id}/${assetId}`;
    const modelPath = `${basePath}/model.glb`;
    const modelBytes = new Uint8Array(await model.arrayBuffer());
    const { error: modelError } = await supabaseAdmin.storage.from(BUCKET).upload(modelPath, modelBytes, {
      contentType: 'model/gltf-binary',
      upsert: Boolean(existing),
      cacheControl: '3600',
    });
    if (modelError) throw modelError;
    uploadedPaths.push(modelPath);

    let thumbnailPath: string | null = null;
    if (preview instanceof File && preview.size > 0) {
      const ext = preview.type === 'image/png' ? 'png' : preview.type === 'image/webp' ? 'webp' : 'jpg';
      thumbnailPath = `${basePath}/preview.${ext}`;
      const previewBytes = new Uint8Array(await preview.arrayBuffer());
      const { error: previewError } = await supabaseAdmin.storage.from(BUCKET).upload(thumbnailPath, previewBytes, {
        contentType: preview.type,
        upsert: Boolean(existing),
        cacheControl: '3600',
      });
      if (previewError) throw previewError;
      uploadedPaths.push(thumbnailPath);
    }

    const values = {
      owner_user_id: user.id,
      source_kind: 'manual',
      title,
      prompt,
      description,
      glb_storage_path: modelPath,
      ...(thumbnailPath ? { thumbnail_path: thumbnailPath } : {}),
      state: 'saved',
      updated_at: new Date().toISOString(),
    };
    if (existing) {
      const { error } = await supabaseAdmin.from('spatial_assets').update(values).eq('id', assetId).eq('owner_user_id', user.id);
      if (error) throw error;
    } else {
      const { error } = await supabaseAdmin.from('spatial_assets').insert({ id: assetId, ...values });
      if (error) throw error;
    }

    const audit = await appendAuditChainEvent(supabaseAdmin, {
      eventType: existing ? 'spatial_model_replaced' : 'spatial_model_imported',
      entityType: 'spatial_asset',
      entityId: assetId,
      actorUserId: user.id,
      sourceRef: `spatial-upload:${assetId}:${Date.now()}`,
      payload: { title, modelBytes: model.size, hasPreview: Boolean(thumbnailPath), state: 'saved' },
    });
    await supabaseAdmin.from('spatial_assets').update({ audit_hash: audit.entryHash }).eq('id', assetId).eq('owner_user_id', user.id);

    return NextResponse.json({ saved: true, assetId, state: 'saved', auditHash: audit.entryHash });
  } catch (error) {
    console.error('spatial GLB upload failed', error);
    return NextResponse.json({ error: 'Unable to save this 3D model to My Vault.' }, { status: 500 });
  }
}
