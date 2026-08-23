-- Idempotent hardening for the server-prebuilt collectible pipeline.
-- Safe to run whether or not 007_catalog_3d_media.sql has already been applied.

create table if not exists public.catalog_3d_media (
  item_id text primary key,
  supplier_sku text,
  task_id text unique,
  source_image_url text,
  model_url text,
  thumbnail_url text,
  provider text not null default 'meshy',
  status text not null default 'pending',
  progress integer not null default 0,
  exact_model_approved boolean not null default false,
  error text,
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.catalog_3d_media add column if not exists supplier_sku text;
alter table public.catalog_3d_media add column if not exists task_id text;
alter table public.catalog_3d_media add column if not exists source_image_url text;
alter table public.catalog_3d_media add column if not exists model_url text;
alter table public.catalog_3d_media add column if not exists thumbnail_url text;
alter table public.catalog_3d_media add column if not exists provider text not null default 'meshy';
alter table public.catalog_3d_media add column if not exists status text not null default 'pending';
alter table public.catalog_3d_media add column if not exists progress integer not null default 0;
alter table public.catalog_3d_media add column if not exists exact_model_approved boolean not null default false;
alter table public.catalog_3d_media add column if not exists error text;
alter table public.catalog_3d_media add column if not exists started_at timestamptz;
alter table public.catalog_3d_media add column if not exists completed_at timestamptz;
alter table public.catalog_3d_media add column if not exists updated_at timestamptz not null default now();

create unique index if not exists catalog_3d_media_task_unique_idx on public.catalog_3d_media(task_id) where task_id is not null;
create index if not exists catalog_3d_media_status_idx on public.catalog_3d_media(status, updated_at);

alter table public.catalog_3d_media enable row level security;
drop policy if exists "catalog 3d media is publicly readable" on public.catalog_3d_media;
create policy "catalog 3d media is publicly readable"
on public.catalog_3d_media for select
using (true);

-- Writes remain service-role only. exact_model_approved stays false until
-- internal product-match review confirms the model represents the physical item.
