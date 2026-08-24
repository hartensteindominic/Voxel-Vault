import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../../lib/supabase-admin';

const FUNNEL = [
  'studio_view',
  'checkout_clicked',
  'checkout_started',
  'purchase_completed',
  'image_generated',
  'mesh_completed',
  'glb_downloaded',
] as const;

function authorized(request: Request) {
  const secret = process.env.VOXELPOP_ANALYTICS_SECRET || process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get('authorization') === `Bearer ${secret}`);
}

function buildStages(counts: Record<string, number>) {
  return FUNNEL.map((eventName, index) => {
    const count = Number(counts[eventName] || 0);
    const previousCount = index === 0 ? null : Number(counts[FUNNEL[index - 1]] || 0);
    return {
      event: eventName,
      count,
      conversionFromPrevious: previousCount && previousCount > 0
        ? Math.round((count / previousCount) * 1000) / 10
        : null,
    };
  });
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const requestedDays = Number(url.searchParams.get('days') || 30);
  const days = Math.max(1, Math.min(90, Number.isFinite(requestedDays) ? Math.round(requestedDays) : 30));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc('voxelpop_funnel_summary', { since_at: since });

    if (!error) {
      const counts = Object.fromEntries((data || []).map((row: { event_name: string; event_count: number | string }) => [
        row.event_name,
        Number(row.event_count || 0),
      ])) as Record<string, number>;

      return NextResponse.json({
        days,
        since,
        counts,
        stages: buildStages(counts),
        storageMode: 'rich',
        attributionAvailable: true,
        updatedAt: new Date().toISOString(),
      });
    }

    console.warn('VoxelPop rich analytics summary unavailable; using fallback', error.message);
    const fallbackCounts: Record<string, number> = {};
    for (const eventName of FUNNEL) {
      const { count, error: countError } = await supabase
        .from('commerce_webhook_events')
        .select('*', { count: 'exact', head: true })
        .eq('provider', 'voxelpop')
        .eq('event_type', eventName)
        .gte('processed_at', since);
      if (countError) throw countError;
      fallbackCounts[eventName] = Number(count || 0);
    }

    return NextResponse.json({
      days,
      since,
      counts: fallbackCounts,
      stages: buildStages(fallbackCounts),
      storageMode: 'fallback',
      attributionAvailable: false,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('VoxelPop analytics summary failed', error);
    return NextResponse.json({ error: 'Analytics summary unavailable.' }, { status: 500 });
  }
}
