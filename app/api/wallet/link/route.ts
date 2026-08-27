import { verifyMessage } from 'ethers';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';
import { appendAuditChainEvent } from '../../../../lib/audit-chain';

export const runtime = 'nodejs';
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export async function POST(request: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const auth = request.headers.get('authorization');
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const challengeId = String(body?.challengeId || '').trim();
    const signature = String(body?.signature || '').trim();
    if (!challengeId || !/^0x[a-fA-F0-9]{130}$/.test(signature)) {
      return NextResponse.json({ error: 'Wallet signature proof is incomplete.' }, { status: 400 });
    }

    const { data: challenge, error: challengeError } = await supabaseAdmin
      .from('wallet_link_challenges')
      .select('id,user_id,wallet_address,message,expires_at,used_at')
      .eq('id', challengeId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (challengeError) throw challengeError;
    if (!challenge) return NextResponse.json({ error: 'Wallet challenge was not found.' }, { status: 404 });
    if (challenge.used_at) return NextResponse.json({ error: 'Wallet challenge was already used.' }, { status: 409 });
    if (Date.parse(challenge.expires_at) <= Date.now()) return NextResponse.json({ error: 'Wallet challenge expired. Start again.' }, { status: 410 });
    if (!ADDRESS_RE.test(challenge.wallet_address)) return NextResponse.json({ error: 'Wallet challenge is invalid.' }, { status: 400 });

    const chainMatch = String(challenge.message || '').match(/^Chain ID:\s*(\d+)$/m);
    const chainId = Number(chainMatch?.[1] || 0);
    if (!Number.isSafeInteger(chainId) || chainId <= 0) return NextResponse.json({ error: 'Signed wallet challenge has no valid chain context.' }, { status: 400 });

    let recovered = '';
    try { recovered = verifyMessage(challenge.message, signature).toLowerCase(); }
    catch { return NextResponse.json({ error: 'Wallet signature could not be verified.' }, { status: 400 }); }
    if (recovered !== challenge.wallet_address.toLowerCase()) {
      return NextResponse.json({ error: 'The signature does not belong to the requested wallet.' }, { status: 403 });
    }

    const usedAt = new Date().toISOString();
    const { data: consumed, error: consumeError } = await supabaseAdmin
      .from('wallet_link_challenges')
      .update({ used_at: usedAt })
      .eq('id', challenge.id)
      .is('used_at', null)
      .select('id')
      .maybeSingle();
    if (consumeError) throw consumeError;
    if (!consumed) return NextResponse.json({ error: 'Wallet challenge was already consumed.' }, { status: 409 });

    const { data: link, error: linkError } = await supabaseAdmin.from('wallet_links').upsert({
      user_id: user.id,
      wallet_address: recovered,
      chain_id: chainId,
      verification_method: 'personal_sign',
      verified_at: usedAt,
      last_seen_at: usedAt,
    }, { onConflict: 'user_id,wallet_address' }).select('id,wallet_address,chain_id,verified_at').single();
    if (linkError || !link) throw linkError ?? new Error('Wallet link could not be saved.');

    const audit = await appendAuditChainEvent(supabaseAdmin, {
      eventType: 'wallet_link_verified',
      entityType: 'wallet_link',
      entityId: link.id,
      actorUserId: user.id,
      sourceRef: challenge.id,
      payload: { walletAddress: recovered, chainId, verificationMethod: 'personal_sign' },
    });

    return NextResponse.json({ linked: true, walletAddress: recovered, chainId, verifiedAt: link.verified_at, auditHash: audit.entryHash });
  } catch (error) {
    console.error('wallet link verification failed', error);
    return NextResponse.json({ error: 'Unable to verify and link this wallet.' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const auth = request.headers.get('authorization');
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    const { data, error } = await supabaseAdmin
      .from('wallet_links')
      .select('id,wallet_address,chain_id,verified_at,last_seen_at')
      .eq('user_id', user.id)
      .order('verified_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ wallets: data || [] });
  } catch (error) {
    console.error('wallet links lookup failed', error);
    return NextResponse.json({ error: 'Unable to load linked wallets.' }, { status: 500 });
  }
}
