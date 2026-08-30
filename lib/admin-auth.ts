import type { User } from '@supabase/supabase-js';
import { getSupabaseAdmin } from './supabase-admin';

function csv(value: string | undefined) {
  return String(value || '').split(',').map(item => item.trim()).filter(Boolean);
}

function firstConfigured(...values: Array<string | undefined>) {
  return values.find(value => String(value || '').trim()) || '';
}

function bearerToken(request: Request) {
  const header = request.headers.get('authorization') || '';
  return header.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || '';
}

export type GalacticTrustAdminResult =
  | { ok: true; user: User; admin: ReturnType<typeof getSupabaseAdmin> }
  | { ok: false; status: number; error: string; setupRequired?: boolean };

export async function requireGalacticTrustAdmin(request: Request): Promise<GalacticTrustAdminResult> {
  const token = bearerToken(request);
  if (!token) return { ok: false, status: 401, error: 'Google sign-in is required for this Galactic Trust owner-only page.' };

  let admin: ReturnType<typeof getSupabaseAdmin>;
  try {
    admin = getSupabaseAdmin();
  } catch {
    return { ok: false, status: 503, error: 'Server authentication is not configured yet. Add SUPABASE_URL plus SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) to Vercel, then redeploy.', setupRequired: true };
  }

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return { ok: false, status: 401, error: 'Your Google session could not be verified. Sign in again.' };

  // Galactic Trust names are canonical. The VOXEL_VAULT aliases are temporary deployment compatibility only.
  const configuredEmails = firstConfigured(
    process.env.GALACTIC_TRUST_ADMIN_EMAILS,
    process.env.GALACTIC_TRUST_ADMIN_EMAIL,
    process.env.GALACTIC_TRUST_OWNER_EMAILS,
    process.env.GALACTIC_TRUST_OWNER_EMAIL,
    process.env.VOXEL_VAULT_ADMIN_EMAILS,
    process.env.VOXEL_VAULT_ADMIN_EMAIL,
    process.env.VOXEL_VAULT_OWNER_EMAILS,
    process.env.VOXEL_VAULT_OWNER_EMAIL,
  );
  const configuredIds = firstConfigured(
    process.env.GALACTIC_TRUST_ADMIN_USER_IDS,
    process.env.GALACTIC_TRUST_ADMIN_USER_ID,
    process.env.GALACTIC_TRUST_OWNER_USER_IDS,
    process.env.GALACTIC_TRUST_OWNER_USER_ID,
    process.env.VOXEL_VAULT_ADMIN_USER_IDS,
    process.env.VOXEL_VAULT_ADMIN_USER_ID,
    process.env.VOXEL_VAULT_OWNER_USER_IDS,
    process.env.VOXEL_VAULT_OWNER_USER_ID,
  );

  const allowedEmails = new Set(csv(configuredEmails).map(value => value.toLowerCase()));
  const allowedIds = new Set(csv(configuredIds));
  if (!allowedEmails.size && !allowedIds.size) {
    const environment = String(process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown');
    return { ok: false, status: 503, error: `Galactic Trust owner tools are locked because no admin allowlist is visible to the ${environment} deployment. Add GALACTIC_TRUST_ADMIN_EMAILS (or GALACTIC_TRUST_ADMIN_USER_IDS), then redeploy.`, setupRequired: true };
  }

  const email = String(data.user.email || '').trim().toLowerCase();
  const allowed = allowedIds.has(data.user.id) || (Boolean(email) && allowedEmails.has(email));
  if (!allowed) return { ok: false, status: 403, error: 'This Google account is not authorized for Galactic Trust owner tools.' };
  return { ok: true, user: data.user, admin };
}
