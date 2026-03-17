create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'position_group') then
    create type position_group as enum ('QB', 'RB', 'WR', 'TE', 'OL', 'EDGE', 'DL', 'LB', 'CB', 'S', 'ST');
  end if;
  if not exists (select 1 from pg_type where typname = 'need_priority') then
    create type need_priority as enum ('critical', 'high', 'medium');
  end if;
  if not exists (select 1 from pg_type where typname = 'need_status') then
    create type need_status as enum ('active', 'closed', 'draft');
  end if;
  if not exists (select 1 from pg_type where typname = 'review_decision') then
    create type review_decision as enum ('right', 'left', 'save', 'needs_film');
  end if;
  if not exists (select 1 from pg_type where typname = 'shortlist_stage') then
    create type shortlist_stage as enum ('assistant', 'coordinator', 'head_coach', 'final_watch');
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_type where typname = 'review_decision')
     and not exists (
       select 1
       from pg_enum
       where enumtypid = 'review_decision'::regtype
         and enumlabel = 'needs_film'
     ) then
    alter type review_decision add value 'needs_film';
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_type where typname = 'shortlist_stage') then
    if not exists (select 1 from pg_enum where enumtypid = 'shortlist_stage'::regtype and enumlabel = 'assistant') then
      alter type shortlist_stage add value 'assistant';
    end if;
    if not exists (select 1 from pg_enum where enumtypid = 'shortlist_stage'::regtype and enumlabel = 'final_watch') then
      alter type shortlist_stage add value 'final_watch';
    end if;
  end if;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  conference text not null,
  logo_url text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete restrict,
  full_name text not null,
  role text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  position position_group not null,
  transfer_year integer not null,
  current_school text not null,
  previous_school text,
  hometown text,
  class_year text not null,
  eligibility_remaining integer not null default 1,
  stars integer,
  academic_status text,
  status text not null default 'Portal',
  film_url text,
  contact_window text,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.player_measurements (
  player_id uuid primary key references public.players (id) on delete cascade,
  height_in integer,
  weight_lbs integer,
  forty_time numeric(4,2),
  shuttle_time numeric(4,2),
  vertical_jump numeric(4,1),
  wing_span_in numeric(4,1),
  verified_at date
);

create table if not exists public.player_stats (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  season integer not null,
  games_played integer,
  starts integer,
  offensive_snaps integer,
  defensive_snaps integer,
  special_teams_snaps integer,
  passing_yards integer,
  rushing_yards integer,
  receiving_yards integer,
  total_touchdowns integer,
  tackles integer,
  sacks numeric(4,1),
  interceptions integer,
  passes_defended integer,
  created_at timestamptz not null default timezone('utc', now()),
  constraint player_stats_player_season_key unique (player_id, season)
);

create table if not exists public.team_needs (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete restrict,
  title text not null,
  position position_group not null,
  priority need_priority not null default 'medium',
  status need_status not null default 'active',
  target_count integer not null default 1,
  class_focus text,
  min_height_in integer,
  max_height_in integer,
  min_weight_lbs integer,
  max_weight_lbs integer,
  min_arm_length_in numeric(4,1),
  max_forty_time numeric(4,2),
  min_years_remaining integer,
  scheme text,
  priority_traits text[] not null default '{}',
  production_filters jsonb not null default '{}'::jsonb,
  min_starts integer,
  min_production_score integer,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.team_needs add column if not exists max_height_in integer;
alter table public.team_needs add column if not exists max_weight_lbs integer;
alter table public.team_needs add column if not exists min_arm_length_in numeric(4,1);
alter table public.team_needs add column if not exists max_forty_time numeric(4,2);
alter table public.team_needs add column if not exists min_years_remaining integer;
alter table public.team_needs add column if not exists scheme text;
alter table public.team_needs add column if not exists priority_traits text[] not null default '{}';
alter table public.team_needs add column if not exists production_filters jsonb not null default '{}'::jsonb;

create table if not exists public.player_reviews (
  id uuid primary key default gen_random_uuid(),
  need_id uuid not null references public.team_needs (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  reviewer_id uuid not null references public.profiles (id) on delete restrict,
  decision review_decision not null,
  fit_score integer not null,
  note text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint player_reviews_need_player_reviewer_key unique (need_id, player_id, reviewer_id)
);

create table if not exists public.shortlists (
  id uuid primary key default gen_random_uuid(),
  need_id uuid not null references public.team_needs (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete restrict,
  stage shortlist_stage not null default 'assistant',
  priority_rank integer,
  note text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint shortlists_need_player_key unique (need_id, player_id)
);

create table if not exists public.player_tags (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  tag text not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint player_tags_player_tag_key unique (player_id, tag)
);

create index if not exists players_position_idx on public.players (position);
create index if not exists players_name_idx on public.players (last_name, first_name);
create index if not exists team_needs_team_status_idx on public.team_needs (team_id, status);
create index if not exists team_needs_team_position_priority_idx on public.team_needs (team_id, position, priority);
create index if not exists player_reviews_need_created_idx on public.player_reviews (need_id, created_at desc);
create index if not exists shortlists_stage_idx on public.shortlists (stage, need_id);
create index if not exists player_tags_tag_idx on public.player_tags (tag);

drop trigger if exists set_players_updated_at on public.players;
create trigger set_players_updated_at
before update on public.players
for each row
execute function public.set_updated_at();

drop trigger if exists set_team_needs_updated_at on public.team_needs;
create trigger set_team_needs_updated_at
before update on public.team_needs
for each row
execute function public.set_updated_at();

drop trigger if exists set_shortlists_updated_at on public.shortlists;
create trigger set_shortlists_updated_at
before update on public.shortlists
for each row
execute function public.set_updated_at();

alter table public.teams enable row level security;
alter table public.profiles enable row level security;
alter table public.players enable row level security;
alter table public.player_measurements enable row level security;
alter table public.player_stats enable row level security;
alter table public.team_needs enable row level security;
alter table public.player_reviews enable row level security;
alter table public.shortlists enable row level security;
alter table public.player_tags enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'teams' and policyname = 'Authenticated read teams'
  ) then
    create policy "Authenticated read teams" on public.teams for select to authenticated using (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'Read own profile'
  ) then
    create policy "Read own profile" on public.profiles for select to authenticated using (id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'Manage own profile'
  ) then
    create policy "Manage own profile" on public.profiles for all to authenticated using (id = auth.uid()) with check (id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'players' and policyname = 'Authenticated read players'
  ) then
    create policy "Authenticated read players" on public.players for select to authenticated using (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'player_measurements' and policyname = 'Authenticated read measurements'
  ) then
    create policy "Authenticated read measurements" on public.player_measurements for select to authenticated using (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'player_stats' and policyname = 'Authenticated read stats'
  ) then
    create policy "Authenticated read stats" on public.player_stats for select to authenticated using (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'player_tags' and policyname = 'Authenticated read tags'
  ) then
    create policy "Authenticated read tags" on public.player_tags for select to authenticated using (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'team_needs' and policyname = 'Team members manage needs'
  ) then
    create policy "Team members manage needs" on public.team_needs for all to authenticated
      using (team_id in (select team_id from public.profiles where id = auth.uid()))
      with check (team_id in (select team_id from public.profiles where id = auth.uid()));
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'player_reviews' and policyname = 'Team members manage reviews'
  ) then
    create policy "Team members manage reviews" on public.player_reviews for all to authenticated
      using (need_id in (select id from public.team_needs where team_id in (select team_id from public.profiles where id = auth.uid())))
      with check (need_id in (select id from public.team_needs where team_id in (select team_id from public.profiles where id = auth.uid())));
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'shortlists' and policyname = 'Team members manage shortlists'
  ) then
    create policy "Team members manage shortlists" on public.shortlists for all to authenticated
      using (need_id in (select id from public.team_needs where team_id in (select team_id from public.profiles where id = auth.uid())))
      with check (need_id in (select id from public.team_needs where team_id in (select team_id from public.profiles where id = auth.uid())));
  end if;
end $$;
