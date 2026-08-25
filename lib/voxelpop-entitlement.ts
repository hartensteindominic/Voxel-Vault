import { stripe } from './stripe-server';
import { readCryptoPurchase, updateCryptoPurchase } from './voxelpop-crypto-store';

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
    const row = await readCryptoPurchase(sessionId);
    if (!row || row.status !== 'paid') return null;
    const metadata = cleanMetadata(row.metadata);
    if (metadata.product !== 'voxelpop-3d-asset') return null;
    return {
      id: row.session_id,
      paymentMethod: 'crypto',
      metadata,
      amountCents: Number(row.quote_usd_cents || 199),
      currency: 'usd',
      wallet: row.wallet || null,
      txHash: row.tx_hash || null,
      chainId: Number(row.chain_id || 0) || null,
    };
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid' || session.metadata?.product !== 'voxelpop-3d-asset') return null;
    return { id: session.id, paymentMethod: 'stripe', metadata: cleanMetadata(session.metadata), amountCents: Number(session.amount_total || 0), currency: session.currency || 'usd' };
  } catch { return null; }
}

export async function updateVoxelPopEntitlementMetadata(entitlement: VoxelPopEntitlement, patch: Record<string, string>): Promise<VoxelPopEntitlement> {
  const metadata = { ...entitlement.metadata, ...patch };
  if (entitlement.paymentMethod === 'stripe') {
    const updated = await stripe.checkout.sessions.update(entitlement.id, { metadata });
    return { ...entitlement, metadata: cleanMetadata(updated.metadata) };
  }
  const updated = await updateCryptoPurchase(entitlement.id, { metadata });
  return { ...entitlement, metadata: cleanMetadata(updated.metadata) };
}
