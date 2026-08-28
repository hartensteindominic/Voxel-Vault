import { NextResponse } from 'next/server';
import { getDigitalRealEstatePortfolio, getDinariConfig } from '../../../../lib/real-estate/dinari';
import { reconcileDigitalReitPosition } from '../../../../lib/real-estate/reconciliation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function sameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  return origin === new URL(request.url).origin;
}

function noStoreJson(body, init) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  return response;
}

export async function POST(request) {
  const config = getDinariConfig(process.env);

  if (config.environment !== 'sandbox') {
    return noStoreJson({ ok: false, error: 'Live Dinari environments are not accepted by this route.' }, { status: 423 });
  }

  if (!sameOrigin(request)) {
    return noStoreJson({ ok: false, error: 'Reconciliation must originate from this Voxel Vault deployment.' }, { status: 403 });
  }

  if (!config.credentialsConfigured || !config.accountConfigured) {
    return noStoreJson({ ok: false, error: 'Dinari sandbox credentials and account ID are required for reconciliation.' }, { status: 423 });
  }

  try {
    const body = await request.json();
    const portfolio = await getDigitalRealEstatePortfolio(process.env);
    const reconciliation = reconcileDigitalReitPosition({
      stockId: body?.stockId,
      symbol: body?.symbol,
      previousAmount: body?.previousAmount,
      portfolio,
    });

    return noStoreJson({
      ok: true,
      environment: 'sandbox',
      realMoney: false,
      reconciliation,
    });
  } catch (error) {
    return noStoreJson({ ok: false, error: error?.message || 'Sandbox reconciliation failed.' }, { status: 422 });
  }
}
