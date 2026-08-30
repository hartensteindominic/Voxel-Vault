import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';
import { buildGalacticAccountLifecycle } from '../../../../lib/banking/account-lifecycle.js';
import { getIncreaseSandboxOwnerRecoveryAccount } from '../../../../lib/banking/increase-sandbox-recovery.js';
import { getProviderAccountBinding } from '../../../../lib/banking/provider-account-binding.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function response(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
}

function bearerToken(request: Request) {
  const authorization = String(request.headers.get('authorization') || '');
  return authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
}

export async function GET(request: Request) {
  const token = bearerToken(request);
  if (!token) return response({ ok: false, error: 'Sign in to view your Galactic Trust account lifecycle.', lifecycle: buildGalacticAccountLifecycle({ signedIn: false, env: process.env }) }, 401);

  try {
    const admin = getSupabaseAdmin();
    const { data: { user }, error } = await admin.auth.getUser(token);
    if (error || !user) return response({ ok: false, error: 'Your Galactic Trust session is invalid or expired.', lifecycle: buildGalacticAccountLifecycle({ signedIn: false, env: process.env }) }, 401);

    let bindingState = await getProviderAccountBinding(admin, user.id, {
      provider: 'increase',
      environment: 'sandbox',
    });

    if (!bindingState.binding) {
      try {
        const recovery = await getIncreaseSandboxOwnerRecoveryAccount(user.id, process.env);
        if (recovery) {
          bindingState = {
            binding: {
              provider: 'increase',
              environment: 'sandbox',
              status: 'verified',
              kycStatus: 'SANDBOX_ACCOUNT_ONLY',
            },
            setupRequired: false,
            error: '',
          };
        }
      } catch {
        // Demo lifecycle remains available when the optional Increase sandbox lookup is unavailable.
      }
    }

    const lifecycle = buildGalacticAccountLifecycle({ signedIn: true, bindingState, env: process.env });
    return response({ ok: true, lifecycle, note: 'This lifecycle is derived server-side from verified authentication, trusted provider-binding state or owner-specific Increase sandbox recovery state, and regulated-launch locks. It is not a bank-account approval or production eligibility decision.' });
  } catch (error) {
    return response({ ok: false, error: error instanceof Error ? error.message : 'Galactic Trust account lifecycle could not be loaded.', lifecycle: buildGalacticAccountLifecycle({ signedIn: true, bindingState: { binding: null, setupRequired: true }, env: process.env }) }, 503);
  }
}
