import { getSupabaseAdmin } from './supabase-admin';
import { readPropertyCollectibleReservation } from './property-collectible-commerce';

const PROVIDER = 'property-collectible-reservation';

function clean(value: unknown, max = 300) {
  return String(value || '').trim().slice(0, max);
}

export async function markPropertyCollectibleMinted(input: {
  identityKey: string;
  buyerId: string;
  txHash: string;
}) {
  const identityKey = clean(input.identityKey, 100);
  const buyerId = clean(input.buyerId, 100);
  const txHash = clean(input.txHash, 100);
  if (!identityKey || !buyerId || !txHash) throw new Error('Mint state details are incomplete.');

  const current = await readPropertyCollectibleReservation(identityKey);
  if (!current) throw new Error('Property collectible reservation is missing.');
  if (current.buyerId !== buyerId) throw new Error('Property collectible reservation belongs to another account.');
  if (current.state === 'minted') return current;
  if (current.state !== 'paid') throw new Error(`Property collectible is not ready to be marked minted from state ${current.state}.`);

  const payload = {
    state: 'minted' as const,
    buyerId: current.buyerId,
    atlasId: current.atlasId,
    address: current.address,
    draftId: current.draftId,
    modelTaskId: current.modelTaskId,
    priceCents: current.priceCents,
    priceTier: current.priceTier,
    priceLabel: current.priceLabel,
    source: 'base-voxel-mint',
    sourceId: txHash,
  };

  const supabase = getSupabaseAdmin();
  const processedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from('commerce_webhook_events')
    .update({ event_type: JSON.stringify(payload), processed_at: processedAt })
    .eq('provider', PROVIDER)
    .eq('event_id', identityKey)
    .eq('processed_at', current.processedAt)
    .select('event_id')
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Property collectible reservation changed concurrently.');
  return { ...current, ...payload, processedAt };
}
