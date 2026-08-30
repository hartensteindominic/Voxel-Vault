import { NextResponse } from 'next/server';
import {
  bankingLaunchSnapshot,
  galacticTrustPublicBoundary,
} from '../../../../lib/banking/regulated-launch.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const snapshot = bankingLaunchSnapshot(process.env);

  return NextResponse.json(
    {
      policyVersion: snapshot.policyVersion,
      status: snapshot.status,
      liveBankingEnabled: snapshot.liveBankingEnabled,
      liveCryptoEnabled: snapshot.liveCryptoEnabled,
      providerConfigured: snapshot.providerConfigured,
      sponsorBankNamed: snapshot.sponsorBankNamed,
      disclosures: galacticTrustPublicBoundary,
      requirements: snapshot.gates.map(({ gate, label, authority, asserted }) => ({
        gate,
        label,
        authority,
        asserted,
      })),
    },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
      },
    },
  );
}
