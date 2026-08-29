-- Private real-property rental records. These rows are not public NFT metadata.
-- A lease, payment record, notice or court/property-manager action remains authoritative
-- through the applicable real-world contract/provider/legal process.

create table if not exists public.vault_property_leases (
  id uuid primary key default gen_random_uuid(),
  property_identity_id uuid not null references public.vault_property_identities(id) on delete restrict,
  tenant_user_id uuid not null references auth.users(id) on delete cascade,
  property_label text not null default '' check (char_length(property_label) <= 160),
  provider text not null default '' check (char_length(provider) <= 80),
  provider_lease_id text not null default '' check (char_length(provider_lease_id) <= 160),
  monthly_rent_minor bigint not null default 0 check (monthly_rent_minor >= 0),
  currency text not null default 'USD' check (char_length(currency) between 3 and 8),
  due_day smallint not null default 1 check (due_day between 1 and 28),
  starts_on date,
  ends_on date,
  status text not null default 'pending-verification'
    check (status in ('pending-verification','current','late','notice','legal-process','ended')),
  agreement_hash text not null default '' check (char_length(agreement_hash) <= 128),
  lease_verified_at timestamptz,
  termination_verified_at timestamptz,
  termination_reference_hash text not null default '' check (char_length(termination_reference_hash) <= 128),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on is null or starts_on is null or ends_on >= starts_on),
  check (status = 'pending-verification' or lease_verified_at is not null),
  check (
    status <> 'ended'
    or (termination_verified_at is not null and char_length(termination_reference_hash) > 0)
  )
);

create table if not exists public.vault_rental_payments (
  id uuid primary key default gen_random_uuid(),
  lease_id uuid not null references public.vault_property_leases(id) on delete cascade,
  due_on date not null,
  amount_due_minor bigint not null default 0 check (amount_due_minor >= 0),
  amount_paid_minor bigint not null default 0 check (amount_paid_minor >= 0),
  currency text not null default 'USD' check (char_length(currency) between 3 and 8),
  status text not null default 'upcoming'
    check (status in ('upcoming','due','paid','late','disputed')),
  provider text not null default '' check (char_length(provider) <= 80),
  provider_payment_id text not null default '' check (char_length(provider_payment_id) <= 160),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lease_id, due_on)
);

create table if not exists public.vault_tenant_voxel_attachments (
  id uuid primary key default gen_random_uuid(),
  lease_id uuid not null references public.vault_property_leases(id) on delete cascade,
  tenant_user_id uuid not null references auth.users(id) on delete cascade,
  voxel_session_id text not null check (char_length(voxel_session_id) between 1 and 180),
  token_id text not null check (char_length(token_id) between 1 and 96),
  voxel_name text not null default '' check (char_length(voxel_name) <= 120),
  status text not null default 'active' check (status in ('active','archived')),
  placed_transform jsonb not null default '{"position":[0,0,0],"rotation":[0,0,0],"scale":[1,1,1]}'::jsonb,
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (lease_id, voxel_session_id)
);

alter table public.vault_property_leases enable row level security;
alter table public.vault_rental_payments enable row level security;
alter table public.vault_tenant_voxel_attachments enable row level security;

-- Tenant reads are intentionally narrow. There are no authenticated client write policies;
-- writes go through authenticated server routes so lease state cannot be self-verified.
create policy "tenants read own leases"
on public.vault_property_leases
for select to authenticated
using (tenant_user_id = auth.uid());

create policy "tenants read own rental payments"
on public.vault_rental_payments
for select to authenticated
using (
  exists (
    select 1 from public.vault_property_leases lease
    where lease.id = lease_id and lease.tenant_user_id = auth.uid()
  )
);

create policy "tenants read own voxel attachments"
on public.vault_tenant_voxel_attachments
for select to authenticated
using (tenant_user_id = auth.uid());

create index if not exists vault_property_leases_tenant_idx
  on public.vault_property_leases(tenant_user_id, status, updated_at desc);

create index if not exists vault_property_leases_identity_idx
  on public.vault_property_leases(property_identity_id, status);

create index if not exists vault_rental_payments_lease_idx
  on public.vault_rental_payments(lease_id, due_on desc);

create index if not exists vault_tenant_voxel_attachments_lease_idx
  on public.vault_tenant_voxel_attachments(lease_id, status, created_at);
