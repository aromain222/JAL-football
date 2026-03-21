create table if not exists public.x_source_accounts (
  id uuid primary key default gen_random_uuid(),
  handle text not null unique,
  display_name text not null,
  category text not null,
  priority integer not null default 100,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.x_source_accounts enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'x_source_accounts' and policyname = 'Authenticated read x source accounts'
  ) then
    create policy "Authenticated read x source accounts" on public.x_source_accounts for select to authenticated using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'x_source_accounts' and policyname = 'Authenticated manage x source accounts'
  ) then
    create policy "Authenticated manage x source accounts" on public.x_source_accounts for all to authenticated
      using (true)
      with check (true);
  end if;
end $$;

create index if not exists x_source_accounts_active_priority_idx
on public.x_source_accounts (active, priority, handle);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_x_source_accounts_updated_at on public.x_source_accounts;
create trigger set_x_source_accounts_updated_at
before update on public.x_source_accounts
for each row
execute function public.set_updated_at();
