create table if not exists public.player_source_notes (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  source_platform text not null default 'x',
  source_account text,
  source_url text,
  note_type text not null default 'scouting',
  source_text text not null,
  summary text,
  traits text[] not null default '{}',
  status_signal text,
  confidence numeric(4,3),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.player_source_notes enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'player_source_notes' and policyname = 'Authenticated read source notes'
  ) then
    create policy "Authenticated read source notes" on public.player_source_notes for select to authenticated using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'player_source_notes' and policyname = 'Authenticated manage source notes'
  ) then
    create policy "Authenticated manage source notes" on public.player_source_notes for all to authenticated
      using (true)
      with check (true);
  end if;
end $$;

create index if not exists player_source_notes_player_created_idx
on public.player_source_notes (player_id, created_at desc);
