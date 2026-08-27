import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';
import { appendAuditChainEvent } from '../../../../lib/audit-chain';

export const runtime = 'nodejs';

function meshReady(payload: any) {
  const status = String(payload?.mesh?.status || '').toLowerCase();
  return status === 'ready' || status === 'succeeded' || status === 'completed' || Number(payload?.mesh?.progress || 0) >= 100 || Boolean(payload?.mesh?.modelUrl);
}

function cleanText(value: unknown, max: number) {
  return String(value || '').trim().slice(0, max);
}

export async function POST(request: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const auth = request.headers.get('authorization');
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('vault_profiles')
      .select('avatar_style')
      .eq('user_id', user.id)
      .maybeSingle();
    if (profileError) throw profileError;

    const library = Array.isArray(profile?.avatar_style?.voxelpop_library) ? profile.avatar_style.voxelpop_library : [];
    let created = 0;
    let updated = 0;

    for (const record of library.slice(0, 120)) {
      const sessionId = cleanText(record?.sessionId, 240);
      const payload = record?.payload || {};
      const taskId = cleanText(payload?.mesh?.taskId, 240) || null;
      const title = cleanText(payload?.asset?.name || 'Your voxel', 120) || 'Your voxel';
      if (!sessionId || !payload?.asset?.dataUrl) continue;

      const { data: existing, error: lookupError } = await supabaseAdmin
        .from('spatial_assets')
        .select('id,state,source_task_id')
        .eq('owner_user_id', user.id)
        .eq('source_kind', 'voxelpop')
        .eq('source_session_id', sessionId)
        .maybeSingle();
      if (lookupError) throw lookupError;

      const safeState = meshReady(payload) ? 'generated' : 'generating';
      const values = {
        owner_user_id: user.id,
        source_kind: 'voxelpop',
        source_session_id: sessionId,
        source_task_id: taskId,
        title,
        description: cleanText(payload?.description, 500),
        prompt: cleanText(payload?.idea || payload?.asset?.name, 420),
        state: existing?.state === 'minted' ? 'minted' : safeState,
        updated_at: new Date().toISOString(),
      };

      let assetId = existing?.id || '';
      if (existing) {
        const { error } = await supabaseAdmin.from('spatial_assets').update(values).eq('id', existing.id).eq('owner_user_id', user.id);
        if (error) throw error;
        updated += 1;
      } else {
        const { data: inserted, error } = await supabaseAdmin.from('spatial_assets').insert(values).select('id').single();
        if (error || !inserted) throw error ?? new Error('Spatial asset import failed.');
        assetId = inserted.id;
        created += 1;
        await appendAuditChainEvent(supabaseAdmin, {
          eventType: 'spatial_asset_imported',
          entityType: 'spatial_asset',
          entityId: assetId,
          actorUserId: user.id,
          sourceRef: `voxelpop:${sessionId}`,
          payload: { sourceKind: 'voxelpop', sessionId, taskId, state: safeState, title },
        });
      }
    }

    return NextResponse.json({ synced: true, created, updated, totalSourceRecords: library.length });
  } catch (error) {
    console.error('spatial asset sync failed', error);
    return NextResponse.json({ error: 'Unable to sync your VoxelPop library into My Vault.' }, { status: 500 });
  }
}
