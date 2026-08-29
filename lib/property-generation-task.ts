import { createHmac, timingSafeEqual } from 'node:crypto';

const TASK_PREFIX = 'property-voxel:task:';
const RECOVERY_PREFIX = 'property-voxel:recovery:';

function clean(value: unknown, max = 420) {
  return String(value || '').trim().slice(0, max);
}

function recoverySignature(secret: string, userId: string, providerTaskId: string) {
  return createHmac('sha256', secret)
    .update(`property-voxel-recovery-v1:${userId}:${providerTaskId}`)
    .digest('hex');
}

function signaturesMatch(left: string, right: string) {
  const a = Buffer.from(left, 'utf8');
  const b = Buffer.from(right, 'utf8');
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

export function propertyGenerationCanonicalTaskId(providerTaskId: string) {
  const raw = clean(providerTaskId, 240);
  if (!raw) throw new Error('The 3D provider did not return a task ID.');
  return raw.startsWith(TASK_PREFIX) ? raw : `${TASK_PREFIX}${raw}`;
}

export function propertyGenerationProviderTaskId(taskId: unknown) {
  const value = clean(taskId);
  if (value.startsWith(TASK_PREFIX)) return clean(value.slice(TASK_PREFIX.length), 240);
  if (!value.startsWith(RECOVERY_PREFIX)) return '';

  const packed = value.slice(RECOVERY_PREFIX.length);
  const separator = packed.indexOf('.');
  if (separator <= 0) return '';
  try {
    return clean(Buffer.from(packed.slice(0, separator), 'base64url').toString('utf8'), 240);
  } catch {
    return '';
  }
}

export function createPropertyGenerationRecoveryTaskId(secret: string, userId: string, providerTaskId: string) {
  const canonical = propertyGenerationCanonicalTaskId(providerTaskId);
  const raw = propertyGenerationProviderTaskId(canonical);
  const encoded = Buffer.from(raw, 'utf8').toString('base64url');
  return `${RECOVERY_PREFIX}${encoded}.${recoverySignature(secret, userId, raw)}`;
}

export function verifyPropertyGenerationRecoveryTaskId(secret: string, userId: string, taskId: unknown) {
  const value = clean(taskId);
  if (!value.startsWith(RECOVERY_PREFIX)) return null;

  const packed = value.slice(RECOVERY_PREFIX.length);
  const separator = packed.indexOf('.');
  if (separator <= 0) return null;
  const suppliedSignature = clean(packed.slice(separator + 1), 128);
  const providerTaskId = propertyGenerationProviderTaskId(value);
  if (!providerTaskId || !suppliedSignature) return null;

  const expectedSignature = recoverySignature(secret, userId, providerTaskId);
  return signaturesMatch(suppliedSignature, expectedSignature) ? providerTaskId : null;
}
