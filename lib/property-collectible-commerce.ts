import type Stripe from 'stripe';
import { createHash } from 'node:crypto';
import { getSupabaseAdmin } from './supabase-admin';
import { createModelSignedUrl, readCatalog3DByTask } from './catalog3dStore';
import { normalizePropertyDraftId, propertyDraftItemId } from './property-generation-ids';

const PROVIDER = 'property-collectible-reservation';
const HOLD_MINUTES = 35;

export type PropertyCollectibleState = 'reserved' | 'checkout' | 'paid' | 'minted';
export type PropertyCollectibleReservation = {
  identityKey: string; state: PropertyCollectibleState; buyerId: string; atlasId: string; address: string; draftId: string; modelTaskId: string; priceCents: number; priceTier: string; priceLabel: string; source: string; sourceId?: string; processedAt: string;
};

function clean(value: unknown, max = 300) { return String(value || '').trim().slice(0, max); }
function finite(value: unknown) { const number = Number(value); return Number.isFinite(number) ? number : 0; }
function coordinatePointCount(value: any): number {
  if (!Array.isArray(value)) return 0;
  if (value.length >= 2 && typeof value[0] === 'number' && typeof value[1] === 'number') return 1;
  return value.reduce((sum, child) => sum + coordinatePointCount(child), 0);
}
function buildingHeightMeters(building: any) {
  if (typeof building?.height === 'number') return finite(building.height);
  return finite(building?.height?.referenceHeightMeters ?? building?.height?.heightMeters ?? building?.height?.estimatedHeightMeters);
}

export function quotePropertyCollectible(building: any) {
  const footprintPoints = coordinatePointCount(building?.geometry?.coordinates);
  const heightMeters = buildingHeightMeters(building);
  const detailScore = footprintPoints + Math.round(Math.max(0, heightMeters) / 2);
  if (detailScore >= 42 || heightMeters >= 28) return { priceCents: 399, tier: 'landmark', label: 'Landmark Voxel', explanation: 'Higher digital-build complexity from the mapped footprint and height evidence.', footprintPoints, heightMeters };
  if (detailScore >= 22 || heightMeters >= 13) return { priceCents: 299, tier: 'detailed', label: 'Detailed Voxel', explanation: 'Mid-range digital-build complexity from the mapped footprint and height evidence.', footprintPoints, heightMeters };
  return { priceCents: 199, tier: 'classic', label: 'Classic Voxel', explanation: 'Standard digital-build complexity from the mapped footprint and height evidence.', footprintPoints, heightMeters };
}

export function propertyCollectibleIdentity(atlasIdRaw: unknown) {
  const atlasId = clean(atlasIdRaw, 180);
  if (!atlasId || atlasId.startsWith('location:') || atlasId.startsWith('draft:')) throw new Error('A source-backed mapped building identity is required before this digital collectible can be purchased once-only.');
  const digest = createHash('sha256').update(`voxel-pop-property-v1:${atlasId}`).digest('hex');
  return `property:${digest.slice(0, 48)}`;
}

export async function verifyOwnedFinalVoxelModel(input: { userId: string; draftId: unknown; modelTaskId: unknown }) {
  const draftId = normalizePropertyDraftId(input.draftId);
  const modelTaskId = clean(input.modelTaskId, 260);
  if (!modelTaskId) throw new Error('Finish the final voxel 3D before checkout.');
  const savedModel = await readCatalog3DByTask(modelTaskId);
  const expectedItemId = propertyDraftItemId(input.userId, draftId, 'voxel');
  if (!savedModel?.item_id || savedModel.item_id !== expectedItemId) throw new Error('That final voxel model does not belong to this signed-in creation.');
  if (savedModel.provider === 'voxel-vault-local-preview') throw new Error('This no-credit 3D is a preview only. Finish the premium final voxel 3D before paid collection.');
  if (!savedModel.model_url && !savedModel.model_storage_path) throw new Error('The final voxel model is not finished yet.');
  const modelUrl = savedModel.model_storage_path ? await createModelSignedUrl(savedModel.model_storage_path, 60 * 60) : savedModel.model_url;
  return { draftId, modelTaskId, savedModel, modelUrl: modelUrl || savedModel.model_url || null };
}

function encode(value: Omit<PropertyCollectibleReservation, 'identityKey' | 'processedAt'>) { return JSON.stringify(value); }
function decode(identityKey: string, row: any): PropertyCollectibleReservation | null {
  if (!row) return null;
  try {
    const parsed = JSON.parse(String(row.event_type || ''));
    if (!parsed?.state || !parsed?.buyerId || !parsed?.atlasId || !parsed?.priceCents) return null;
    return { identityKey, state: parsed.state, buyerId: String(parsed.buyerId), atlasId: String(parsed.atlasId), address: String(parsed.address || ''), draftId: String(parsed.draftId || ''), modelTaskId: String(parsed.modelTaskId || ''), priceCents: Number(parsed.priceCents || 0), priceTier: String(parsed.priceTier || 'classic'), priceLabel: String(parsed.priceLabel || 'Voxel property'), source: String(parsed.source || ''), sourceId: parsed.sourceId ? String(parsed.sourceId) : undefined, processedAt: String(row.processed_at || '') };
  } catch { return null; }
}
function permanent(state: PropertyCollectibleState) { return state === 'paid' || state === 'minted'; }
function expired(reservation: PropertyCollectibleReservation) {
  if (permanent(reservation.state)) return false;
  const stamp = Date.parse(reservation.processedAt || '');
  return !Number.isFinite(stamp) || Date.now() - stamp > HOLD_MINUTES * 60_000;
}

export async function readPropertyCollectibleReservation(identityKey: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('commerce_webhook_events').select('event_id,event_type,processed_at').eq('provider', PROVIDER).eq('event_id', identityKey).maybeSingle();
  if (error) throw error;
  return decode(identityKey, data);
}

export async function listPaidPropertyCollectiblesForBuyer(buyerId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('commerce_webhook_events').select('event_id,event_type,processed_at').eq('provider', PROVIDER).order('processed_at', { ascending: false }).limit(200);
  if (error) throw error;
  return (data || []).map((row: any) => decode(String(row.event_id || ''), row)).filter((item: PropertyCollectibleReservation | null) => Boolean(item && item.buyerId === buyerId && permanent(item.state)));
}

export async function acquirePropertyCollectibleReservation(input: { identityKey: string; buyerId: string; atlasId: string; address: string; draftId: string; modelTaskId: string; priceCents: number; priceTier: string; priceLabel: string; source: string; }) {
  const supabase = getSupabaseAdmin();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const existing = await readPropertyCollectibleReservation(input.identityKey);
    if (existing) {
      if (!expired(existing)) return { acquired: false, reservation: existing, sold: permanent(existing.state), reservedByYou: existing.buyerId === input.buyerId };
      const { error: deleteError } = await supabase.from('commerce_webhook_events').delete().eq('provider', PROVIDER).eq('event_id', input.identityKey).eq('processed_at', existing.processedAt);
      if (deleteError) throw deleteError;
    }
    const payload = { state: 'reserved' as const, buyerId: input.buyerId, atlasId: clean(input.atlasId, 180), address: clean(input.address, 220), draftId: normalizePropertyDraftId(input.draftId), modelTaskId: clean(input.modelTaskId, 260), priceCents: Math.max(0, Math.trunc(input.priceCents)), priceTier: clean(input.priceTier, 40), priceLabel: clean(input.priceLabel, 80), source: clean(input.source, 40) };
    const processedAt = new Date().toISOString();
    const { error: insertError } = await supabase.from('commerce_webhook_events').insert({ provider: PROVIDER, event_id: input.identityKey, event_type: encode(payload), processed_at: processedAt });
    if (!insertError) return { acquired: true, reservation: { identityKey: input.identityKey, ...payload, processedAt }, sold: false, reservedByYou: true };
    if (insertError.code !== '23505') throw insertError;
  }
  const reservation = await readPropertyCollectibleReservation(input.identityKey);
  return { acquired: false, reservation, sold: Boolean(reservation && permanent(reservation.state)), reservedByYou: Boolean(reservation && reservation.buyerId === input.buyerId) };
}

export async function updatePropertyCollectibleReservation(input: { identityKey: string; buyerId: string; state: PropertyCollectibleState; source: string; sourceId?: string; }) {
  const current = await readPropertyCollectibleReservation(input.identityKey);
  if (!current) throw new Error('Property collectible reservation is missing.');
  if (current.buyerId !== input.buyerId) throw new Error('Property collectible reservation belongs to another account.');
  if (permanent(current.state) && current.state !== input.state) throw new Error(`Property collectible is already locked in state ${current.state}.`);
  const supabase = getSupabaseAdmin();
  const next = { ...current, state: input.state, source: clean(input.source, 40), sourceId: clean(input.sourceId, 220) || current.sourceId };
  const { error } = await supabase.from('commerce_webhook_events').update({ event_type: encode({ state: next.state, buyerId: next.buyerId, atlasId: next.atlasId, address: next.address, draftId: next.draftId, modelTaskId: next.modelTaskId, priceCents: next.priceCents, priceTier: next.priceTier, priceLabel: next.priceLabel, source: next.source, sourceId: next.sourceId }), processed_at: new Date().toISOString() }).eq('provider', PROVIDER).eq('event_id', input.identityKey);
  if (error) throw error;
  return { ...next, processedAt: new Date().toISOString() };
}

export async function releasePropertyCollectibleReservation(identityKey: string, buyerId: string) {
  const current = await readPropertyCollectibleReservation(identityKey);
  if (!current || permanent(current.state) || current.buyerId !== buyerId) return false;
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('commerce_webhook_events').delete().eq('provider', PROVIDER).eq('event_id', identityKey);
  if (error) throw error;
  return true;
}

export async function secureStripePropertyCollectiblePurchase(input: { session: Stripe.Checkout.Session; expectedBuyerId?: string }) {
  const session = input.session;
  const metadata = session.metadata || {};
  if (metadata.kind !== 'property_voxel_collectible') throw new Error('This Stripe session is not a property collectible purchase.');
  if (session.payment_status !== 'paid') throw new Error('Stripe has not confirmed payment for this collectible.');
  const buyerId = clean(metadata.buyer_id, 180);
  if (!buyerId) throw new Error('The paid collectible is missing its buyer identity.');
  if (input.expectedBuyerId && buyerId !== input.expectedBuyerId) throw new Error('This paid collectible belongs to another account.');
  const identityKey = clean(metadata.identity_key, 100);
  const atlasId = clean(metadata.atlas_id, 180);
  const draftId = clean(metadata.draft_id, 100);
  const modelTaskId = clean(metadata.model_task_id, 260);
  const priceCents = Math.max(0, Math.trunc(finite(metadata.price_cents)));
  if (!identityKey || !atlasId || !draftId || !modelTaskId || !priceCents) throw new Error('Stripe collectible metadata is incomplete.');
  await verifyOwnedFinalVoxelModel({ userId: buyerId, draftId, modelTaskId });
  const reservation = await readPropertyCollectibleReservation(identityKey);
  if (!reservation) throw new Error('The collectible reservation is missing.');
  if (reservation.buyerId !== buyerId || reservation.atlasId !== atlasId || reservation.draftId !== draftId || reservation.modelTaskId !== modelTaskId || reservation.priceCents !== priceCents) throw new Error('Paid collectible metadata does not match the secured reservation.');
  return updatePropertyCollectibleReservation({ identityKey, buyerId, state: 'paid', source: 'stripe', sourceId: session.id });
}
