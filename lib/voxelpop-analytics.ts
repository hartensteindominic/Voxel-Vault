import { getSupabaseAdmin } from './supabase-admin';

export const VOXELPOP_EVENT_NAMES = [
  'studio_view',
  'prompt_started',
  'checkout_clicked',
  'checkout_started',
  'checkout_cancelled',
  'purchase_completed',
  'image_generation_started',
  'image_generated',
  'image_generation_failed',
  'mesh_started',
  'mesh_completed',
  'mesh_failed',
  'glb_downloaded',
] as const;

export type VoxelPopEventName = (typeof VOXELPOP_EVENT_NAMES)[number];
export type VoxelPopAttribution = {
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  content?: string | null;
};

type VoxelPopEventDetails = Record<string, string | number | boolean | null>;

const FLOW_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cleanText(value: unknown, maxLength = 120) {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim().slice(0, maxLength);
  return cleaned || null;
}

export function normalizeFlowId(value: unknown) {
  const candidate = cleanText(value, 64);
  return candidate && FLOW_ID_RE.test(candidate) ? candidate.toLowerCase() : null;
}

export function cleanAttribution(input: VoxelPopAttribution | null | undefined): VoxelPopAttribution {
  return {
    source: cleanText(input?.source, 100),
    medium: cleanText(input?.medium, 100),
    campaign: cleanText(input?.campaign, 140),
    content: cleanText(input?.content, 140),
  };
}

export function attributionFromMetadata(metadata: Record<string, string> | null | undefined): VoxelPopAttribution {
  return cleanAttribution({
    source: metadata?.utm_source,
    medium: metadata?.utm_medium,
    campaign: metadata?.utm_campaign,
    content: metadata?.utm_content,
  });
}

export async function recordVoxelPopEvent(input: {
  eventName: VoxelPopEventName;
  eventKey: string;
  flowId?: string | null;
  stripeSessionId?: string | null;
  stripeEventId?: string | null;
  attribution?: VoxelPopAttribution | null;
  details?: VoxelPopEventDetails;
}) {
  const eventKey = cleanText(input.eventKey, 180);
  if (!eventKey) return false;
  const attribution = cleanAttribution(input.attribution);

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('voxelpop_conversion_events').upsert({
      event_name: input.eventName,
      event_key: eventKey,
      flow_id: normalizeFlowId(input.flowId),
      stripe_session_id: cleanText(input.stripeSessionId, 180),
      stripe_event_id: cleanText(input.stripeEventId, 180),
      source: attribution.source || null,
      medium: attribution.medium || null,
      campaign: attribution.campaign || null,
      content: attribution.content || null,
      details: input.details || {},
    }, { onConflict: 'event_key', ignoreDuplicates: true });
    if (error) throw error;
    return true;
  } catch (error) {
    // Analytics must never break checkout, generation, meshing, or downloads.
    console.error('VoxelPop conversion event failed', input.eventName, error);
    return false;
  }
}
