import { JsonRpcProvider } from 'ethers';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../../lib/supabase-admin';
import { cleanAttribution, recordVoxelPopEvent } from '../../../../../lib/voxelpop-analytics';

export const runtime = 'nodejs';
export const maxDuration = 60;

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const TX_RE = /^0x[a-fA-F0-9]{64}$/;
const RECEIVER = (process.env.VOXELPOP_CRYPTO_RECEIVER || '0x02f93c7547309ca50EEAB446DaEBE8ce8E694cBb').trim();

function rpcFor(chainId: number) {
  if (chainId === 8453) return process.env.VOXELPOP_BASE_RPC_URL || process.env.VOXELFLIP_RPC_URL || 'https://mainnet.base.org';
  if (chainId === 1) return process.env.VOXELPOP_ETHEREUM_RPC_URL || process.env.MAINNET_RPC_URL || 'https://cloudflare-eth.com';
  return '';
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const sessionId = typeof body?.sessionId === 'string' ? body.sessionId.trim() : '';
    const wallet = typeof body?.wallet === 'string' ? body.wallet.trim() : '';
    const txHash = typeof body?.txHash === 'string' ? body.txHash.trim() : '';
    if (!/^vfc_[0-9a-f-]{36}$/i.test(sessionId) || !ADDRESS_RE.test(wallet) || !TX_RE.test(txHash)) {
      return NextResponse.json({ error: 'Crypto payment verification details are incomplete.' }, { status: 400 });
    }
    if (!ADDRESS_RE.test(RECEIVER)) return NextResponse.json({ error: 'Crypto checkout receiver is not configured.' }, { status: 503 });

    const supabase = getSupabaseAdmin();
    const { data: row, error } = await supabase
      .from('voxelpop_crypto_purchases')
      .select('*')
      .eq('session_id', sessionId)
      .maybeSingle();
    if (error) throw error;
    if (!row) return NextResponse.json({ error: 'Crypto checkout quote was not found.' }, { status: 404 });
    if (String(row.wallet).toLowerCase() !== wallet.toLowerCase()) {
      return NextResponse.json({ error: 'The connected wallet does not match this checkout.' }, { status: 403 });
    }
    if (row.status === 'paid') {
      if (row.tx_hash && String(row.tx_hash).toLowerCase() !== txHash.toLowerCase()) {
        return NextResponse.json({ error: 'This checkout was already paid by a different transaction.' }, { status: 409 });
      }
      return NextResponse.json({ paid: true, sessionId, successUrl: `/pack/success?session_id=${encodeURIComponent(sessionId)}` });
    }
    if (row.status !== 'quoted') return NextResponse.json({ error: 'This crypto checkout is no longer active.' }, { status: 409 });

    const chainId = Number(row.chain_id);
    const rpcUrl = rpcFor(chainId);
    if (!rpcUrl) return NextResponse.json({ error: 'Unsupported crypto payment network.' }, { status: 400 });

    const provider = new JsonRpcProvider(rpcUrl, chainId);
    const [transaction, receipt] = await Promise.all([
      provider.getTransaction(txHash),
      provider.getTransactionReceipt(txHash),
    ]);
    if (!transaction || !receipt) {
      return NextResponse.json({ pending: true, error: 'Payment transaction is still confirming.' }, { status: 409 });
    }
    if (receipt.status !== 1) return NextResponse.json({ error: 'The ETH payment transaction failed.' }, { status: 402 });
    if (transaction.from.toLowerCase() !== wallet.toLowerCase()) {
      return NextResponse.json({ error: 'The ETH payment came from a different wallet.' }, { status: 403 });
    }
    if (!transaction.to || transaction.to.toLowerCase() !== RECEIVER.toLowerCase()) {
      return NextResponse.json({ error: 'The ETH payment was not sent to VoxelPop.' }, { status: 403 });
    }
    if (transaction.value < BigInt(String(row.quote_wei))) {
      return NextResponse.json({ error: 'The ETH payment amount was below the quoted $1.99 amount.' }, { status: 402 });
    }

    const block = await provider.getBlock(receipt.blockNumber);
    if (!block) return NextResponse.json({ pending: true, error: 'Waiting for payment block confirmation.' }, { status: 409 });
    const paidAt = new Date(Number(block.timestamp) * 1000);
    const expiresAt = new Date(row.quote_expires_at);
    if (paidAt.getTime() > expiresAt.getTime() + 5 * 60 * 1000) {
      await supabase.from('voxelpop_crypto_purchases').update({ status: 'expired', updated_at: new Date().toISOString() }).eq('session_id', sessionId);
      return NextResponse.json({ error: 'The ETH quote expired before this payment confirmed. Start a new quote.' }, { status: 410 });
    }

    const { data: updated, error: updateError } = await supabase
      .from('voxelpop_crypto_purchases')
      .update({ status: 'paid', tx_hash: txHash.toLowerCase(), updated_at: new Date().toISOString() })
      .eq('session_id', sessionId)
      .eq('status', 'quoted')
      .select('session_id,metadata,quote_usd_cents')
      .single();
    if (updateError) {
      if (/duplicate|unique/i.test(updateError.message || '')) {
        return NextResponse.json({ error: 'This blockchain transaction has already been used for a VoxelPop purchase.' }, { status: 409 });
      }
      throw updateError;
    }

    const metadata = (updated.metadata || {}) as Record<string, string>;
    const attribution = cleanAttribution({
      source: metadata.utm_source,
      medium: metadata.utm_medium,
      campaign: metadata.utm_campaign,
      content: metadata.utm_content,
    });
    await recordVoxelPopEvent({
      eventName: 'purchase_completed',
      eventKey: `crypto_purchase_completed:${sessionId}`,
      flowId: metadata.flow_id || null,
      attribution,
      details: {
        amount_cents: Number(updated.quote_usd_cents || 199),
        currency: 'usd',
        payment_method: 'crypto',
        chain_id: chainId,
        tx_hash: txHash.toLowerCase(),
      },
    });

    return NextResponse.json({
      paid: true,
      sessionId,
      txHash,
      successUrl: `/pack/success?session_id=${encodeURIComponent(sessionId)}`,
    });
  } catch (error) {
    console.error('VoxelPop crypto payment verification failed', error);
    return NextResponse.json({ error: 'Unable to verify the ETH payment right now.' }, { status: 500 });
  }
}
