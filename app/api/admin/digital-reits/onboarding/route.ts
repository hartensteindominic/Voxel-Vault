import { NextResponse } from 'next/server';
import { requireVoxelVaultAdmin } from '../../../../../lib/admin-auth';
import { getDinariConfig } from '../../../../../lib/real-estate/dinari.js';
import {
  createDinariManagedKyc,
  createDinariSandboxAccount,
  createDinariSandboxEntity,
  getDinariOnboardingSnapshot,
} from '../../../../../lib/real-estate/dinari-onboarding';
import {
  bindDinariSandboxAccount,
  getProviderAccountBinding,
  publicBindingSummary,
} from '../../../../../lib/real-estate/provider-account-binding.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function response(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store, private' } });
}

const createEntity = createDinariSandboxEntity as (input: { name: string; referenceId?: string }) => Promise<any>;
const createManagedKyc = createDinariManagedKyc as (input: { entity: string; jurisdiction?: 'US' | 'BASELINE' }) => Promise<any>;
const createAccount = createDinariSandboxAccount as (input: { entity: string; jurisdiction?: 'US' | 'BASELINE' }) => Promise<any>;
const bindSandboxAccount = bindDinariSandboxAccount as (
  admin: any,
  userId: string,
  input: { entityId: string; accountId: string; kycStatus?: string; source?: string }
) => Promise<any>;

async function bindingState(admin: any, userId: string) {
  const config = getDinariConfig(process.env);
  const state = await getProviderAccountBinding(admin, userId, {
    provider: 'dinari',
    environment: config.environment,
  });
  return {
    providerBinding: publicBindingSummary(state.binding),
    providerBindingSetupRequired: Boolean(state.setupRequired),
    providerBindingError: state.error || '',
  };
}

async function bindVerifiedAccount(admin: any, userId: string, entityId: string, accountId: string) {
  try {
    const binding = await bindSandboxAccount(admin, userId, {
      entityId,
      accountId,
      kycStatus: 'PASS',
      source: 'provider-onboarding',
    });
    return {
      bindingStored: true,
      binding: publicBindingSummary(binding),
      bindingError: '',
    };
  } catch (error) {
    return {
      bindingStored: false,
      binding: null,
      bindingError: error instanceof Error ? error.message : 'Provider account could not be bound to this Voxel Vault identity.',
    };
  }
}

export async function GET(request: Request) {
  const auth = await requireVoxelVaultAdmin(request);
  if ('error' in auth) return response({ error: auth.error, setupRequired: Boolean(auth.setupRequired) }, auth.status);

  const url = new URL(request.url);
  const selectedEntityId = String(url.searchParams.get('entityId') || '').trim();
  try {
    const [snapshot, binding] = await Promise.all([
      getDinariOnboardingSnapshot({ selectedEntityId }),
      bindingState(auth.admin, auth.user.id),
    ]);
    return response({ authorized: true, ...snapshot, ...binding });
  } catch (error) {
    return response({ error: error instanceof Error ? error.message : 'Dinari onboarding status failed.' }, 503);
  }
}

export async function POST(request: Request) {
  const auth = await requireVoxelVaultAdmin(request);
  if ('error' in auth) return response({ error: auth.error, setupRequired: Boolean(auth.setupRequired) }, auth.status);

  const body = await request.json().catch(() => ({}));
  const action = String(body?.action || '').trim();

  try {
    if (action === 'create-entity') {
      const entity = await createEntity({
        name: String(body?.name || ''),
        referenceId: String(body?.referenceId || ''),
      });
      const [snapshot, binding] = await Promise.all([
        getDinariOnboardingSnapshot({ selectedEntityId: entity.id }),
        bindingState(auth.admin, auth.user.id),
      ]);
      return response({ authorized: true, action, entity, snapshot: { ...snapshot, ...binding } });
    }

    if (action === 'create-managed-kyc') {
      const kyc = await createManagedKyc({
        entity: String(body?.entityId || ''),
        jurisdiction: body?.jurisdiction === 'BASELINE' ? 'BASELINE' : 'US',
      });
      return response({ authorized: true, action, kyc });
    }

    if (action === 'create-account') {
      const entityId = String(body?.entityId || '');
      const result = await createAccount({
        entity: entityId,
        jurisdiction: body?.jurisdiction === 'BASELINE' ? 'BASELINE' : 'US',
      });

      const bindingResult = await bindVerifiedAccount(auth.admin, auth.user.id, entityId, String(result.account?.id || ''));
      const snapshot = await getDinariOnboardingSnapshot({ selectedEntityId: entityId });
      const currentBinding = await bindingState(auth.admin, auth.user.id);

      return response({
        authorized: true,
        action,
        ...result,
        ...bindingResult,
        snapshot: { ...snapshot, ...currentBinding },
      });
    }

    if (action === 'bind-account') {
      const entityId = String(body?.entityId || '').trim();
      const snapshot = await getDinariOnboardingSnapshot({ selectedEntityId: entityId });
      const kycStatus = String(snapshot?.kyc?.status || '').trim().toUpperCase();
      const kycPassed = snapshot?.entity?.isKycComplete === true && kycStatus === 'PASS';
      if (!kycPassed) {
        return response({ error: `Dinari KYC must be PASS before an account can be bound. Current status: ${kycStatus || 'UNKNOWN'}.` }, 409);
      }

      const account = (snapshot.accounts || []).find((candidate: any) => candidate?.isActive && candidate?.jurisdiction === 'US');
      if (!account?.id) {
        return response({ error: 'No active US sandbox Account was returned by Dinari for this verified Entity.' }, 409);
      }

      const bindingResult = await bindVerifiedAccount(auth.admin, auth.user.id, String(snapshot.entity?.id || entityId), String(account.id));
      if (!bindingResult.bindingStored) {
        return response({
          authorized: true,
          action,
          account,
          ...bindingResult,
          snapshot: { ...snapshot, ...(await bindingState(auth.admin, auth.user.id)) },
        });
      }

      return response({
        authorized: true,
        action,
        account,
        ...bindingResult,
        snapshot: { ...snapshot, ...(await bindingState(auth.admin, auth.user.id)) },
      });
    }

    return response({ error: 'Unsupported Dinari onboarding action.' }, 400);
  } catch (error) {
    return response({ error: error instanceof Error ? error.message : 'Dinari onboarding action failed.' }, 400);
  }
}
