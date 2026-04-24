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
  if not exists (select 1 from pg_type where typname = 'portal_ingestion_stage') then
    create type portal_ingestion_stage as enum ('normalize', 'enrich', 'sync');
  end if;
  if not exists (select 1 from pg_type where typname = 'portal_ingestion_status') then
    create type portal_ingestion_status as enum ('pending', 'processing', 'complete', 'retry', 'failed', 'skipped');
  end if;
  if not exists (select 1 from pg_type where typname = 'portal_pff_enrichment_status') then
    create type portal_pff_enrichment_status as enum ('pending', 'queued', 'in_progress', 'completed', 'not_found', 'failed', 'skipped');
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
  conference text,
  previous_school text,
  hometown text,
  state text,
  class_year text not null,
  eligibility_remaining integer not null default 1,
  stars integer,
  academic_status text,
  status text not null default 'Portal',
  film_url text,
  photo_url text,
  x_handle text,
  x_user_id text,
  contact_window text,
  notes text,
  sportradar_id text unique,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.players add column if not exists position_group position_group;
alter table public.players add column if not exists portal_source text;
alter table public.players add column if not exists portal_source_player_id text;
alter table public.players add column if not exists portal_entry_updated_at timestamptz;
alter table public.players add column if not exists portal_last_synced_at timestamptz;
alter table public.players add column if not exists portal_removed_at timestamptz;
alter table public.players add column if not exists active_in_portal boolean not null default false;
alter table public.players add column if not exists first_seen_at timestamptz not null default timezone('utc', now());
alter table public.players add column if not exists last_seen_at timestamptz not null default timezone('utc', now());
alter table public.players add column if not exists pff_enrichment_status portal_pff_enrichment_status not null default 'pending';

update public.players
set position_group = position
where position_group is null;

create table if not exists public.player_measurements (
  player_id uuid primary key references public.players (id) on delete cascade,
  height_in integer,
  weight_lbs integer,
  arm_length_in numeric(4,1),
  forty_time numeric(4,2),
  shuttle_time numeric(4,2),
  vertical_jump numeric(4,1),
  wing_span_in numeric(4,1),
  verified_at date
);

alter table public.players add column if not exists conference text;
alter table public.players add column if not exists state text;
alter table public.players add column if not exists photo_url text;
alter table public.players add column if not exists x_handle text;
alter table public.players add column if not exists x_user_id text;
alter table public.players add column if not exists sportradar_id text unique;
alter table public.player_measurements add column if not exists arm_length_in numeric(4,1);

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

alter table public.player_stats add column if not exists updated_at timestamptz not null default timezone('utc', now());
alter table public.player_stats add column if not exists position_group position_group;
alter table public.player_stats add column if not exists season_type text not null default 'regular';
alter table public.player_stats add column if not exists source text;
alter table public.player_stats add column if not exists source_player_id text;
alter table public.player_stats add column if not exists source_updated_at timestamptz;
alter table public.player_stats add column if not exists stat_profile_used text;
alter table public.player_stats add column if not exists alignment_data jsonb not null default '{}'::jsonb;
alter table public.player_stats add column if not exists raw_stats_json jsonb not null default '{}'::jsonb;
alter table public.player_stats add column if not exists pff_enrichment_status portal_pff_enrichment_status not null default 'pending';
alter table public.player_stats add column if not exists active_in_portal boolean not null default false;
alter table public.player_stats add column if not exists first_seen_at timestamptz not null default timezone('utc', now());
alter table public.player_stats add column if not exists last_seen_at timestamptz not null default timezone('utc', now());
alter table public.player_stats add column if not exists passing_attempts integer;
alter table public.player_stats add column if not exists passing_completions integer;
alter table public.player_stats add column if not exists passing_tds integer;
alter table public.player_stats add column if not exists interceptions_thrown integer;
alter table public.player_stats add column if not exists rushing_attempts integer;
alter table public.player_stats add column if not exists rushing_tds integer;
alter table public.player_stats add column if not exists receptions integer;
alter table public.player_stats add column if not exists targets integer;
alter table public.player_stats add column if not exists receiving_tds integer;
alter table public.player_stats add column if not exists tackles_for_loss numeric(5,1);
alter table public.player_stats add column if not exists forced_fumbles integer;
alter table public.player_stats add column if not exists fumbles_recovered integer;
alter table public.player_stats add column if not exists quarterback_hurries integer;
alter table public.player_stats add column if not exists run_stops integer;
alter table public.player_stats add column if not exists snaps_slot integer;
alter table public.player_stats add column if not exists snaps_box integer;
alter table public.player_stats add column if not exists snaps_boundary integer;
alter table public.player_stats add column if not exists snaps_inline integer;
alter table public.player_stats add column if not exists snaps_wide integer;
alter table public.player_stats add column if not exists snaps_pass_rush integer;
alter table public.player_stats add column if not exists snaps_run_defense integer;

create table if not exists public.portal_ingestion_queue (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  external_player_id text not null,
  player_id uuid references public.players (id) on delete set null,
  transfer_year integer not null,
  position_group position_group,
  pipeline_stage portal_ingestion_stage not null default 'normalize',
  status portal_ingestion_status not null default 'pending',
  priority integer not null default 100,
  attempt_count integer not null default 0,
  max_attempts integer not null default 5,
  next_attempt_at timestamptz not null default timezone('utc', now()),
  last_attempt_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  locked_at timestamptz,
  locked_by text,
  error_message text,
  payload_hash text not null default '',
  payload jsonb not null default '{}'::jsonb,
  normalized_payload jsonb not null default '{}'::jsonb,
  enrichment_payload jsonb not null default '{}'::jsonb,
  raw_stats_json jsonb not null default '{}'::jsonb,
  alignment_data jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  stat_profile_used text,
  pff_enrichment_status portal_pff_enrichment_status not null default 'pending',
  active_in_portal boolean not null default true,
  first_seen_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now()),
  source_updated_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint portal_ingestion_queue_source_external_key unique (source, external_player_id)
);

create or replace function public.claim_portal_ingestion_queue(
  p_pipeline_stage portal_ingestion_stage,
  p_batch_size integer default 25,
  p_worker_id text default null,
  p_statuses portal_ingestion_status[] default array['pending'::portal_ingestion_status, 'retry'::portal_ingestion_status]
)
returns setof public.portal_ingestion_queue
language plpgsql
as $$
begin
  return query
  with candidate as (
    select q.id
    from public.portal_ingestion_queue q
    where q.pipeline_stage = p_pipeline_stage
      and q.status = any (p_statuses)
      and q.next_attempt_at <= timezone('utc', now())
      and (
        q.locked_at is null
        or q.locked_at <= timezone('utc', now()) - interval '15 minutes'
      )
    order by q.priority asc, q.last_seen_at desc, q.created_at asc
    limit greatest(coalesce(p_batch_size, 25), 1)
    for update skip locked
  )
  update public.portal_ingestion_queue q
  set status = 'processing',
      locked_at = timezone('utc', now()),
      locked_by = coalesce(p_worker_id, 'unknown'),
      last_attempt_at = timezone('utc', now()),
      started_at = coalesce(q.started_at, timezone('utc', now())),
      attempt_count = q.attempt_count + 1,
      updated_at = timezone('utc', now())
  from candidate
  where q.id = candidate.id
  returning q.*;
end;
$$;

create table if not exists public.player_identity_links (
  player_id uuid primary key references public.players (id) on delete cascade,
  espn_url text,
  roster_url text,
  source text,
  confidence numeric(4,3),
  matched_team text,
  notes text,
  last_checked_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.player_x_enrichments (
  player_id uuid primary key references public.players (id) on delete cascade,
  x_handle text,
  x_user_id text,
  measurables jsonb not null default '{}'::jsonb,
  track jsonb not null default '{}'::jsonb,
  offers jsonb not null default '[]'::jsonb,
  sources jsonb not null default '[]'::jsonb,
  last_enriched_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

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
create index if not exists players_portal_active_seen_idx on public.players (active_in_portal, last_seen_at desc);
create index if not exists players_portal_source_idx on public.players (portal_source, portal_source_player_id);
create index if not exists team_needs_team_status_idx on public.team_needs (team_id, status);
create index if not exists team_needs_team_position_priority_idx on public.team_needs (team_id, position, priority);
create index if not exists player_stats_player_season_portal_idx on public.player_stats (player_id, season desc, active_in_portal);
create index if not exists player_stats_position_group_season_idx on public.player_stats (position_group, season desc);
create index if not exists portal_ingestion_queue_stage_status_attempt_idx
on public.portal_ingestion_queue (pipeline_stage, status, next_attempt_at, priority);
create index if not exists portal_ingestion_queue_player_idx
on public.portal_ingestion_queue (player_id, transfer_year desc);
create index if not exists portal_ingestion_queue_active_seen_idx
on public.portal_ingestion_queue (active_in_portal, last_seen_at desc);
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

drop trigger if exists set_player_stats_updated_at on public.player_stats;
create trigger set_player_stats_updated_at
before update on public.player_stats
for each row
execute function public.set_updated_at();

drop trigger if exists set_shortlists_updated_at on public.shortlists;
create trigger set_shortlists_updated_at
before update on public.shortlists
for each row
execute function public.set_updated_at();

drop trigger if exists set_portal_ingestion_queue_updated_at on public.portal_ingestion_queue;
create trigger set_portal_ingestion_queue_updated_at
before update on public.portal_ingestion_queue
for each row
execute function public.set_updated_at();

alter table public.teams enable row level security;
alter table public.profiles enable row level security;
alter table public.players enable row level security;
alter table public.player_measurements enable row level security;
alter table public.player_stats enable row level security;
alter table public.portal_ingestion_queue enable row level security;
alter table public.player_identity_links enable row level security;
alter table public.player_x_enrichments enable row level security;
alter table public.player_source_notes enable row level security;
alter table public.x_source_accounts enable row level security;
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
    select 1 from pg_policies where schemaname = 'public' and tablename = 'player_measurements' and policyname = 'Authenticated upsert measurements'
  ) then
    create policy "Authenticated upsert measurements" on public.player_measurements for all to authenticated
      using (true)
      with check (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'player_stats' and policyname = 'Authenticated read stats'
  ) then
    create policy "Authenticated read stats" on public.player_stats for select to authenticated using (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'player_stats' and policyname = 'Authenticated upsert stats'
  ) then
    create policy "Authenticated upsert stats" on public.player_stats for all to authenticated
      using (true)
      with check (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'portal_ingestion_queue' and policyname = 'Authenticated read portal ingestion queue'
  ) then
    create policy "Authenticated read portal ingestion queue" on public.portal_ingestion_queue for select to authenticated using (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'portal_ingestion_queue' and policyname = 'Authenticated manage portal ingestion queue'
  ) then
    create policy "Authenticated manage portal ingestion queue" on public.portal_ingestion_queue for all to authenticated
      using (true)
      with check (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'player_identity_links' and policyname = 'Authenticated read identity links'
  ) then
    create policy "Authenticated read identity links" on public.player_identity_links for select to authenticated using (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'player_identity_links' and policyname = 'Authenticated upsert identity links'
  ) then
    create policy "Authenticated upsert identity links" on public.player_identity_links for all to authenticated
      using (true)
      with check (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'player_x_enrichments' and policyname = 'Authenticated read x enrichments'
  ) then
    create policy "Authenticated read x enrichments" on public.player_x_enrichments for select to authenticated using (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'player_x_enrichments' and policyname = 'Authenticated upsert x enrichments'
  ) then
    create policy "Authenticated upsert x enrichments" on public.player_x_enrichments for all to authenticated
      using (true)
      with check (true);
  end if;
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

create index if not exists x_source_accounts_active_priority_idx
on public.x_source_accounts (active, priority, handle);
create index if not exists player_source_notes_player_created_idx
on public.player_source_notes (player_id, created_at desc);

drop trigger if exists set_x_source_accounts_updated_at on public.x_source_accounts;
create trigger set_x_source_accounts_updated_at
before update on public.x_source_accounts
for each row
execute function public.set_updated_at();
