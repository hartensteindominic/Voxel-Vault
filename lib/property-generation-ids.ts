import { createHash } from 'node:crypto';

export type PropertyGenerationPhase = 'source' | 'voxel';

function clean(value: unknown, max = 180) {
  return String(value || '').trim().slice(0, max);
}

export function propertyGenerationUserScope(userId: string) {
  return createHash('sha256').update(`voxel-vault-property-draft:${userId}`).digest('hex').slice(0, 24);
}

export function normalizePropertyDraftId(input: unknown) {
  const value = clean(input, 100);
  if (!value || !/^[a-zA-Z0-9._:-]+$/.test(value)) throw new Error('A valid property creation ID is required.');
  return value;
}

export function normalizePropertyGenerationPhase(input: unknown): PropertyGenerationPhase {
  return clean(input, 20).toLowerCase() === 'source' ? 'source' : 'voxel';
}

export function propertyDraftItemId(userId: string, draftId: string, phase: PropertyGenerationPhase) {
  return `property-create:${propertyGenerationUserScope(userId)}:${normalizePropertyDraftId(draftId)}:${phase}`;
}

export function propertyDraftItemPrefix(userId: string) {
  return `property-create:${propertyGenerationUserScope(userId)}:`;
}

export function propertyLegacyItemId(userId: string, atlasId: string) {
  return `property-voxel:${propertyGenerationUserScope(userId)}:${atlasId}`;
}

export function propertyLegacyItemPrefix(userId: string) {
  return `property-voxel:${propertyGenerationUserScope(userId)}:`;
}

export function propertyGenerationItemBelongsToUser(userId: string, itemId: unknown) {
  const value = String(itemId || '');
  return value.startsWith(propertyDraftItemPrefix(userId)) || value.startsWith(propertyLegacyItemPrefix(userId));
}
