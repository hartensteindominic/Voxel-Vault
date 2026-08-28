import { NextResponse } from 'next/server';
import {
  buildDigitalAssetToPropertyPlan,
  buildPropertyOwnershipGoal,
  evaluatePropertyCashAction,
} from '../../../../lib/real-estate/property-ownership-goal.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const mode = String(body?.mode || 'goal').trim().toLowerCase();
    let result;
    if (mode === 'goal') result = buildPropertyOwnershipGoal(body);
    else if (mode === 'asset_to_property') result = buildDigitalAssetToPropertyPlan(body);
    else if (mode === 'cash_action') result = evaluatePropertyCashAction(body);
    else throw new Error('Unsupported GEO ownership-goal mode.');

    return NextResponse.json({
      ok: true,
      mode,
      result,
      legalEffects: {
        transfersFunds: false,
        purchasesSecurity: false,
        createsDeedOwnership: false,
      },
    }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'GEO goal request failed.' }, { status: 400 });
  }
}
