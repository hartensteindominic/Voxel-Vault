import { getSupabaseAdmin } from './supabase-admin';

export async function readCatalog3D(itemId) {
  if (!itemId) return null;
  try {
    const { data, error } = await getSupabaseAdmin().from('catalog_3d_media').select('*').eq('item_id', itemId).maybeSingle();
    if (error) return null;
    return data || null;
  } catch { return null; }
}

export async function readCatalog3DByTask(taskId) {
  if (!taskId) return null;
  try {
    const { data, error } = await getSupabaseAdmin().from('catalog_3d_media').select('*').eq('task_id', taskId).maybeSingle();
    if (error) return null;
    return data || null;
  } catch { return null; }
}

export async function listCatalog3D() {
  try {
    const { data, error } = await getSupabaseAdmin().from('catalog_3d_media').select('*');
    if (error) return [];
    return data || [];
  } catch { return []; }
}

export async function saveCatalog3D(itemId, patch = {}) {
  if (!itemId) return null;
  try {
    const payload = { item_id: itemId, ...patch, updated_at: new Date().toISOString() };
    const { data, error } = await getSupabaseAdmin().from('catalog_3d_media').upsert(payload, { onConflict: 'item_id' }).select('*').single();
    if (error) return null;
    return data || null;
  } catch { return null; }
}
