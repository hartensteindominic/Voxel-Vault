import { stripe } from './stripe-server';

export type VoxelPopEntitlement = {
  id: string;
  paymentMethod: 'stripe';
  metadata: Record<string, string>;
  amountCents: number;
  currency: string;
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

export async function getVoxelPopEntitlement(sessionId: string): Promise<VoxelPopEntitlement | null> {
  if (!sessionId) return null;
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

export async function updateVoxelPopEntitlementMetadata(entitlement: VoxelPopEntitlement, patch: Record<string, string>): Promise<VoxelPopEntitlement> {
  const metadata = { ...entitlement.metadata, ...patch };
  const updated = await stripe.checkout.sessions.update(entitlement.id, { metadata });
  return { ...entitlement, metadata: cleanMetadata(updated.metadata) };
}
