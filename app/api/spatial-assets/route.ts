import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabase-admin';
import { appendAuditChainEvent } from '../../../lib/audit-chain';

export const runtime = 'nodejs';
const PRIVATE_BUCKET = process.env.SPATIAL_ASSET_BUCKET || 'assets-private';

async function authenticatedUser(request: Request, supabaseAdmin: any) {
  const auth = request.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  return error ? null : user;
}

function cleanText(value: unknown, max: number) {
  return String(value || '').trim().slice(0, max);
}

function mapRow(row: any, imageUrl: string | null, modelUrl: string | null) {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    sourceKind: row.source_kind,
    sourceSessionId: row.source_session_id,
    sourceTaskId: row.source_task_id,
    title: row.title,
    description: row.description || '',
    prompt: row.prompt || '',
    imageUrl,
    modelUrl,
    state: row.state,
    favorite: Boolean(row.favorite),
    collectionName: row.collection_name || 'My Vault',
    chainId: row.chain_id == null ? null : Number(row.chain_id),
    contractAddress: row.contract_address || null,
    tokenId: row.token_id || null,
    transactionHash: row.transaction_hash || null,
    ownerWallet: row.owner_wallet || null,
    metadataUri: row.metadata_uri || null,
    auditHash: row.audit_hash || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function GET(request: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const user = await authenticatedUser(request, supabaseAdmin);
    if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    const url = new URL(request.url);
    const includeArchived = url.searchParams.get('includeArchived') === '1';

    let query = supabaseAdmin
      .from('spatial_assets')
      .select('*')
      .eq('owner_user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(120);
    if (!includeArchived) query = query.neq('state', 'archived');
    const { data: rows, error } = await query;
    if (error) throw error;

    const { data: profile } = await supabaseAdmin
      .from('vault_profiles')
      .select('avatar_style')
      .eq('user_id', user.id)
      .maybeSingle();
    const library = Array.isArray(profile?.avatar_style?.voxelpop_library) ? profile.avatar_style.voxelpop_library : [];
    const sourceImages = new Map<string, string>();
    for (const record of library) {
      const sessionId = String(record?.sessionId || '');
      const dataUrl = String(record?.payload?.asset?.dataUrl || '');
      if (sessionId && /^data:image\/(png|jpeg|webp);base64,/i.test(dataUrl)) sourceImages.set(sessionId, dataUrl);
    }

    const assets = await Promise.all((rows || []).map(async (row: any) => {
      let modelUrl: string | null = null;
      let imageUrl: string | null = row.image_url || sourceImages.get(row.source_session_id || '') || null;

      if (row.glb_storage_path) {
        const { data } = await supabaseAdmin.storage.from(PRIVATE_BUCKET).createSignedUrl(row.glb_storage_path, 120);
        modelUrl = data?.signedUrl || null;
      } else if (row.source_kind === 'voxelpop' && row.source_session_id && row.source_task_id) {
        modelUrl = `/api/creator-pack/mesh?${new URLSearchParams({ sessionId: row.source_session_id, taskId: row.source_task_id, preview: '1' }).toString()}`;
      }

      if (row.thumbnail_path) {
        const { data } = await supabaseAdmin.storage.from(PRIVATE_BUCKET).createSignedUrl(row.thumbnail_path, 120);
        if (data?.signedUrl) imageUrl = data.signedUrl;
      }
      return mapRow(row, imageUrl, modelUrl);
    }));

    return NextResponse.json({ assets });
  } catch (error) {
    console.error('spatial assets lookup failed', error);
    return NextResponse.json({ error: 'Unable to load My Vault.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const user = await authenticatedUser(request, supabaseAdmin);
    if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const title = cleanText(body?.title || 'Untitled creation', 120) || 'Untitled creation';
    const prompt = cleanText(body?.prompt, 420);
    const description = cleanText(body?.description, 500);

    const { data, error } = await supabaseAdmin.from('spatial_assets').insert({
      owner_user_id: user.id,
      source_kind: 'manual',
      title,
      prompt,
      description,
      state: 'draft',
    }).select('*').single();
    if (error || !data) throw error ?? new Error('Spatial draft creation failed.');

    const audit = await appendAuditChainEvent(supabaseAdmin, {
      eventType: 'spatial_asset_created',
      entityType: 'spatial_asset',
      entityId: data.id,
      actorUserId: user.id,
      sourceRef: `spatial:${data.id}:created`,
      payload: { sourceKind: 'manual', title, prompt },
    });
    await supabaseAdmin.from('spatial_assets').update({ audit_hash: audit.entryHash }).eq('id', data.id);

    return NextResponse.json({ asset: mapRow({ ...data, audit_hash: audit.entryHash }, null, null) }, { status: 201 });
  } catch (error) {
    console.error('spatial asset creation failed', error);
    return NextResponse.json({ error: 'Unable to create this spatial draft.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const user = await authenticatedUser(request, supabaseAdmin);
    if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const assetId = String(body?.id || '');
    if (!/^[0-9a-f-]{36}$/i.test(assetId)) return NextResponse.json({ error: 'Valid asset id required.' }, { status: 400 });

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof body?.favorite === 'boolean') updates.favorite = body.favorite;
    if (typeof body?.title === 'string') updates.title = cleanText(body.title, 120) || 'Untitled creation';
    if (typeof body?.description === 'string') updates.description = cleanText(body.description, 500);
    if (typeof body?.collectionName === 'string') updates.collection_name = cleanText(body.collectionName, 80) || 'My Vault';
    if (body?.state === 'archived' || body?.state === 'saved') updates.state = body.state;

    const { data, error } = await supabaseAdmin
      .from('spatial_assets')
      .update(updates)
      .eq('id', assetId)
      .eq('owner_user_id', user.id)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Asset not found.' }, { status: 404 });

    const audit = await appendAuditChainEvent(supabaseAdmin, {
      eventType: 'spatial_asset_updated',
      entityType: 'spatial_asset',
      entityId: assetId,
      actorUserId: user.id,
      sourceRef: `spatial:${assetId}:update:${Date.now()}`,
      payload: updates,
    });
    await supabaseAdmin.from('spatial_assets').update({ audit_hash: audit.entryHash }).eq('id', assetId).eq('owner_user_id', user.id);

    return NextResponse.json({ updated: true, auditHash: audit.entryHash });
  } catch (error) {
    console.error('spatial asset update failed', error);
    return NextResponse.json({ error: 'Unable to update this vault item.' }, { status: 500 });
  }
}
