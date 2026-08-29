import { createHmac, timingSafeEqual } from 'node:crypto';

function clean(value: unknown, max = 520) {
  return String(value || '').trim().slice(0, max);
}

function signaturesMatch(left: string, right: string) {
  const a = Buffer.from(left, 'utf8');
  const b = Buffer.from(right, 'utf8');
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

export function propertyGenerationModelToken(secret: string, taskId: unknown) {
  const canonicalTaskId = clean(taskId);
  if (!canonicalTaskId) throw new Error('A 3D task ID is required.');
  return createHmac('sha256', secret)
    .update(`property-voxel-model-v1:${canonicalTaskId}`)
    .digest('hex');
}

export function verifyPropertyGenerationModelToken(secret: string, taskId: unknown, token: unknown) {
  const canonicalTaskId = clean(taskId);
  const supplied = clean(token, 128);
  if (!canonicalTaskId || !supplied) return false;
  return signaturesMatch(supplied, propertyGenerationModelToken(secret, canonicalTaskId));
}

export function propertyGenerationModelUrl(secret: string, taskId: unknown) {
  const canonicalTaskId = clean(taskId);
  if (!canonicalTaskId) return null;
  const token = propertyGenerationModelToken(secret, canonicalTaskId);
  return `/api/property-voxel-model?taskId=${encodeURIComponent(canonicalTaskId)}&token=${encodeURIComponent(token)}`;
}
