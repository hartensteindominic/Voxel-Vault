import { NextResponse } from 'next/server';
import { requireVoxelVaultUser } from '../../../../lib/user-auth';
import { getDigitalReitSnapshot, getDinariConfig } from '../../../../lib/real-estate/dinari.js';
import {
  buildReadOnlyDinariEnvForBinding,
  getProviderAccountBinding,
  publicBindingSummary,
} from '../../../../lib/real-estate/provider-account-binding.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function response(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store, private' },
  });
}

export async function GET(request: Request) {
  const auth = await requireVoxelVaultUser(request);
  if ('error' in auth) {
    return response({
      ok: false,
      bound: false,
      setupRequired: Boolean(auth.setupRequired),
      error: auth.error,
    }, auth.status);
  }

  const config = getDinariConfig(process.env);

  try {
    const bindingState = await getProviderAccountBinding(auth.admin, auth.user.id, {
      provider: 'dinari',
      environment: config.environment,
    });

    if (!bindingState.binding) {
      return response({
        ok: true,
        bound: false,
        readOnly: true,
        liveOrderExecution: false,
        provider: config.provider,
        environment: config.environment,
        setupRequired: bindingState.setupRequired,
        binding: null,
        catalog: [],
        portfolio: [],
        cash: [],
        dividends: [],
        errors: bindingState.error ? [bindingState.error] : [],
        note: bindingState.setupRequired
          ? 'User-bound provider storage is not installed yet. Voxel Vault is withholding provider holdings rather than attributing a global account to this login.'
          : 'No verified provider account is bound to this Voxel Vault user. Provider holdings are intentionally withheld.',
      });
    }

    const scopedEnv = buildReadOnlyDinariEnvForBinding(bindingState.binding, process.env);
    const snapshot = await getDigitalReitSnapshot(scopedEnv);

    return response({
      ok: true,
      bound: true,
      readOnly: true,
      liveOrderExecution: false,
      binding: publicBindingSummary(bindingState.binding),
      ...snapshot,
      sandboxTradingEnabled: false,
      sandboxFaucetEnabled: false,
      productionTradingEnabled: false,
      note: 'These holdings come from the provider account verified and bound to this signed-in Voxel Vault user. This endpoint is read-only.',
    });
  } catch (error) {
    return response({
      ok: false,
      bound: false,
      readOnly: true,
      liveOrderExecution: false,
      error: error instanceof Error ? error.message : 'User-bound provider holdings could not be loaded.',
    }, 503);
  }
}
