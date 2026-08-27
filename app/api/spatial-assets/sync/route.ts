import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';
import { appendAuditChainEvent } from '../../../../lib/audit-chain';

export const runtime = 'nodejs';
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const TX_RE = /^0x[a-fA-F0-9]{64}$/;

function meshReady(payload: any) {
  const status = String(payload?.mesh?.status || '').toLowerCase();
  return status === 'ready' || status === 'succeeded' || status === 'completed' || Number(payload?.mesh?.progress || 0) >= 100 || Boolean(payload?.mesh?.modelUrl);
}

function cleanText(value: unknown, max: number) {
  return String(value || '').trim().slice(0, max);
}

async function verifyHistoricalMint(request: Request, sessionId: string, taskId: string, mint: any) {
  const tokenId = cleanText(mint?.tokenId, 80);
  const txHash = cleanText(mint?.txHash || mint?.hash, 80);
  const wallet = cleanText(mint?.owner, 80);
  const metadataUrl = cleanText(mint?.metadataUrl, 500);
  if (!/^\d+$/.test(tokenId) || !TX_RE.test(txHash) || !ADDRESS_RE.test(wallet) || !/^https:\/\//i.test(metadataUrl)) return null;
  try {
    const response = await fetch(new URL('/api/creator-pack/nft/confirm', request.url), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, taskId, tokenId, txHash, wallet, metadataUrl }),
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.confirmed !== true) return null;
    return {
      tokenId: String(data.tokenId || tokenId),
      txHash,
      wallet: String(data.wallet || wallet).toLowerCase(),
      contractAddress: String(data.contractAddress || ''),
      metadataUrl,
    };
  } catch (error) {
    console.warn('Historical VoxelFlip mint could not be re-verified during spatial sync.', error);
    return null;
  }
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
    let verifiedMints = 0;

    for (const record of library.slice(0, 120)) {
      const sessionId = cleanText(record?.sessionId, 240);
      const payload = record?.payload || {};
      const taskId = cleanText(payload?.mesh?.taskId, 240) || null;
      const title = cleanText(payload?.asset?.name || 'Your voxel', 120) || 'Your voxel';
      if (!sessionId || !payload?.asset?.dataUrl) continue;

      const { data: existing, error: lookupError } = await supabaseAdmin
        .from('spatial_assets')
        .select('id,state,source_task_id,transaction_hash')
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
        const importedAudit = await appendAuditChainEvent(supabaseAdmin, {
          eventType: 'spatial_asset_imported',
          entityType: 'spatial_asset',
          entityId: assetId,
          actorUserId: user.id,
          sourceRef: `voxelpop:${sessionId}`,
          payload: { sourceKind: 'voxelpop', sessionId, taskId, state: safeState, title },
        });
        await supabaseAdmin.from('spatial_assets').update({ audit_hash: importedAudit.entryHash }).eq('id', assetId);
      }

      if (taskId && existing?.state !== 'minted' && payload?.mint?.tokenId) {
        const verified = await verifyHistoricalMint(request, sessionId, taskId, payload.mint);
        if (verified && ADDRESS_RE.test(verified.contractAddress)) {
          const { error: mintUpdateError } = await supabaseAdmin.from('spatial_assets').update({
            state: 'minted',
            chain_id: 8453,
            contract_address: verified.contractAddress.toLowerCase(),
            token_id: verified.tokenId,
            transaction_hash: verified.txHash.toLowerCase(),
            owner_wallet: verified.wallet,
            metadata_uri: verified.metadataUrl,
            updated_at: new Date().toISOString(),
          }).eq('id', assetId).eq('owner_user_id', user.id);
          if (mintUpdateError) throw mintUpdateError;

          const audit = await appendAuditChainEvent(supabaseAdmin, {
            eventType: 'spatial_mint_verified',
            entityType: 'spatial_asset',
            entityId: assetId,
            actorUserId: user.id,
            sourceRef: `base:mint:${verified.txHash.toLowerCase()}`,
            payload: {
              chainId: 8453,
              contractAddress: verified.contractAddress.toLowerCase(),
              tokenId: verified.tokenId,
              transactionHash: verified.txHash.toLowerCase(),
              ownerWallet: verified.wallet,
              metadataUri: verified.metadataUrl,
            },
          });
          await supabaseAdmin.from('spatial_assets').update({ audit_hash: audit.entryHash }).eq('id', assetId);
          await supabaseAdmin.from('spatial_asset_events').insert({
            asset_id: assetId,
            event_type: 'mint_verified',
            details: { chainId: 8453, tokenId: verified.tokenId, transactionHash: verified.txHash.toLowerCase() },
          });
          verifiedMints += 1;
        }
      }
    }

    return NextResponse.json({ synced: true, created, updated, verifiedMints, totalSourceRecords: library.length });
  } catch (error) {
    console.error('spatial asset sync failed', error);
    return NextResponse.json({ error: 'Unable to sync your VoxelPop library into My Vault.' }, { status: 500 });
  }
}
