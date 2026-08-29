-- Private renter-supplied room photos used only as visual decoration references.
-- These images are not public property evidence, verified floor plans, lease documents,
-- deed evidence, or canonical building geometry.

create table if not exists public.vault_rental_room_references (
  lease_id uuid primary key references public.vault_property_leases(id) on delete cascade,
  tenant_user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null check (char_length(storage_path) between 1 and 600),
  content_type text not null default 'image/jpeg' check (char_length(content_type) between 3 and 80),
  file_digest text not null check (char_length(file_digest) = 64),
  rights_confirmed_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.vault_rental_room_references enable row level security;

create policy "tenants read own room reference"
on public.vault_rental_room_references
for select to authenticated
using (tenant_user_id = auth.uid());

-- No authenticated client write policy. Uploads and replacements go through the
-- signed-in server route, which verifies the tenant and active lease state first.

create index if not exists vault_rental_room_references_tenant_idx
  on public.vault_rental_room_references(tenant_user_id, updated_at desc);
