-- Ensure the shared Voxel Vault private storage bucket exists for property photos,
-- generated models, rental room references and other server-controlled media.
-- Idempotent and intentionally private.

insert into storage.buckets (id, name, public, file_size_limit)
values ('voxel-system', 'voxel-system', false, 78643200)
on conflict (id) do update
set public = false,
    file_size_limit = greatest(coalesce(storage.buckets.file_size_limit, 0), excluded.file_size_limit);

comment on table storage.buckets is
  'Supabase Storage buckets. Voxel Vault keeps voxel-system private and serves temporary signed URLs from server-authorized flows.';
