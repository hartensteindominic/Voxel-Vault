import { normalizePropertyDraftId } from './property-generation-ids';

export const PROPERTY_VOXEL_GENERATION_PRICE_CENTS = 499;
export const PROPERTY_VOXEL_GENERATION_PRICE_LABEL = '$4.99';
export const PROPERTY_VOXEL_GENERATION_KIND = 'property_voxel_generation_v1';
export const PROPERTY_VOXEL_GENERATION_ENGINE = 'voxelpop-nft-house-v1';
export const PROPERTY_VOXEL_SOURCE_HANDLING = 'provider-direct-private';

const LEGACY_GENERATION_ENGINE = 'browser-local-v1';
const LEGACY_SOURCE_HANDLING = 'device-local';

function clean(value: unknown, max = 500) {
  return String(value || '').trim().slice(0, max);
}

export async function paidPropertyGenerationReceipt(auth: any, stripe: any, sessionIdRaw: unknown) {
  const sessionId = clean(sessionIdRaw, 260);
  if (!sessionId) throw new Error('The VoxelPop payment session is missing.');
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const metadata = session?.metadata || {};
  const draftId = normalizePropertyDraftId(clean(metadata.draft_id, 100));

  if (metadata.kind !== PROPERTY_VOXEL_GENERATION_KIND) throw new Error('This payment is not for a VoxelPop 3D creation.');
  if (session.payment_status !== 'paid') throw new Error('Payment has not completed yet.');
  if (session.client_reference_id !== auth.user.id || metadata.voxelpop_user_id !== auth.user.id) {
    throw new Error('This VoxelPop purchase belongs to a different account.');
  }
  if (session.currency !== 'usd' || Number(session.amount_total || 0) !== PROPERTY_VOXEL_GENERATION_PRICE_CENTS) {
    throw new Error('The VoxelPop payment amount could not be verified.');
  }
  if (metadata.price_cents !== String(PROPERTY_VOXEL_GENERATION_PRICE_CENTS) || metadata.rights_confirmed !== 'true') {
    throw new Error('The VoxelPop creation authorization is incomplete.');
  }

  const engine = clean(metadata.generation_engine, 80);
  const sourceHandling = clean(metadata.source_storage, 80);
  const currentMode = engine === PROPERTY_VOXEL_GENERATION_ENGINE && sourceHandling === PROPERTY_VOXEL_SOURCE_HANDLING;
  const legacyMode = engine === LEGACY_GENERATION_ENGINE && sourceHandling === LEGACY_SOURCE_HANDLING;
  if (!currentMode && !legacyMode) throw new Error('This VoxelPop purchase uses an unsupported generation mode.');

  return {
    session,
    draftId,
    engine,
    sourceStorage: sourceHandling,
    legacyMode,
  };
}
