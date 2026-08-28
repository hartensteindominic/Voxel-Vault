import { NextResponse } from 'next/server';
import { getDinariConfig, getDigitalReitSnapshot } from '../../../lib/real-estate/dinari';

export const dynamic = 'force-dynamic';

export async function GET() {
  const config = getDinariConfig(process.env);
  const publicAccountDataAllowed = config.environment !== 'live';
  const snapshot = await getDigitalReitSnapshot(process.env, {
    includeAccountData: publicAccountDataAllowed,
  });

  return NextResponse.json({
    ...snapshot,
    apiCredentialsExposed: false,
    liveOrderExecution: false,
    liveAccountDataPublic: false,
    note: config.environment === 'live'
      ? 'Live provider catalog may be shown publicly, but live account cash, holdings, dividends and order execution are owner-authenticated and are not returned by this endpoint.'
      : snapshot.credentialsConfigured
        ? 'Connected to the configured Dinari sandbox for provider-backed pilot catalog/portfolio data. Live order execution is not exposed by this public endpoint.'
        : 'Add server-side Dinari sandbox credentials to activate provider-backed pilot data. No secrets are sent to the browser.',
  });
}
