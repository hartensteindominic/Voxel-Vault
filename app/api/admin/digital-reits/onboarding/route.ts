import { NextResponse } from 'next/server';
import { requireVoxelVaultAdmin } from '../../../../../lib/admin-auth';
import {
  createDinariManagedKyc,
  createDinariSandboxAccount,
  createDinariSandboxEntity,
  getDinariOnboardingSnapshot,
} from '../../../../../lib/real-estate/dinari-onboarding';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function response(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store, private' } });
}

export async function GET(request: Request) {
  const auth = await requireVoxelVaultAdmin(request);
  if (!auth.ok) return response({ error: auth.error, setupRequired: Boolean(auth.setupRequired) }, auth.status);

  const url = new URL(request.url);
  const selectedEntityId = String(url.searchParams.get('entityId') || '').trim();
  try {
    const snapshot = await getDinariOnboardingSnapshot({ selectedEntityId });
    return response({ authorized: true, ...snapshot });
  } catch (error) {
    return response({ error: error instanceof Error ? error.message : 'Dinari onboarding status failed.' }, 503);
  }
}

export async function POST(request: Request) {
  const auth = await requireVoxelVaultAdmin(request);
  if (!auth.ok) return response({ error: auth.error, setupRequired: Boolean(auth.setupRequired) }, auth.status);

  const body = await request.json().catch(() => ({}));
  const action = String(body?.action || '').trim();

  try {
    if (action === 'create-entity') {
      const entity = await createDinariSandboxEntity({
        name: body?.name,
        referenceId: body?.referenceId,
      });
      const snapshot = await getDinariOnboardingSnapshot({ selectedEntityId: entity.id });
      return response({ authorized: true, action, entity, snapshot });
    }

    if (action === 'create-managed-kyc') {
      const kyc = await createDinariManagedKyc({
        entity: body?.entityId,
        jurisdiction: body?.jurisdiction,
      });
      return response({ authorized: true, action, kyc });
    }

    if (action === 'create-account') {
      const result = await createDinariSandboxAccount({
        entity: body?.entityId,
        jurisdiction: body?.jurisdiction,
      });
      const snapshot = await getDinariOnboardingSnapshot({ selectedEntityId: body?.entityId });
      return response({ authorized: true, action, ...result, snapshot });
    }

    return response({ error: 'Unsupported Dinari onboarding action.' }, 400);
  } catch (error) {
    return response({ error: error instanceof Error ? error.message : 'Dinari onboarding action failed.' }, 400);
  }
}
