import { NextResponse } from 'next/server';
import { createSandboxMarketBuy, getDinariConfig } from '../../../../lib/real-estate/dinari';

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
    return NextResponse.json({ ok: false, error: 'Sandbox trade request must originate from this Voxel Vault deployment.' }, { status: 403 });
  }

  if (!config.sandboxTradingEnabled) {
    return NextResponse.json({
      ok: false,
      error: 'Dinari sandbox trading is locked. Configure sandbox credentials, account ID and DINARI_SANDBOX_ORDER_EXECUTION_ENABLED=true.',
    }, { status: 423 });
  }

  try {
    const body = await request.json();
    const order = await createSandboxMarketBuy({
      stockId: body?.stockId,
      paymentAmount: body?.paymentAmount,
    }, process.env);

    return NextResponse.json({
      ok: true,
      environment: 'sandbox',
      realMoney: false,
      order,
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || 'Sandbox order failed.' }, { status: 422 });
  }
}
