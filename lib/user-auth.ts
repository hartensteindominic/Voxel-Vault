import type { User } from '@supabase/supabase-js';
import { getSupabaseAdmin } from './supabase-admin';

function bearerToken(request: Request) {
  const header = request.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || '';
}

export type VoxelVaultUserResult =
  | { ok: true; user: User; admin: ReturnType<typeof getSupabaseAdmin> }
  | { ok: false; status: number; error: string; setupRequired?: boolean };

export async function requireVoxelVaultUser(request: Request): Promise<VoxelVaultUserResult> {
  const token = bearerToken(request);
  if (!token) return { ok: false, status: 401, error: 'Google sign-in is required to load user-bound provider holdings.' };

  let admin: ReturnType<typeof getSupabaseAdmin>;
  try {
    admin = getSupabaseAdmin();
  } catch {
    return {
      ok: false,
      status: 503,
      error: 'Server authentication is not configured for user-bound provider holdings.',
      setupRequired: true,
    };
  }

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) {
    return { ok: false, status: 401, error: 'Your Google session could not be verified. Sign in again.' };
  }

  return { ok: true, user: data.user, admin };
}
