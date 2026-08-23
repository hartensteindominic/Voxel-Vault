create extension if not exists pgcrypto;

create table if not exists public.vault_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  handle text unique not null check (handle ~ '^[a-z0-9_]{3,24}$'),
  display_name text not null check (char_length(display_name) between 1 and 50),
  bio text not null default '' check (char_length(bio) <= 280),
  avatar_style jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vault_conversations (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.vault_conversation_members (
  conversation_id uuid not null references public.vault_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table if not exists public.vault_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.vault_conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  nft_contract text,
  nft_token_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.vault_transfer_approvals (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.vault_conversations(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  nft_contract text not null,
  nft_token_id text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','submitted','confirmed','expired')),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  transaction_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.vault_profiles enable row level security;
alter table public.vault_conversations enable row level security;
alter table public.vault_conversation_members enable row level security;
alter table public.vault_messages enable row level security;
alter table public.vault_transfer_approvals enable row level security;

create policy "profiles are visible to signed in users" on public.vault_profiles for select to authenticated using (true);
create policy "users create their profile" on public.vault_profiles for insert to authenticated with check (user_id = auth.uid());
create policy "users update their profile" on public.vault_profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "members view conversations" on public.vault_conversations for select to authenticated using (exists (select 1 from public.vault_conversation_members m where m.conversation_id = id and m.user_id = auth.uid()));
create policy "users create conversations" on public.vault_conversations for insert to authenticated with check (created_by = auth.uid());
create policy "users view own memberships" on public.vault_conversation_members for select to authenticated using (user_id = auth.uid());
create policy "conversation creators add members" on public.vault_conversation_members for insert to authenticated with check (exists (select 1 from public.vault_conversations c where c.id = conversation_id and c.created_by = auth.uid()));
create policy "members read messages" on public.vault_messages for select to authenticated using (exists (select 1 from public.vault_conversation_members m where m.conversation_id = conversation_id and m.user_id = auth.uid()));
create policy "members send messages" on public.vault_messages for insert to authenticated with check (sender_id = auth.uid() and exists (select 1 from public.vault_conversation_members m where m.conversation_id = conversation_id and m.user_id = auth.uid()));
create policy "participants read transfer approvals" on public.vault_transfer_approvals for select to authenticated using (requested_by = auth.uid() or recipient_id = auth.uid());
create policy "members request transfer approvals" on public.vault_transfer_approvals for insert to authenticated with check (requested_by = auth.uid() and recipient_id <> auth.uid() and exists (select 1 from public.vault_conversation_members m where m.conversation_id = conversation_id and m.user_id = auth.uid()));
create policy "recipient updates transfer approval" on public.vault_transfer_approvals for update to authenticated using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

create index if not exists vault_messages_conversation_created_idx on public.vault_messages(conversation_id, created_at);
create index if not exists vault_transfer_approvals_recipient_idx on public.vault_transfer_approvals(recipient_id, status);

create or replace function public.vault_find_direct_conversation(peer uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select mine.conversation_id
  from public.vault_conversation_members mine
  join public.vault_conversation_members theirs on theirs.conversation_id = mine.conversation_id
  where mine.user_id = auth.uid() and theirs.user_id = peer
  order by mine.joined_at desc
  limit 1;
$$;
revoke all on function public.vault_find_direct_conversation(uuid) from public;
grant execute on function public.vault_find_direct_conversation(uuid) to authenticated;
