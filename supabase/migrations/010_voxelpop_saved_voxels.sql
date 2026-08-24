create table if not exists public.voxelpop_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  checkout_session_id text not null,
  name text not null default 'your-voxel',
  idea text,
  style text,
  image_data text,
  mesh_task_id text,
  mesh_status text not null default 'image_ready',
  generations_left integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, checkout_session_id)
);

alter table public.voxelpop_assets enable row level security;

drop policy if exists "Users can view their VoxelPop assets" on public.voxelpop_assets;
create policy "Users can view their VoxelPop assets" on public.voxelpop_assets for select using (auth.uid() = user_id);
drop policy if exists "Users can save their VoxelPop assets" on public.voxelpop_assets;
create policy "Users can save their VoxelPop assets" on public.voxelpop_assets for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update their VoxelPop assets" on public.voxelpop_assets;
create policy "Users can update their VoxelPop assets" on public.voxelpop_assets for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete their VoxelPop assets" on public.voxelpop_assets;
create policy "Users can delete their VoxelPop assets" on public.voxelpop_assets for delete using (auth.uid() = user_id);

create index if not exists voxelpop_assets_user_created_idx on public.voxelpop_assets(user_id, created_at desc);