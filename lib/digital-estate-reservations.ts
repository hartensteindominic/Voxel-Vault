import { getSupabaseAdmin } from './supabase-admin';

const PROVIDER = 'digital-estate-reservation';
const HOLD_MINUTES = 30;

export type EstateReservationState = 'reserved' | 'checkout' | 'paid' | 'paid-usdc' | 'minted';
export type EstateReservation = {
  estateId: string;
  state: EstateReservationState;
  buyerId: string;
  wallet: string;
  source: string;
  sourceId?: string;
  processedAt: string;
};

function encode(value: Omit<EstateReservation, 'estateId' | 'processedAt'>) {
  return JSON.stringify(value);
}

function decode(estateId: string, row: any): EstateReservation | null {
  if (!row) return null;
  try {
    const parsed = JSON.parse(String(row.event_type || ''));
    if (!parsed?.state || !parsed?.buyerId || parsed?.wallet === undefined || parsed?.wallet === null) return null;
    return {
      estateId,
      state: parsed.state,
      buyerId: String(parsed.buyerId),
      wallet: String(parsed.wallet || '').toLowerCase(),
      source: String(parsed.source || ''),
      sourceId: parsed.sourceId ? String(parsed.sourceId) : undefined,
      processedAt: String(row.processed_at || ''),
    };
  } catch {
    return null;
  }
}

function isPermanent(state: EstateReservationState) {
  return ['paid', 'paid-usdc', 'minted'].includes(state);
}

function isExpired(reservation: EstateReservation) {
  if (isPermanent(reservation.state)) return false;
  if (reservation.state === 'checkout') return false;
  const stamp = Date.parse(reservation.processedAt || '');
  return !Number.isFinite(stamp) || Date.now() - stamp > HOLD_MINUTES * 60_000;
}

export async function readDigitalEstateReservation(estateId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('commerce_webhook_events')
    .select('event_id,event_type,processed_at')
    .eq('provider', PROVIDER)
    .eq('event_id', estateId)
    .maybeSingle();
  if (error) throw error;
  return decode(estateId, data);
}

export async function acquireDigitalEstateReservation({
  estateId,
  buyerId,
  wallet = '',
  source,
}: {
  estateId: string;
  buyerId: string;
  wallet?: string;
  source: string;
}) {
  const supabase = getSupabaseAdmin();
  const normalizedWallet = String(wallet || '').toLowerCase();

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const existing = await readDigitalEstateReservation(estateId);
    if (existing) {
      if (!isExpired(existing)) {
        return {
          acquired: false,
          reservation: existing,
          sold: isPermanent(existing.state),
          reservedByYou: existing.buyerId === buyerId && existing.wallet === normalizedWallet,
        };
      }
      const { error: deleteError } = await supabase
        .from('commerce_webhook_events')
        .delete()
        .eq('provider', PROVIDER)
        .eq('event_id', estateId)
        .eq('processed_at', existing.processedAt);
      if (deleteError) throw deleteError;
    }

    const payload = {
      state: 'reserved' as const,
      buyerId,
      wallet: normalizedWallet,
      source,
    };
    const processedAt = new Date().toISOString();
    const { error: insertError } = await supabase.from('commerce_webhook_events').insert({
      provider: PROVIDER,
      event_id: estateId,
      event_type: encode(payload),
      processed_at: processedAt,
    });
    if (!insertError) {
      return {
        acquired: true,
        reservation: { estateId, ...payload, processedAt },
        sold: false,
        reservedByYou: true,
      };
    }
    if (insertError.code !== '23505') throw insertError;
  }

  const reservation = await readDigitalEstateReservation(estateId);
  return {
    acquired: false,
    reservation,
    sold: Boolean(reservation && isPermanent(reservation.state)),
    reservedByYou: Boolean(reservation && reservation.buyerId === buyerId && reservation.wallet === normalizedWallet),
  };
}

export async function updateDigitalEstateReservation({
  estateId,
  buyerId,
  wallet = '',
  state,
  source,
  sourceId,
}: {
  estateId: string;
  buyerId: string;
  wallet?: string;
  state: EstateReservationState;
  source: string;
  sourceId?: string;
}) {
  const current = await readDigitalEstateReservation(estateId);
  const normalizedWallet = String(wallet || '').toLowerCase();
  if (!current) throw new Error('Digital estate reservation is missing.');
  if (current.buyerId !== buyerId || current.wallet !== normalizedWallet) {
    throw new Error('Digital estate reservation belongs to another buyer or wallet.');
  }
  if (isPermanent(current.state) && current.state !== state) {
    throw new Error(`Digital estate is already locked in state ${current.state}.`);
  }

  const supabase = getSupabaseAdmin();
  const payload = { state, buyerId, wallet: normalizedWallet, source, ...(sourceId ? { sourceId } : {}) };
  const previous = encode({
    state: current.state,
    buyerId: current.buyerId,
    wallet: current.wallet,
    source: current.source,
    ...(current.sourceId ? { sourceId: current.sourceId } : {}),
  });
  const { data, error } = await supabase
    .from('commerce_webhook_events')
    .update({ event_type: encode(payload), processed_at: new Date().toISOString() })
    .eq('provider', PROVIDER)
    .eq('event_id', estateId)
    .eq('event_type', previous)
    .select('event_id')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Digital estate reservation changed concurrently.');
  return { estateId, ...payload };
}

export async function bindDigitalEstateReservationWallet({
  estateId,
  buyerId,
  wallet,
}: {
  estateId: string;
  buyerId: string;
  wallet: string;
}) {
  const normalizedWallet = String(wallet || '').toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(normalizedWallet)) throw new Error('A valid EVM wallet is required.');
  const current = await readDigitalEstateReservation(estateId);
  if (!current || current.buyerId !== buyerId || !isPermanent(current.state)) {
    throw new Error('Only the owner of a secured purchase can bind its mint wallet.');
  }
  if (current.wallet) {
    if (current.wallet !== normalizedWallet) throw new Error('This purchase is already bound to a different wallet.');
    return current;
  }

  const previous = encode({
    state: current.state,
    buyerId: current.buyerId,
    wallet: current.wallet,
    source: current.source,
    ...(current.sourceId ? { sourceId: current.sourceId } : {}),
  });
  const next = encode({
    state: current.state,
    buyerId: current.buyerId,
    wallet: normalizedWallet,
    source: current.source,
    ...(current.sourceId ? { sourceId: current.sourceId } : {}),
  });
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('commerce_webhook_events')
    .update({ event_type: next, processed_at: new Date().toISOString() })
    .eq('provider', PROVIDER)
    .eq('event_id', estateId)
    .eq('event_type', previous)
    .select('event_id')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Digital estate wallet binding changed concurrently.');
  return { ...current, wallet: normalizedWallet };
}

export async function releaseDigitalEstateReservation({ estateId, buyerId, wallet = '' }: { estateId: string; buyerId: string; wallet?: string }) {
  const current = await readDigitalEstateReservation(estateId);
  const normalizedWallet = String(wallet || '').toLowerCase();
  if (!current || isPermanent(current.state)) return false;
  if (current.buyerId !== buyerId || current.wallet !== normalizedWallet) return false;
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('commerce_webhook_events')
    .delete()
    .eq('provider', PROVIDER)
    .eq('event_id', estateId)
    .eq('event_type', encode({
      state: current.state,
      buyerId: current.buyerId,
      wallet: current.wallet,
      source: current.source,
      ...(current.sourceId ? { sourceId: current.sourceId } : {}),
    }));
  if (error) throw error;
  return true;
}

export const DIGITAL_ESTATE_RESERVATION_PROVIDER = PROVIDER;
