import { NextResponse } from 'next/server';
import { requireVoxelVaultUser } from '../../../../../lib/user-auth';
import { countVoxelMakerGenerations, getVoxelMakerEntitlement } from '../../../../../lib/voxel-maker-subscriptions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requireVoxelVaultUser(request);
  if (auth.ok === false) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  try {
    const entitlement = await getVoxelMakerEntitlement(auth.user.id);
    const used = entitlement.active ? await countVoxelMakerGenerations(auth.user.id) : 0;
    const limit = entitlement.plan?.monthlyVoxels || 0;
    return NextResponse.json({
      ok: true,
      active: entitlement.active,
      plan: entitlement.plan,
      status: entitlement.record?.status || 'none',
      cancelAtPeriodEnd: Boolean(entitlement.record?.cancelAtPeriodEnd),
      currentPeriodEnd: entitlement.record?.currentPeriodEnd || null,
      usage: { used, limit, remaining: Math.max(0, limit - used) },
      canManageBilling: Boolean(entitlement.record?.stripeCustomerId),
    }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Subscription status is unavailable.' }, { status: 500 });
  }
}
