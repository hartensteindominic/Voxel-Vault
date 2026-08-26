import { NextResponse } from 'next/server';
import { voxelforgeAuthorizationSchema } from '../../../../../lib/voxelforge-authorization';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(voxelforgeAuthorizationSchema(), {
    status: 200,
    headers: {
      'Cache-Control': 'no-store, private',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
