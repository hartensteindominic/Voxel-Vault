import { createHmac, timingSafeEqual } from 'node:crypto';
import { createModelSignedUrl, readCatalog3DByTask } from './catalog3dStore';
import { readPropertyCollectibleReservation } from './property-collectible-commerce';

function clean(value: unknown, max = 300) {
  return String(value || '').trim().slice(0, max);
}

function signingSecret() {
  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secret) throw new Error('Paid collectible model access is not configured on this deployment.');
  return secret;
}

function payload(identityKey: string, modelTaskId: string) {
  return `property-collectible-model-v1:${identityKey}:${modelTaskId}`;
}

export function createPropertyCollectibleModelToken(identityKeyRaw: unknown, modelTaskIdRaw: unknown) {
  const identityKey = clean(identityKeyRaw, 100);
  const modelTaskId = clean(modelTaskIdRaw, 260);
  if (!identityKey || !modelTaskId) throw new Error('Paid collectible model identity is incomplete.');
  return createHmac('sha256', signingSecret()).update(payload(identityKey, modelTaskId)).digest('hex');
}

export function propertyCollectibleModelAccessPath(identityKeyRaw: unknown, modelTaskIdRaw: unknown) {
  const identityKey = clean(identityKeyRaw, 100);
  const modelTaskId = clean(modelTaskIdRaw, 260);
  const token = createPropertyCollectibleModelToken(identityKey, modelTaskId);
  const query = new URLSearchParams({ identity: identityKey, taskId: modelTaskId, token });
  return `/api/property-collectible/model?${query.toString()}`;
}

function tokenMatches(expected: string, suppliedRaw: unknown) {
  const supplied = clean(suppliedRaw, 128);
  if (!/^[a-f0-9]{64}$/i.test(supplied)) return false;
  const expectedBytes = Buffer.from(expected, 'hex');
  const suppliedBytes = Buffer.from(supplied, 'hex');
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}

export async function resolvePaidPropertyCollectibleModel(input: {
  identityKey: unknown;
  modelTaskId: unknown;
  token: unknown;
}) {
  const identityKey = clean(input.identityKey, 100);
  const modelTaskId = clean(input.modelTaskId, 260);
  if (!identityKey || !modelTaskId) throw new Error('Paid collectible model identity is incomplete.');
  const expected = createPropertyCollectibleModelToken(identityKey, modelTaskId);
  if (!tokenMatches(expected, input.token)) throw new Error('Paid collectible model link is invalid.');

  const reservation = await readPropertyCollectibleReservation(identityKey);
  if (!reservation || !['paid', 'minted'].includes(reservation.state)) throw new Error('This digital collectible is not paid and available.');
  if (reservation.modelTaskId !== modelTaskId) throw new Error('Paid collectible model does not match this purchase.');

  const saved = await readCatalog3DByTask(modelTaskId);
  if (!saved || (!saved.model_storage_path && !saved.model_url)) throw new Error('The persisted collectible model is unavailable.');
  const signed = saved.model_storage_path ? await createModelSignedUrl(saved.model_storage_path, 5 * 60) : null;
  const modelUrl = signed || saved.model_url || null;
  if (!modelUrl) throw new Error('The persisted collectible model could not be opened.');
  return { reservation, saved, modelUrl };
}
