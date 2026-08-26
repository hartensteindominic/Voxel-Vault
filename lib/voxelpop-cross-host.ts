import type { AccountVoxel } from './voxelpop-account';

const HOSTS = new Set(['voxelvault.io', 'www.voxelvault.io']);

function randomNonce() {
  try {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

function validRecords(value: unknown): AccountVoxel[] {
  if (!Array.isArray(value)) return [];
  return value.filter((record: any) => Boolean(record?.sessionId && record?.payload?.asset?.dataUrl));
}

export async function loadAlternateHostVoxels(timeoutMs = 3000): Promise<AccountVoxel[]> {
  if (typeof window === 'undefined' || !HOSTS.has(window.location.hostname)) return [];

  const alternateHost = window.location.hostname === 'www.voxelvault.io' ? 'voxelvault.io' : 'www.voxelvault.io';
  const alternateOrigin = `${window.location.protocol}//${alternateHost}`;
  if (alternateOrigin === window.location.origin) return [];

  const nonce = randomNonce();
  return await new Promise<AccountVoxel[]>(resolve => {
    let settled = false;
    let timer = 0;
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.tabIndex = -1;
    iframe.style.position = 'fixed';
    iframe.style.width = '1px';
    iframe.style.height = '1px';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    iframe.style.border = '0';

    const cleanup = () => {
      window.removeEventListener('message', onMessage);
      iframe.remove();
    };
    const finish = (records: AccountVoxel[]) => {
      if (settled) return;
      settled = true;
      if (timer) window.clearTimeout(timer);
      cleanup();
      resolve(records);
    };
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== alternateOrigin) return;
      if (event.data?.type !== 'VOXELPOP_LIBRARY_BRIDGE' || event.data?.nonce !== nonce) return;
      finish(validRecords(event.data.records));
    };

    window.addEventListener('message', onMessage);
    timer = window.setTimeout(() => finish([]), timeoutMs);
    const query = new URLSearchParams({ parent_origin: window.location.origin, nonce });
    iframe.src = `${alternateOrigin}/forge/library-bridge?${query.toString()}`;
    document.body.appendChild(iframe);
  });
}
