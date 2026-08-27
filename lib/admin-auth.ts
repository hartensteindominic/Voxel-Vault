import type { User } from '@supabase/supabase-js';
import { getSupabaseAdmin } from './supabase-admin';

function csv(value: string | undefined) {
  return String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function bearerToken(request: Request) {
  const header = request.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || '';
}

export type VoxelVaultAdminResult =
  | { ok: true; user: User; admin: ReturnType<typeof getSupabaseAdmin> }
  | { ok: false; status: number; error: string; setupRequired?: boolean };

export async function requireVoxelVaultAdmin(request: Request): Promise<VoxelVaultAdminResult> {
  const token = bearerToken(request);
  if (!token) return { ok: false, status: 401, error: 'Google sign-in is required for this owner-only page.' };

  let admin: ReturnType<typeof getSupabaseAdmin>;
  try {
    admin = getSupabaseAdmin();
  } catch {
    return { ok: false, status: 503, error: 'Server authentication is not configured yet.', setupRequired: true };
  }

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return { ok: false, status: 401, error: 'Your Google session could not be verified. Sign in again.' };

  const allowedEmails = new Set(
    csv(process.env.VOXEL_VAULT_ADMIN_EMAILS || process.env.NEURAL_CORE_ADMIN_EMAILS).map(value => value.toLowerCase())
  );
  const allowedIds = new Set(csv(process.env.VOXEL_VAULT_ADMIN_USER_IDS || process.env.NEURAL_CORE_ADMIN_USER_IDS));

  if (!allowedEmails.size && !allowedIds.size) {
    return {
      ok: false,
      status: 503,
      error: 'Owner tools are locked until an admin allowlist is configured.',
      setupRequired: true,
    };
  }

  const email = String(data.user.email || '').toLowerCase();
  const allowed = allowedIds.has(data.user.id) || (Boolean(email) && allowedEmails.has(email));
  if (!allowed) return { ok: false, status: 403, error: 'This Google account is not authorized for owner tools.' };

  return { ok: true, user: data.user, admin };
}
