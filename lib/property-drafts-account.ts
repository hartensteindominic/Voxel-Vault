import type { SupabaseClient, User } from '@supabase/supabase-js';
import { mergePropertyDraftRecords, readPropertyDrafts, replaceLocalPropertyDrafts } from './property-drafts';

export type PropertyDraft = {
  id: string;
  type?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
};

function googleDisplayName(user: User) {
  const metadata = user.user_metadata || {};
  return String(metadata.full_name || metadata.name || user.email || 'Voxel Vault user').slice(0, 50);
}

function generatedHandle(user: User) {
  return `vv_${user.id.replaceAll('-', '').slice(0, 12)}`.toLowerCase();
}

function validDraft(value: unknown): value is PropertyDraft {
  if (!value || typeof value !== 'object') return false;
  const draft = value as PropertyDraft;
  return Boolean(draft.id && draft.type === 'voxel-vault-property-3d-draft');
}

async function readProfile(supabase: SupabaseClient, user: User) {
  const { data, error } = await supabase
    .from('vault_profiles')
    .select('user_id,handle,display_name,bio,avatar_style')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw new Error(`Property draft account storage is unavailable: ${error.message}`);
  return data;
}

function profileDraftLibrary(profile: any): PropertyDraft[] {
  const raw = profile?.avatar_style?.property_draft_library;
  return Array.isArray(raw) ? raw.filter(validDraft) : [];
}

async function writeProfileDraftLibrary(
  supabase: SupabaseClient,
  user: User,
  profile: any,
  library: PropertyDraft[],
) {
  const currentStyle = profile?.avatar_style && typeof profile.avatar_style === 'object' ? profile.avatar_style : {};
  const bounded = mergePropertyDraftRecords(library);
  const { error } = await supabase.from('vault_profiles').upsert({
    user_id: user.id,
    handle: profile?.handle || generatedHandle(user),
    display_name: profile?.display_name || googleDisplayName(user),
    bio: profile?.bio || '',
    avatar_style: { ...currentStyle, property_draft_library: bounded },
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`Could not save 3D property drafts to your account: ${error.message}`);
  return bounded;
}

export async function loadAccountPropertyDrafts(supabase: SupabaseClient, user: User) {
  const profile = await readProfile(supabase, user);
  return profileDraftLibrary(profile);
}

export async function syncLocalPropertyDraftsToAccount(supabase: SupabaseClient, user: User) {
  const profile = await readProfile(supabase, user);
  const cloud = profileDraftLibrary(profile);
  const local = readPropertyDrafts();
  const merged = mergePropertyDraftRecords(cloud, local);
  await writeProfileDraftLibrary(supabase, user, profile, merged);
  replaceLocalPropertyDrafts(merged);
  return merged;
}

export async function savePropertyDraftToAccount(supabase: SupabaseClient, user: User, draft: PropertyDraft) {
  if (!validDraft(draft)) return [];
  const profile = await readProfile(supabase, user);
  const cloud = profileDraftLibrary(profile);
  const merged = mergePropertyDraftRecords(cloud, [draft]);
  await writeProfileDraftLibrary(supabase, user, profile, merged);
  return merged;
}

export async function deletePropertyDraftFromAccount(supabase: SupabaseClient, user: User, draftId: string) {
  if (!draftId) return [];
  const profile = await readProfile(supabase, user);
  const cloud = profileDraftLibrary(profile).filter((draft) => draft.id !== draftId);
  const saved = await writeProfileDraftLibrary(supabase, user, profile, cloud);
  return saved;
}
