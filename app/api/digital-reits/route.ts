import { NextResponse } from 'next/server';
import { getDigitalReitSnapshot } from '../../../lib/real-estate/dinari';

export const dynamic = 'force-dynamic';

export async function GET() {
  const snapshot = await getDigitalReitSnapshot(process.env);

  return NextResponse.json({
    ...snapshot,
    apiCredentialsExposed: false,
    liveOrderExecution: false,
    note: snapshot.credentialsConfigured
      ? 'Connected to the configured Dinari environment for provider-backed catalog/portfolio data. Production order execution remains code-locked.'
      : 'Add server-side Dinari sandbox credentials to activate provider-backed catalog/portfolio data. No secrets are sent to the browser.',
  });
}
