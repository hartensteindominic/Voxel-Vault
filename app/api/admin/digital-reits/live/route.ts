import { NextResponse } from 'next/server';
import { requireVoxelVaultAdmin } from '../../../../../lib/admin-auth';
import {
  getDigitalReitSnapshot,
  getDinariConfig,
  inspectLiveDinariAccount,
} from '../../../../../lib/real-estate/dinari.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function response(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store, private' },
  });
}

export async function GET(request: Request) {
  const auth = await requireVoxelVaultAdmin(request);
  if ('error' in auth) return response({ ok: false, error: auth.error, setupRequired: Boolean(auth.setupRequired) }, auth.status);

  const config = getDinariConfig(process.env);
  const snapshot = await getDigitalReitSnapshot(process.env);
  let providerAccount = null;
  let providerAccountError = '';

  if (config.environment === 'live' && config.credentialsConfigured && config.entityConfigured && config.accountConfigured) {
    try {
      providerAccount = await inspectLiveDinariAccount(process.env);
    } catch (error) {
      providerAccountError = error instanceof Error ? error.message : 'Live provider account verification failed.';
    }
  }

  return response({
    ok: true,
    authorized: true,
    ownerUserId: auth.user.id,
    live: {
      environment: config.environment,
      implementationReady: snapshot.productionTradingImplementationReady,
      tradingEnabledByConfiguration: config.productionTradingEnabled,
      orderMaxUsd: snapshot.liveOrderMaxUsd,
      readinessBlockers: snapshot.productionReadinessBlockers,
      disclosureVersion: snapshot.disclosureVersion,
      disclosurePageUrl: snapshot.disclosurePageUrl,
      providerAccount,
      providerAccountError,
      executable: Boolean(config.productionTradingEnabled && providerAccount?.ready),
    },
    catalog: snapshot.catalog,
    portfolio: snapshot.portfolio,
    cash: snapshot.cash,
    dividends: snapshot.dividends,
    errors: snapshot.errors,
  });
}
