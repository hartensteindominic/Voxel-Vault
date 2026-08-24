import { NextResponse } from 'next/server';
import { cleanAttribution, normalizeFlowId, recordVoxelPopEvent, type VoxelPopEventName } from '../../../../lib/voxelpop-analytics';

const BROWSER_EVENTS = new Set<VoxelPopEventName>([
  'studio_view',
  'prompt_started',
  'checkout_clicked',
  'checkout_cancelled',
]);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const eventName = typeof body?.eventName === 'string' ? body.eventName as VoxelPopEventName : null;
    const flowId = normalizeFlowId(body?.flowId);
    if (!eventName || !BROWSER_EVENTS.has(eventName) || !flowId) {
      return NextResponse.json({ error: 'Invalid analytics event.' }, { status: 400 });
    }

    const promptLength = Number(body?.promptLength);
    await recordVoxelPopEvent({
      eventName,
      eventKey: `browser:${eventName}:${flowId}`,
      flowId,
      attribution: cleanAttribution(body?.attribution),
      details: Number.isFinite(promptLength)
        ? { prompt_length: Math.max(0, Math.min(600, Math.round(promptLength))) }
        : {},
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Invalid analytics request.' }, { status: 400 });
  }
}
