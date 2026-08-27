import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';

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
    const walletAddress = String(body?.walletAddress || '').trim().toLowerCase();
    const chainId = Number(body?.chainId || 0) || null;
    if (!ADDRESS_RE.test(walletAddress)) return NextResponse.json({ error: 'A valid wallet address is required.' }, { status: 400 });

    const nonce = randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
    const host = new URL(request.url).host;
    const message = [
      'VoxelVault wallet link',
      '',
      'Sign this message to prove you control this wallet. This signature does not send a transaction or spend funds.',
      `Account: ${user.id}`,
      `Wallet: ${walletAddress}`,
      `Host: ${host}`,
      `Nonce: ${nonce}`,
      `Expires: ${expiresAt}`,
    ].join('\n');

    const { data, error } = await supabaseAdmin.from('wallet_link_challenges').insert({
      user_id: user.id,
      wallet_address: walletAddress,
      nonce,
      message,
      expires_at: expiresAt,
    }).select('id').single();
    if (error || !data) throw error ?? new Error('Challenge creation failed.');

    return NextResponse.json({ challengeId: data.id, message, expiresAt });
  } catch (error) {
    console.error('wallet challenge failed', error);
    return NextResponse.json({ error: 'Unable to create wallet verification challenge.' }, { status: 500 });
  }
}
