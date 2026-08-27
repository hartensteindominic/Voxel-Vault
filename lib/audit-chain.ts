export type AuditChainInput = {
  eventType: string;
  entityType: string;
  entityId: string;
  payload?: Record<string, unknown>;
  actorUserId?: string | null;
  sourceRef?: string | null;
};

export async function appendAuditChainEvent(supabaseAdmin: any, input: AuditChainInput) {
  if (!input.eventType?.trim() || !input.entityType?.trim() || !input.entityId?.trim()) {
    throw new Error('Audit event type, entity type, and entity id are required.');
  }
  const { data, error } = await supabaseAdmin.rpc('append_audit_chain_event', {
    p_event_type: input.eventType,
    p_entity_type: input.entityType,
    p_entity_id: input.entityId,
    p_payload: input.payload || {},
    p_actor_user_id: input.actorUserId || null,
    p_source_ref: input.sourceRef || null,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    sequence: Number(row?.sequence || 0),
    entryHash: String(row?.entry_hash || ''),
  };
}

export async function verifyAuditChain(supabaseAdmin: any) {
  const { data, error } = await supabaseAdmin.rpc('verify_audit_chain');
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    valid: row?.valid === true,
    brokenSequence: row?.broken_sequence == null ? null : Number(row.broken_sequence),
    expectedHash: row?.expected_hash || null,
    actualHash: row?.actual_hash || null,
  };
}
