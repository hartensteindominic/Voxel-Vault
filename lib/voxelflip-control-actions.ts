import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from './supabase-admin';

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const ACTIONS = new Set(['revenue_notice', 'reinvest', 'list', 'buy', 'mint', 'test']);

export type VoxelFlipControlAction = {
  id: string;
  idempotency_key: string;
  wallet?: string | null;
  action_type: string;
  status: string;
  payload: Record<string, any>;
  whatsapp_message_id?: string | null;
  expires_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export function normalizeControlPhone(value: string | undefined | null) {
  return String(value || '').replace(/\D/g, '');
}

export function controlPhoneHash(value: string) {
  return createHash('sha256').update(normalizeControlPhone(value)).digest('hex');
}

export async function controlActionsReady(admin: SupabaseClient = getSupabaseAdmin()) {
  try {
    const { error } = await admin.from('voxelflip_control_actions').select('id', { head: true, count: 'exact' });
    return { ready: !error, error: error?.message || '' };
  } catch (error) {
    return { ready: false, error: error instanceof Error ? error.message : 'control table unavailable' };
  }
}

export async function getControlAction(id: string, admin: SupabaseClient = getSupabaseAdmin()) {
  const { data, error } = await admin
    .from('voxelflip_control_actions')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`VoxelFlip control action could not be loaded: ${error.message}`);
  return data as VoxelFlipControlAction | null;
}

export async function createOrLoadControlAction(input: {
  idempotencyKey: string;
  wallet?: string | null;
  actionType: string;
  payload?: Record<string, any>;
  expiresInMinutes?: number | null;
}, admin: SupabaseClient = getSupabaseAdmin()) {
  if (!input.idempotencyKey.trim()) throw new Error('Control action idempotency key is required.');
  if (!ACTIONS.has(input.actionType)) throw new Error('Unsupported VoxelFlip control action.');
  const wallet = String(input.wallet || '').trim().toLowerCase();
  if (wallet && !ADDRESS_RE.test(wallet)) throw new Error('Control action wallet is invalid.');
  const expiresInMinutes = input.expiresInMinutes == null ? null : Math.max(1, Math.min(24 * 60, Math.floor(input.expiresInMinutes)));
  const expiresAt = expiresInMinutes ? new Date(Date.now() + expiresInMinutes * 60_000).toISOString() : null;
  const row = {
    idempotency_key: input.idempotencyKey.trim(),
    wallet: wallet || null,
    action_type: input.actionType,
    status: 'pending',
    payload: input.payload || {},
    expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await admin.from('voxelflip_control_actions').insert(row).select('*').single();
  if (!error && data) return { created: true, action: data as VoxelFlipControlAction };
  if ((error as any)?.code !== '23505') throw new Error(`VoxelFlip control action could not be created: ${error?.message || 'unknown database error'}`);
  const { data: existing, error: existingError } = await admin
    .from('voxelflip_control_actions')
    .select('*')
    .eq('idempotency_key', input.idempotencyKey.trim())
    .maybeSingle();
  if (existingError || !existing) throw new Error(`VoxelFlip control action could not be recovered: ${existingError?.message || 'missing action'}`);
  return { created: false, action: existing as VoxelFlipControlAction };
}

export async function updateControlActionDelivery(input: {
  id: string;
  status: 'pending' | 'notified' | 'failed';
  messageId?: string | null;
  error?: string;
}, admin: SupabaseClient = getSupabaseAdmin()) {
  const current = await getControlAction(input.id, admin);
  if (!current) throw new Error('VoxelFlip control action no longer exists.');
  const payload = { ...(current.payload || {}) };
  if (input.error) payload.lastDeliveryError = input.error.slice(0, 500);
  else delete payload.lastDeliveryError;
  const { data, error } = await admin
    .from('voxelflip_control_actions')
    .update({
      status: input.status,
      payload,
      whatsapp_message_id: input.messageId || current.whatsapp_message_id || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.id)
    .select('*')
    .single();
  if (error) throw new Error(`VoxelFlip control delivery could not be updated: ${error.message}`);
  return data as VoxelFlipControlAction;
}

export async function decideControlAction(input: {
  id: string;
  decision: 'approve' | 'skip';
  responderPhone: string;
}, admin: SupabaseClient = getSupabaseAdmin()) {
  const current = await getControlAction(input.id, admin);
  if (!current) return { accepted: false, reason: 'unknown', action: null };
  if (current.status !== 'pending') return { accepted: false, reason: `already-${current.status}`, action: current };
  if (current.expires_at && Date.parse(current.expires_at) <= Date.now()) {
    const { data } = await admin
      .from('voxelflip_control_actions')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('id', current.id)
      .eq('status', 'pending')
      .select('*')
      .maybeSingle();
    return { accepted: false, reason: 'expired', action: (data || current) as VoxelFlipControlAction };
  }
  const status = input.decision === 'approve' ? 'approved' : 'skipped';
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from('voxelflip_control_actions')
    .update({
      status,
      responder_hash: controlPhoneHash(input.responderPhone),
      approved_via: 'whatsapp',
      responded_at: now,
      updated_at: now,
    })
    .eq('id', current.id)
    .eq('status', 'pending')
    .select('*')
    .maybeSingle();
  if (error) throw new Error(`VoxelFlip control decision could not be saved: ${error.message}`);
  if (!data) return { accepted: false, reason: 'race-lost', action: await getControlAction(current.id, admin) };
  return { accepted: true, reason: status, action: data as VoxelFlipControlAction };
}
