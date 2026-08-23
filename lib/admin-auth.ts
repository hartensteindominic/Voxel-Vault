import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from './supabase-admin';

function allowlist(name: string) {
  return new Set((process.env[name] || '').split(',').map((value) => value.trim().toLowerCase()).filter(Boolean));
}

export async function requireVaultAdmin(request: Request) {
  const ids = allowlist('VAULT_ADMIN_USER_IDS');
  const emails = allowlist('VAULT_ADMIN_EMAILS');
  if (ids.size === 0 && emails.size === 0) {
    return { response: NextResponse.json({ error: 'Vault admin access is not configured.' }, { status: 503 }) } as const;
  }
  const authorization = request.headers.get('authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
  if (!token) return { response: NextResponse.json({ error: 'Authentication required.' }, { status: 401 }) } as const;
  const supabase = getSupabaseAdmin();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return { response: NextResponse.json({ error: 'Authentication required.' }, { status: 401 }) } as const;
  if (!ids.has(user.id.toLowerCase()) && !emails.has((user.email || '').toLowerCase())) return { response: NextResponse.json({ error: 'Vault administrator access required.' }, { status: 403 }) } as const;
  return { supabase, user } as const;
}
