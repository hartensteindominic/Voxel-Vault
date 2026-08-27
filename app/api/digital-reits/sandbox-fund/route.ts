import { NextResponse } from 'next/server';
import { getDinariConfig, mintSandboxFunds } from '../../../../lib/real-estate/dinari';

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
    return NextResponse.json({ ok: false, error: 'Sandbox funding request must originate from this Voxel Vault deployment.' }, { status: 403 });
  }

  if (!config.sandboxFaucetEnabled) {
    return NextResponse.json({
      ok: false,
      error: 'Dinari sandbox faucet is locked. Configure sandbox credentials, account ID and DINARI_SANDBOX_FAUCET_ENABLED=true in Preview only.',
    }, { status: 423 });
  }

  try {
    const funding = await mintSandboxFunds(process.env);
    return NextResponse.json({ ok: true, environment: 'sandbox', ...funding });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || 'Sandbox funding failed.' }, { status: 422 });
  }
}
