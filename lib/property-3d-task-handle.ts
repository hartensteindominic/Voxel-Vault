import { createHmac, timingSafeEqual } from 'node:crypto';

const PREFIX = 'property-voxel:task:v1:';
const LEGACY_PREFIX = 'property-voxel:task:';

type TaskPayload = {
  providerTaskId: string;
  itemId: string;
};

function clean(value: unknown, max = 1200) {
  return String(value || '').trim().slice(0, max);
}

function payloadToken(payload: TaskPayload) {
  return Buffer.from(JSON.stringify({ p: payload.providerTaskId, i: payload.itemId }), 'utf8').toString('base64url');
}

function signature(secret: string, userId: string, token: string) {
  return createHmac('sha256', secret)
    .update(`voxel-vault-property-3d-v1:${userId}:${token}`)
    .digest();
}

function parseSignedHandle(handleRaw: unknown) {
  const handle = clean(handleRaw, 1600);
  if (!handle.startsWith(PREFIX)) return null;
  const encoded = handle.slice(PREFIX.length);
  const separator = encoded.lastIndexOf('.');
  if (separator <= 0) return null;
  const token = encoded.slice(0, separator);
  const signatureToken = encoded.slice(separator + 1);
  if (!token || !signatureToken) return null;

  try {
    const raw = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
    const providerTaskId = clean(raw?.p, 500);
    const itemId = clean(raw?.i, 500);
    if (!providerTaskId || !itemId) return null;
    return { token, signatureToken, providerTaskId, itemId };
  } catch {
    return null;
  }
}

export function createProperty3DTaskHandle(secretRaw: unknown, userIdRaw: unknown, itemIdRaw: unknown, providerTaskIdRaw: unknown) {
  const secret = clean(secretRaw, 2000);
  const userId = clean(userIdRaw, 500);
  const itemId = clean(itemIdRaw, 500);
  const providerTaskId = clean(providerTaskIdRaw, 500);
  if (!secret || !userId || !itemId || !providerTaskId) throw new Error('A secure property 3D task handle could not be created.');

  const token = payloadToken({ providerTaskId, itemId });
  const sig = signature(secret, userId, token).toString('base64url');
  return `${PREFIX}${token}.${sig}`;
}

export function verifyProperty3DTaskHandle(secretRaw: unknown, userIdRaw: unknown, handleRaw: unknown): TaskPayload | null {
  const secret = clean(secretRaw, 2000);
  const userId = clean(userIdRaw, 500);
  const parsed = parseSignedHandle(handleRaw);
  if (!secret || !userId || !parsed) return null;

  try {
    const supplied = Buffer.from(parsed.signatureToken, 'base64url');
    const expected = signature(secret, userId, parsed.token);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
    return { providerTaskId: parsed.providerTaskId, itemId: parsed.itemId };
  } catch {
    return null;
  }
}

export function property3DProviderTaskId(handleRaw: unknown) {
  const handle = clean(handleRaw, 1600);
  const parsed = parseSignedHandle(handle);
  if (parsed) return parsed.providerTaskId;
  return handle.startsWith(LEGACY_PREFIX) ? handle.slice(LEGACY_PREFIX.length) : handle;
}
