-- Migration: Add player_pff_grades table for PFF premium stats
-- Run this in your Supabase SQL editor or via supabase db push

create table if not exists public.player_pff_grades (
  id uuid primary key default gen_random_uuid(),

  -- PFF identity (pff_player_id is PFF's internal integer ID)
  pff_player_id integer not null,
  player_name text not null,
  team_name text,
  position text,
  season integer not null,

  -- Link to our players table (resolved by name+team match during import, may be null for unmatched)
  player_id uuid references public.players (id) on delete set null,

  -- -------------------------------------------------------------------------
  -- Overall grades (0–100 PFF scale)
  -- -------------------------------------------------------------------------
  grades_overall numeric(5,1),
  grades_offense numeric(5,1),
  grades_defense numeric(5,1),
  grades_special_teams numeric(5,1),

  -- -------------------------------------------------------------------------
  -- Overall snap counts
  -- -------------------------------------------------------------------------
  snaps_offense integer,
  snaps_defense integer,
  snaps_special_teams integer,

  -- -------------------------------------------------------------------------
  -- Alignment snaps — where the player lined up on each snap
  -- Skill positions (WR / TE / RB)
  -- -------------------------------------------------------------------------
  snaps_slot integer,
  snaps_wide_left integer,
  snaps_wide_right integer,
  snaps_inline_te integer,
  snaps_backfield integer,
  snaps_as_flanker integer,

  -- OL alignment
  snaps_at_left_tackle integer,
  snaps_at_left_guard integer,
  snaps_at_center integer,
  snaps_at_right_guard integer,
  snaps_at_right_tackle integer,

  -- DL / Edge alignment
  snaps_at_left_end integer,
  snaps_at_right_end integer,
  snaps_interior_dl integer,

  -- LB alignment
  snaps_in_box_lb integer,
  snaps_off_ball_lb integer,

  -- DB / Safety alignment
  snaps_free_safety integer,
  snaps_strong_safety integer,
  snaps_slot_cb integer,
  snaps_outside_cb integer,
  snaps_in_box_db integer,
  snaps_deep_safety integer,

  -- -------------------------------------------------------------------------
  -- QB grades & stats
  -- -------------------------------------------------------------------------
  grades_pass numeric(5,1),
  grades_run_qb numeric(5,1),

  stats_completions integer,
  stats_attempts integer,
  stats_passing_yards integer,
  stats_passing_tds integer,
  stats_interceptions integer,
  stats_big_time_throws integer,
  stats_turnover_worthy_plays integer,
  stats_adjusted_completion_pct numeric(5,1),
  stats_pressure_to_sack numeric(5,1),
  stats_time_to_throw numeric(4,2),
  stats_yards_per_attempt numeric(5,1),

  -- -------------------------------------------------------------------------
  -- Receiving grades & stats (WR / TE / RB)
  -- -------------------------------------------------------------------------
  grades_pass_route numeric(5,1),
  grades_hands_drop numeric(5,1),

  stats_targets integer,
  stats_receptions integer,
  stats_receiving_yards integer,
  stats_receiving_tds integer,
  stats_drops integer,
  stats_yac numeric(7,1),
  stats_yac_per_reception numeric(5,1),
  stats_contested_catches integer,
  stats_contested_catch_rate numeric(5,1),
  stats_first_downs_receiving integer,
  stats_adot numeric(5,1),             -- average depth of target
  stats_catch_rate numeric(5,1),
  stats_yards_per_route_run numeric(5,1),
  stats_route_participation_pct numeric(5,1),

  -- Route-tree breakdown (targets and receptions per route type)
  stats_routes_slant_targets integer,
  stats_routes_slant_receptions integer,
  stats_routes_hitch_targets integer,
  stats_routes_hitch_receptions integer,
  stats_routes_out_targets integer,
  stats_routes_out_receptions integer,
  stats_routes_curl_targets integer,
  stats_routes_curl_receptions integer,
  stats_routes_dig_targets integer,
  stats_routes_dig_receptions integer,
  stats_routes_post_targets integer,
  stats_routes_post_receptions integer,
  stats_routes_corner_targets integer,
  stats_routes_corner_receptions integer,
  stats_routes_go_targets integer,
  stats_routes_go_receptions integer,
  stats_routes_screen_targets integer,
  stats_routes_screen_receptions integer,
  stats_routes_crosser_targets integer,
  stats_routes_crosser_receptions integer,

  -- -------------------------------------------------------------------------
  -- Rushing grades & stats (RB / QB)
  -- -------------------------------------------------------------------------
  grades_run_rb numeric(5,1),

  stats_carries integer,
  stats_rushing_yards integer,
  stats_rushing_tds integer,
  stats_ya_contact numeric(7,1),
  stats_yards_after_contact numeric(7,1),
  stats_yards_after_contact_per_carry numeric(5,1),
  stats_broken_tackles integer,
  stats_elusive_rating numeric(5,1),
  stats_first_downs_rushing integer,
  stats_fumbles integer,

  -- -------------------------------------------------------------------------
  -- RB blocking grades & stats
  -- -------------------------------------------------------------------------
  grades_pass_block_rb numeric(5,1),
  grades_run_block_rb numeric(5,1),
  stats_pass_block_snaps_rb integer,
  stats_pressures_allowed_rb integer,
  stats_run_block_snaps_rb integer,

  -- -------------------------------------------------------------------------
  -- OL grades & stats
  -- -------------------------------------------------------------------------
  grades_pass_block numeric(5,1),
  grades_run_block numeric(5,1),

  stats_pass_block_snaps integer,
  stats_pressures_allowed integer,
  stats_sacks_allowed numeric(4,1),
  stats_hits_allowed integer,
  stats_hurries_allowed integer,
  stats_run_block_snaps integer,
  stats_penalties integer,

  -- -------------------------------------------------------------------------
  -- DL / Edge grades & stats
  -- -------------------------------------------------------------------------
  grades_pass_rush numeric(5,1),
  grades_run_defense_dl numeric(5,1),

  stats_pass_rush_snaps integer,
  stats_pressures integer,
  stats_sacks numeric(4,1),
  stats_hits integer,
  stats_hurries integer,
  stats_run_stops integer,
  stats_run_stop_pct numeric(5,1),

  -- -------------------------------------------------------------------------
  -- LB grades & stats
  -- -------------------------------------------------------------------------
  grades_coverage_lb numeric(5,1),
  grades_tackle numeric(5,1),
  grades_run_defense_lb numeric(5,1),
  grades_pass_rush_lb numeric(5,1),

  stats_tackles integer,
  stats_assists integer,
  stats_missed_tackles integer,
  stats_stops_lb integer,
  stats_forced_fumbles integer,

  -- -------------------------------------------------------------------------
  -- DB / Safety grades & stats
  -- -------------------------------------------------------------------------
  grades_coverage_db numeric(5,1),
  grades_man_coverage numeric(5,1),
  grades_zone_coverage numeric(5,1),
  grades_tackle_db numeric(5,1),

  stats_targets_allowed integer,
  stats_receptions_allowed integer,
  stats_yards_allowed integer,
  stats_tds_allowed integer,
  stats_interceptions_def integer,
  stats_pass_breakups integer,
  stats_pff_coverage_snaps integer,
  stats_yards_per_coverage_snap numeric(5,1),
  stats_passer_rating_allowed numeric(6,1),

  -- -------------------------------------------------------------------------
  -- Metadata
  -- -------------------------------------------------------------------------
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  constraint player_pff_grades_pff_id_season_key unique (pff_player_id, season)
);

-- Index for fast lookups by our player_id
create index if not exists idx_player_pff_grades_player_id
  on public.player_pff_grades (player_id);

-- Index for player name matching during import
create index if not exists idx_player_pff_grades_player_name
  on public.player_pff_grades (lower(player_name));

-- Trigger to keep updated_at current
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_player_pff_grades_updated_at on public.player_pff_grades;
create trigger trg_player_pff_grades_updated_at
  before update on public.player_pff_grades
  for each row execute function public.set_updated_at();
