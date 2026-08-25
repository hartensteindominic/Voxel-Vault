import { stripe } from './stripe-server';
import { getSupabaseAdmin } from './supabase-admin';

export type VoxelPopEntitlement = {
  id: string;
  paymentMethod: 'stripe' | 'crypto';
  metadata: Record<string, string>;
  amountCents: number;
  currency: string;
  wallet?: string | null;
  txHash?: string | null;
  chainId?: number | null;
};

function cleanMetadata(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (typeof item === 'string') out[key] = item;
    else if (item != null && ['number', 'boolean'].includes(typeof item)) out[key] = String(item);
  }
  return out;
}

export function isCryptoVoxelPopSession(sessionId: string) {
  return /^vfc_[0-9a-f-]{36}$/i.test(sessionId || '');
}

export async function getVoxelPopEntitlement(sessionId: string): Promise<VoxelPopEntitlement | null> {
  if (!sessionId) return null;

  if (isCryptoVoxelPopSession(sessionId)) {
    const { data, error } = await getSupabaseAdmin()
      .from('voxelpop_crypto_purchases')
      .select('session_id,wallet,tx_hash,chain_id,status,quote_usd_cents,metadata')
      .eq('session_id', sessionId)
      .maybeSingle();
    if (error || !data || data.status !== 'paid') return null;
    const metadata = cleanMetadata(data.metadata);
    if (metadata.product !== 'voxelpop-3d-asset') return null;
    return {
      id: data.session_id,
      paymentMethod: 'crypto',
      metadata,
      amountCents: Number(data.quote_usd_cents || 199),
      currency: 'usd',
      wallet: data.wallet || null,
      txHash: data.tx_hash || null,
      chainId: Number(data.chain_id || 0) || null,
    };
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid' || session.metadata?.product !== 'voxelpop-3d-asset') return null;
    return {
      id: session.id,
      paymentMethod: 'stripe',
      metadata: cleanMetadata(session.metadata),
      amountCents: Number(session.amount_total || 0),
      currency: session.currency || 'usd',
    };
  } catch {
    return null;
  }
}

export async function updateVoxelPopEntitlementMetadata(
  entitlement: VoxelPopEntitlement,
  patch: Record<string, string>,
): Promise<VoxelPopEntitlement> {
  const metadata = { ...entitlement.metadata, ...patch };
  if (entitlement.paymentMethod === 'stripe') {
    const updated = await stripe.checkout.sessions.update(entitlement.id, { metadata });
    return { ...entitlement, metadata: cleanMetadata(updated.metadata) };
  }

  const { data, error } = await getSupabaseAdmin()
    .from('voxelpop_crypto_purchases')
    .update({ metadata, updated_at: new Date().toISOString() })
    .eq('session_id', entitlement.id)
    .eq('status', 'paid')
    .select('metadata')
    .single();
  if (error) throw error;
  return { ...entitlement, metadata: cleanMetadata(data?.metadata || metadata) };
}
