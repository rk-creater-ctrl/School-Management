create extension if not exists "pgcrypto";

create table if not exists public.school_records (
  id uuid primary key default gen_random_uuid(),
  collection text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists school_records_collection_idx
  on public.school_records (collection);

create index if not exists school_records_payload_gin_idx
  on public.school_records using gin (payload);

create or replace function public.set_school_records_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists school_records_set_updated_at on public.school_records;

create trigger school_records_set_updated_at
before update on public.school_records
for each row
execute function public.set_school_records_updated_at();

alter table public.school_records enable row level security;

grant usage on schema public to service_role;
grant select, insert, update, delete on table public.school_records to service_role;

comment on table public.school_records is
  'JSON document store for the school management backend. Access is intentionally server-side through the Supabase service role key.';
