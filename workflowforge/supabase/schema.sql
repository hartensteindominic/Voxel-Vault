create table if not exists public.profiles (id uuid primary key references auth.users(id) on delete cascade, full_name text, plan text not null default 'free' check (plan in ('free','pro','studio')), stripe_customer_id text unique, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.businesses (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, name text not null, business_type text not null, website text, goal text, offer text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.generations (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, business_id uuid not null references public.businesses(id) on delete cascade, kind text not null, input jsonb not null default '{}'::jsonb, output jsonb not null default '{}'::jsonb, created_at timestamptz not null default now());
create table if not exists public.subscriptions (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, stripe_subscription_id text unique not null, status text not null, price_id text, current_period_end timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now());

create index if not exists businesses_user_id_idx on public.businesses(user_id);
create index if not exists generations_user_created_idx on public.generations(user_id, created_at desc);
create index if not exists subscriptions_user_id_idx on public.subscriptions(user_id);

alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.generations enable row level security;
alter table public.subscriptions enable row level security;

drop policy if exists "profiles own" on public.profiles;
drop policy if exists "businesses own" on public.businesses;
drop policy if exists "generations own" on public.generations;
drop policy if exists "subscriptions own" on public.subscriptions;
create policy "profiles own" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "businesses own" on public.businesses for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "generations own" on public.generations for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "subscriptions own" on public.subscriptions for select using (auth.uid() = user_id);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$ begin insert into public.profiles (id, full_name) values (new.id, coalesce(new.raw_user_meta_data->>'full_name','')) on conflict (id) do nothing; return new; end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();