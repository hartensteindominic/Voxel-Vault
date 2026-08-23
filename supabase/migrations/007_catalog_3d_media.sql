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

alter table public.catalog_3d_media enable row level security;

create policy "catalog 3d media is publicly readable"
on public.catalog_3d_media for select
using (true);

create index if not exists catalog_3d_media_task_idx on public.catalog_3d_media(task_id);
create index if not exists catalog_3d_media_status_idx on public.catalog_3d_media(status, updated_at);

-- Writes are service-role only. AI-generated models remain unapproved until an
-- internal accuracy review confirms they represent the same physical CJ item.
