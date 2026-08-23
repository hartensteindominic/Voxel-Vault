-- Durable model storage metadata for server-prebuilt collectibles.
-- Safe to apply after 007/008; idempotent by design.

alter table public.catalog_3d_media
  add column if not exists source_image_urls jsonb,
  add column if not exists model_storage_path text;

create index if not exists catalog_3d_media_model_storage_idx
  on public.catalog_3d_media(model_storage_path)
  where model_storage_path is not null;

comment on column public.catalog_3d_media.source_image_urls is
  'Ordered supplier reference images used for reconstruction.';
comment on column public.catalog_3d_media.model_storage_path is
  'Private Supabase Storage path for the durable GLB copy.';
