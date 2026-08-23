export const SYNC_VERSION = 4;
export const TASK_TTL_MS = 45 * 60 * 1000;
export const MODEL_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const key = (kind, id) => `voxel:3d:v${SYNC_VERSION}:${kind}:${id}`;
const inFlightChecks = new Map();

function parse(value) {
  try { return value ? JSON.parse(value) : null; } catch { return null; }
}

export function readModel(id) {
  try {
    const value = parse(window.localStorage.getItem(key('model', id)));
    if (!value?.url) return null;
    if (value.savedAt && Date.now() - value.savedAt > MODEL_TTL_MS) {
      window.localStorage.removeItem(key('model', id));
      return null;
    }
    return value;
  } catch { return null; }
}

export function writeModel(id, payload) {
  const value = { ...payload, savedAt: Date.now() };
  try { window.localStorage.setItem(key('model', id), JSON.stringify(value)); } catch {}
  publish(id, { type: 'model-ready', ...value });
  return value;
}

export function readTask(id) {
  try {
    const value = parse(window.localStorage.getItem(key('task', id)));
    if (!value?.taskId) return null;
    if (value.startedAt && Date.now() - value.startedAt > TASK_TTL_MS) {
      window.localStorage.removeItem(key('task', id));
      return null;
    }
    return value;
  } catch { return null; }
}

export function writeTask(id, payload) {
  const value = { ...payload, startedAt: payload.startedAt || Date.now(), updatedAt: Date.now() };
  try { window.localStorage.setItem(key('task', id), JSON.stringify(value)); } catch {}
  publish(id, { type: 'task-update', ...value });
  return value;
}

export function clearTask(id) {
  try { window.localStorage.removeItem(key('task', id)); } catch {}
  publish(id, { type: 'task-cleared' });
}

export function clearModel(id) {
  try { window.localStorage.removeItem(key('model', id)); } catch {}
}

export async function prime3D(item) {
  if (typeof window === 'undefined' || !item?.id || item?.modelUri || item?.digitalTwin?.modelUrl) return null;
  const cached = readModel(item.id);
  if (cached?.url) {
    try { fetch(cached.url, { cache: 'force-cache', mode: 'cors' }).catch(() => {}); } catch {}
    return { status: 'ready', ...cached };
  }
  if (inFlightChecks.has(item.id)) return inFlightChecks.get(item.id);

  const request = fetch(`/api/catalog-3d?itemId=${encodeURIComponent(item.id)}`, { cache: 'no-store' })
    .then(async response => {
      const data = response.ok ? await response.json() : null;
      if (data?.modelUrl) {
        try { fetch(data.modelUrl, { cache: 'force-cache', mode: 'cors' }).catch(() => {}); } catch {}
        return writeModel(item.id, { url: data.modelUrl, provider: 'server-prebuilt', thumbnailUrl: data.thumbnailUrl || '' });
      }
      if (data?.taskId) return writeTask(item.id, { taskId: data.taskId, progress: Number(data.progress || 0), status: data.status || 'PENDING', serverOwned: true });
      return { status: 'queued' };
    })
    .finally(() => inFlightChecks.delete(item.id));

  inFlightChecks.set(item.id, request);
  return request;
}

function channelName(id) { return `voxel-3d-sync:${id}`; }

export function publish(id, message) {
  try {
    const channel = new BroadcastChannel(channelName(id));
    channel.postMessage({ ...message, at: Date.now() });
    channel.close();
  } catch {}
}

export function subscribe(id, handler) {
  try {
    const channel = new BroadcastChannel(channelName(id));
    channel.onmessage = event => handler(event.data || {});
    return () => channel.close();
  } catch { return () => {}; }
}

export function pollDelay(attempt = 0) {
  return Math.min(8500, 2200 + attempt * 800);
}
