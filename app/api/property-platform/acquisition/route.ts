import { NextResponse } from 'next/server';
import {
  acquisitionPolicy,
  evaluateTokenizedRealEstateAccess,
} from '../../../../lib/real-estate/acquisition-engine';

export const dynamic = 'force-dynamic';

export async function GET() {
  const tokenized = evaluateTokenizedRealEstateAccess(process.env);

  return NextResponse.json({
    product: 'Voxel Vault Real Estate Acquisition Engine',
    policyVersion: acquisitionPolicy.version,
    rankingGoal: acquisitionPolicy.rankingGoal,
    modes: acquisitionPolicy.allowedModes,
    execution: {
      directPropertyPurchase: false,
      tokenizedSecurityTrading: tokenized.liveTradingEnabled,
      automatedSpending: false,
      deedTransferOnchain: false,
      officialTitleClosingRequired: true,
    },
    tokenizedProvider: {
      mode: tokenized.mode,
      liveTradingEnabled: tokenized.liveTradingEnabled,
      missing: tokenized.missing,
    },
    capabilities: {
      allInBasisModel: true,
      netRentModel: true,
      diligenceHardStops: true,
      candidateRanking: true,
      capitalLadder: true,
      regulatedProviderReadiness: true,
      unattendedAcquisition: false,
    },
    note: 'V1 is research, simulation and diligence only. A ranked property is not an authorization to buy. Direct acquisitions require a real title/closing workflow and explicit human approval; securities execution requires an approved regulated-provider integration.',
  }, { headers: { 'Cache-Control': 'no-store' } });
}
