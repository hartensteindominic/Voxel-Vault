import { NextResponse } from 'next/server';
import { scanBaseLiquidity } from '../../../../lib/base-liquidity-scanner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await scanBaseLiquidity({
      widthMultiples: body?.widthMultiples,
      requireFlashblocks: body?.requireFlashblocks !== false,
    });
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Liquidity scan failed.',
    }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
