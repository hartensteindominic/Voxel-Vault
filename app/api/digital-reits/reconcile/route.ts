import { NextResponse } from 'next/server';
import { getDigitalRealEstatePortfolio, getDinariConfig } from '../../../../lib/real-estate/dinari';
import { reconcileDigitalReitPosition } from '../../../../lib/real-estate/reconciliation';

export const dynamic = 'force-dynamic';

function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  return origin === new URL(request.url).origin;
}

export async function POST(request: Request) {
  const config = getDinariConfig(process.env);

  if (config.environment !== 'sandbox') {
    return NextResponse.json({ ok: false, error: 'Live Dinari environments are not accepted by this route.' }, { status: 423 });
  }

  if (!sameOrigin(request)) {
    return NextResponse.json({ ok: false, error: 'Reconciliation must originate from this Voxel Vault deployment.' }, { status: 403 });
  }

  if (!config.credentialsConfigured || !config.accountConfigured) {
    return NextResponse.json({ ok: false, error: 'Dinari sandbox credentials and account ID are required for reconciliation.' }, { status: 423 });
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

    return NextResponse.json({
      ok: true,
      environment: 'sandbox',
      realMoney: false,
      reconciliation,
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || 'Sandbox reconciliation failed.' }, { status: 422 });
  }
}
