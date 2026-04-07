create table if not exists public.player_pff_profiles (
  player_id uuid primary key references public.players (id) on delete cascade,
  pff_player_name text,
  current_team text,
  jersey_number text,
  height_in integer,
  weight_lbs integer,
  draft_eligibility_year integer,
  source text not null default 'manual_screenshot',
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.player_pff_season_reports (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  season integer not null,
  team_name text,
  report_type text not null,
  source text not null default 'manual_screenshot',
  source_key text not null,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint player_pff_season_reports_player_key unique (player_id, season, source_key)
);

create table if not exists public.player_pff_weekly_reports (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  season integer not null,
  week_label text not null,
  opponent text not null default '',
  away boolean not null default false,
  team_name text,
  report_type text not null,
  source text not null default 'manual_screenshot',
  source_key text not null,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint player_pff_weekly_reports_player_key unique (
    player_id,
    season,
    source_key,
    week_label,
    opponent,
    team_name
  )
);

create table if not exists public.player_pff_position_pivot_rows (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  season integer not null,
  week_id integer not null,
  position_group text not null,
  position text not null,
  pass integer not null default 0,
  pass_route integer not null default 0,
  pass_block integer not null default 0,
  run integer not null default 0,
  run_block integer not null default 0,
  pass_rush integer not null default 0,
  run_defense integer not null default 0,
  coverage integer not null default 0,
  field_goal_blocking integer not null default 0,
  field_goal integer not null default 0,
  field_goal_kicking integer not null default 0,
  kickoff_return_blocking integer not null default 0,
  kickoff_returning integer not null default 0,
  kickoff_coverage integer not null default 0,
  kickoff_kicking integer not null default 0,
  punt_return_blocking integer not null default 0,
  punt_returning integer not null default 0,
  punt_coverage integer not null default 0,
  punt_punting integer not null default 0,
  source text not null default 'csv',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint player_pff_position_pivot_rows_player_key unique (
    player_id,
    season,
    week_id,
    position_group,
    position
  )
);

create index if not exists player_pff_season_reports_player_idx
on public.player_pff_season_reports (player_id, season desc, report_type);

create index if not exists player_pff_weekly_reports_player_idx
on public.player_pff_weekly_reports (player_id, season desc, report_type, week_label);

create index if not exists player_pff_position_pivot_rows_player_idx
on public.player_pff_position_pivot_rows (player_id, season desc, week_id, position_group, position);

alter table public.player_pff_profiles enable row level security;
alter table public.player_pff_season_reports enable row level security;
alter table public.player_pff_weekly_reports enable row level security;
alter table public.player_pff_position_pivot_rows enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'player_pff_profiles' and policyname = 'Authenticated read pff profiles'
  ) then
    create policy "Authenticated read pff profiles" on public.player_pff_profiles for select to authenticated using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'player_pff_profiles' and policyname = 'Authenticated manage pff profiles'
  ) then
    create policy "Authenticated manage pff profiles" on public.player_pff_profiles for all to authenticated
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'player_pff_season_reports' and policyname = 'Authenticated read pff season reports'
  ) then
    create policy "Authenticated read pff season reports" on public.player_pff_season_reports for select to authenticated using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'player_pff_season_reports' and policyname = 'Authenticated manage pff season reports'
  ) then
    create policy "Authenticated manage pff season reports" on public.player_pff_season_reports for all to authenticated
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'player_pff_weekly_reports' and policyname = 'Authenticated read pff weekly reports'
  ) then
    create policy "Authenticated read pff weekly reports" on public.player_pff_weekly_reports for select to authenticated using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'player_pff_weekly_reports' and policyname = 'Authenticated manage pff weekly reports'
  ) then
    create policy "Authenticated manage pff weekly reports" on public.player_pff_weekly_reports for all to authenticated
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'player_pff_position_pivot_rows' and policyname = 'Authenticated read pff position pivot rows'
  ) then
    create policy "Authenticated read pff position pivot rows" on public.player_pff_position_pivot_rows for select to authenticated using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'player_pff_position_pivot_rows' and policyname = 'Authenticated manage pff position pivot rows'
  ) then
    create policy "Authenticated manage pff position pivot rows" on public.player_pff_position_pivot_rows for all to authenticated
      using (true)
      with check (true);
  end if;
end $$;

drop trigger if exists set_player_pff_profiles_updated_at on public.player_pff_profiles;
create trigger set_player_pff_profiles_updated_at
before update on public.player_pff_profiles
for each row
execute function public.set_updated_at();

drop trigger if exists set_player_pff_season_reports_updated_at on public.player_pff_season_reports;
create trigger set_player_pff_season_reports_updated_at
before update on public.player_pff_season_reports
for each row
execute function public.set_updated_at();

drop trigger if exists set_player_pff_weekly_reports_updated_at on public.player_pff_weekly_reports;
create trigger set_player_pff_weekly_reports_updated_at
before update on public.player_pff_weekly_reports
for each row
execute function public.set_updated_at();

drop trigger if exists set_player_pff_position_pivot_rows_updated_at on public.player_pff_position_pivot_rows;
create trigger set_player_pff_position_pivot_rows_updated_at
before update on public.player_pff_position_pivot_rows
for each row
execute function public.set_updated_at();
