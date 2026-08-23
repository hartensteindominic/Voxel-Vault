create table if not exists public.catalog_3d_media (
  catalog_id text primary key,
  supplier_sku text,
  source_image_url text,
  provider text not null default 'meshy',
  provider_task_id text,
  generation_status text not null default 'pending' check (generation_status in ('pending','processing','succeeded','failed')),
  review_status text not null default 'unreviewed' check (review_status in ('unreviewed','approved','rejected')),
  model_url text,
  thumbnail_url text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists catalog_3d_media_generation_status_idx on public.catalog_3d_media(generation_status);
create index if not exists catalog_3d_media_review_status_idx on public.catalog_3d_media(review_status);

alter table public.catalog_3d_media enable row level security;

create policy "catalog 3d media is publicly readable"
  on public.catalog_3d_media for select
  using (true);

revoke insert, update, delete on public.catalog_3d_media from anon, authenticated;

grant select on public.catalog_3d_media to anon, authenticated;
