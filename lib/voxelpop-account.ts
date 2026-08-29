import type { SupabaseClient, User } from '@supabase/supabase-js';

export type VoxelPayload = {
  asset?: { name?: string; dataUrl?: string } | null;
  mesh?: { status?: string; progress?: number; taskId?: string; modelUrl?: string; error?: string } | null;
  mint?: {
    tokenId?: string | number;
    owner?: string;
    hash?: string;
    txHash?: string;
    metadataUrl?: string;
    openSeaUrl?: string;
    explorerUrl?: string;
  } | null;
  generationsLeft?: number;
  updatedAt?: string;
};

export type AccountVoxel = {
  sessionId: string;
  payload: VoxelPayload;
  updatedAt: string;
};

const voxelStoragePrefix = 'voxelpop:';

export function voxelAccountConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

function validRecord(value: unknown): value is AccountVoxel {
  if (!value || typeof value !== 'object') return false;
  const record = value as AccountVoxel;
  return Boolean(record.sessionId && record.payload?.asset?.dataUrl);
}

function timestamp(value: unknown) {
  const date = typeof value === 'string' ? Date.parse(value) : Number.NaN;
  return Number.isFinite(date) ? date : 0;
}

function meshIsReady(payload: VoxelPayload) {
  const mesh = payload.mesh;
  const status = String(mesh?.status || '').toLowerCase();
  return Boolean(
    status === 'ready' ||
    status === 'succeeded' ||
    status === 'completed' ||
    String(mesh?.modelUrl || '').trim() ||
    Number(mesh?.progress || 0) >= 100
  );
}

function normalizeRecord(record: AccountVoxel): AccountVoxel {
  if (!meshIsReady(record.payload)) return record;
  return {
    ...record,
    payload: {
      ...record.payload,
      mesh: {
        ...(record.payload.mesh || {}),
        status: 'ready',
        progress: 100,
      },
    },
  };
}

function mintIsConfirmed(payload: VoxelPayload) {
  return payload.mint?.tokenId !== undefined && payload.mint?.tokenId !== null && String(payload.mint.tokenId) !== '';
}

function mergeSameAsset(previous: AccountVoxel, incoming: AccountVoxel) {
  const incomingIsNewer = timestamp(incoming.updatedAt) >= timestamp(previous.updatedAt);
  const newer = incomingIsNewer ? incoming : previous;
  const older = incomingIsNewer ? previous : incoming;

  const newerMeshReady = meshIsReady(newer.payload);
  const olderMeshReady = meshIsReady(older.payload);
  const chosenMesh = newerMeshReady || !olderMeshReady ? newer.payload.mesh : older.payload.mesh;
  const mesh = meshIsReady({ mesh: chosenMesh })
    ? { ...(chosenMesh || {}), status: 'ready', progress: 100 }
    : chosenMesh;

  const newerMinted = mintIsConfirmed(newer.payload);
  const olderMinted = mintIsConfirmed(older.payload);
  const mint = newerMinted || !olderMinted ? newer.payload.mint : older.payload.mint;

  return {
    ...newer,
    payload: {
      ...newer.payload,
      mesh,
      mint,
      updatedAt: newer.payload.updatedAt || newer.updatedAt,
    },
  } satisfies AccountVoxel;
}

export function mergeVoxelRecords(...groups: AccountVoxel[][]) {
  const map = new Map<string, AccountVoxel>();
  for (const group of groups) {
    for (const rawRecord of group) {
      if (!validRecord(rawRecord)) continue;
      const record = normalizeRecord(rawRecord);
      const previous = map.get(record.sessionId);
      if (!previous) {
        map.set(record.sessionId, record);
        continue;
      }

      const sameAsset = previous.payload.asset?.dataUrl === record.payload.asset?.dataUrl;
      if (sameAsset) {
        map.set(record.sessionId, mergeSameAsset(previous, record));
      } else if (timestamp(record.updatedAt) >= timestamp(previous.updatedAt)) {
        map.set(record.sessionId, record);
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => timestamp(b.updatedAt) - timestamp(a.updatedAt));
}

export function readLocalVoxelRecords(): AccountVoxel[] {
  if (typeof window === 'undefined') return [];
  const found: AccountVoxel[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i) || '';
      if (!key.startsWith(voxelStoragePrefix)) continue;
      const sessionId = key.slice(voxelStoragePrefix.length);
      if (!sessionId) continue;
      try {
        const parsed = JSON.parse(window.localStorage.getItem(key) || '{}') as VoxelPayload;
        if (!parsed?.asset?.dataUrl) continue;
        found.push(normalizeRecord({ sessionId, payload: parsed, updatedAt: parsed.updatedAt || new Date(0).toISOString() }));
      } catch {}
    }
  } catch {}
  return found;
}

export function summarizeVoxel(record: AccountVoxel) {
  const normalized = normalizeRecord(record);
  return {
    sessionId: normalized.sessionId,
    name: String(normalized.payload.asset?.name || 'Your voxel'),
    image: String(normalized.payload.asset?.dataUrl || ''),
    modelUrl: String(normalized.payload.mesh?.modelUrl || ''),
    meshStatus: String(normalized.payload.mesh?.status || 'idle'),
    mint: normalized.payload.mint || null,
  };
}

function googleDisplayName(user: User) {
  const metadata = user.user_metadata || {};
  return String(metadata.full_name || metadata.name || user.email || 'VoxelPop creator').slice(0, 50);
}

function generatedHandle(user: User) {
  return `vv_${user.id.replaceAll('-', '').slice(0, 12)}`.toLowerCase();
}

async function readProfile(supabase: SupabaseClient, user: User) {
  const { data, error } = await supabase
    .from('vault_profiles')
    .select('user_id,handle,display_name,bio,avatar_style')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw new Error(`Account storage is unavailable: ${error.message}`);
  return data;
}

function profileLibrary(profile: any): AccountVoxel[] {
  const raw = profile?.avatar_style?.voxelpop_library;
  return Array.isArray(raw) ? raw.filter(validRecord).map(normalizeRecord) : [];
}

async function writeProfileLibrary(supabase: SupabaseClient, user: User, profile: any, library: AccountVoxel[]) {
  const currentStyle = profile?.avatar_style && typeof profile.avatar_style === 'object' ? profile.avatar_style : {};
  const { error } = await supabase.from('vault_profiles').upsert({
    user_id: user.id,
    handle: profile?.handle || generatedHandle(user),
    display_name: profile?.display_name || googleDisplayName(user),
    bio: profile?.bio || '',
    avatar_style: { ...currentStyle, voxelpop_library: library },
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`Could not save My Voxels to your account: ${error.message}`);
}

export async function loadAccountVoxels(supabase: SupabaseClient, user: User) {
  const profile = await readProfile(supabase, user);
  return profileLibrary(profile);
}

export async function syncLocalVoxelsToAccount(supabase: SupabaseClient, user: User) {
  const profile = await readProfile(supabase, user);
  const cloud = profileLibrary(profile);
  const local = readLocalVoxelRecords();
  const merged = mergeVoxelRecords(cloud, local);
  await writeProfileLibrary(supabase, user, profile, merged);
  return merged;
}

export async function saveVoxelToAccount(supabase: SupabaseClient, user: User, sessionId: string, payload: VoxelPayload) {
  if (!sessionId || !payload?.asset?.dataUrl) return [];
  const profile = await readProfile(supabase, user);
  const cloud = profileLibrary(profile);
  const updatedAt = payload.updatedAt || new Date().toISOString();
  const merged = mergeVoxelRecords(cloud, [{ sessionId, payload: { ...payload, updatedAt }, updatedAt }]);
  await writeProfileLibrary(supabase, user, profile, merged);
  return merged;
}

export async function loadAccountVoxel(supabase: SupabaseClient, user: User, sessionId: string) {
  const library = await loadAccountVoxels(supabase, user);
  return library.find(record => record.sessionId === sessionId) || null;
}
