-- PFF data manually extracted from screenshots shared in chat.
-- This file focuses on player profile metadata and season/split summaries
-- that were clearly legible from the screenshots.

-- Mike Jones
with target as (
  select id
  from public.players
  where first_name = 'Mike' and last_name = 'Jones' and position = 'DL'
  order by created_at desc
  limit 1
)
insert into public.player_pff_profiles (
  player_id, pff_player_name, current_team, jersey_number, height_in, weight_lbs, draft_eligibility_year, source, raw_payload
)
select
  id, 'Mike Jones', 'Kennesaw State Owls', 'DI #58', 74, 291, 2026, 'manual_screenshot',
  '{"source_note":"Mike Jones Kennesaw / defense screenshots"}'::jsonb
from target
on conflict (player_id) do update
set
  pff_player_name = excluded.pff_player_name,
  current_team = excluded.current_team,
  jersey_number = excluded.jersey_number,
  height_in = excluded.height_in,
  weight_lbs = excluded.weight_lbs,
  draft_eligibility_year = excluded.draft_eligibility_year,
  source = excluded.source,
  raw_payload = excluded.raw_payload;

with target as (
  select id
  from public.players
  where first_name = 'Mike' and last_name = 'Jones' and position = 'DL'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2025, 'KENNESAW', 'defense', 'manual_screenshot', 'defense_summary',
  '{
    "total_snaps": 12,
    "run_defense_snaps": 6,
    "pass_rush_snaps": 6,
    "coverage_snaps": 0,
    "defense_grade": 68.2,
    "run_defense_grade": 69.3,
    "tackling_grade": 73.6,
    "pass_rush_grade": 57.4,
    "pressure_total": 0,
    "sacks": 0,
    "hits": 0,
    "hurries": 0,
    "batted_passes": 0,
    "tackles": 3,
    "assists": 0,
    "missed_tackles": 0,
    "missed_tackle_rate": 0.0,
    "stops": 3,
    "forced_fumbles": 0,
    "targets": 0,
    "receptions_allowed": 0
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

-- Leonard Sherrod
with target as (
  select id
  from public.players
  where first_name = 'Leonard' and last_name = 'Sherrod' and position = 'S'
  order by created_at desc
  limit 1
)
insert into public.player_pff_profiles (
  player_id, pff_player_name, current_team, jersey_number, height_in, weight_lbs, draft_eligibility_year, source, raw_payload
)
select
  id, 'Leonard Sherrod', 'Tennessee Tech Golden Eagles', 'S #N0', 75, 0, 2027, 'manual_screenshot',
  '{"source_note":"Leonard Sherrod Tennessee Tech defense screenshot"}'::jsonb
from target
on conflict (player_id) do update
set
  pff_player_name = excluded.pff_player_name,
  current_team = excluded.current_team,
  jersey_number = excluded.jersey_number,
  height_in = excluded.height_in,
  weight_lbs = excluded.weight_lbs,
  draft_eligibility_year = excluded.draft_eligibility_year,
  source = excluded.source,
  raw_payload = excluded.raw_payload;

with target as (
  select id
  from public.players
  where first_name = 'Leonard' and last_name = 'Sherrod' and position = 'S'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2024, 'WHU', 'defense', 'manual_screenshot', 'defense_summary',
  '{
    "total_snaps": 29,
    "run_defense_snaps": 14,
    "pass_rush_snaps": 0,
    "coverage_snaps": 15,
    "defense_grade": 61.0,
    "run_defense_grade": 74.4,
    "tackling_grade": 84.0,
    "coverage_grade": 51.3,
    "pressure_total": 0,
    "tackles": 2,
    "assists": 4,
    "missed_tackles": 0,
    "missed_tackle_rate": 0.0,
    "stops": 0,
    "targets": 0,
    "receptions_allowed": 0
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

-- Josiah Robinson
with target as (
  select id
  from public.players
  where first_name = 'Josiah' and last_name = 'Robinson' and position = 'LB'
  order by created_at desc
  limit 1
)
insert into public.player_pff_profiles (
  player_id, pff_player_name, current_team, jersey_number, height_in, weight_lbs, draft_eligibility_year, source, raw_payload
)
select
  id, 'Josiah Robinson', 'Georgia State Panthers', 'LB #25', 70, 215, 2027, 'manual_screenshot',
  '{"source_note":"Josiah Robinson Georgia State defense screenshot"}'::jsonb
from target
on conflict (player_id) do update
set
  pff_player_name = excluded.pff_player_name,
  current_team = excluded.current_team,
  jersey_number = excluded.jersey_number,
  height_in = excluded.height_in,
  weight_lbs = excluded.weight_lbs,
  draft_eligibility_year = excluded.draft_eligibility_year,
  source = excluded.source,
  raw_payload = excluded.raw_payload;

with target as (
  select id
  from public.players
  where first_name = 'Josiah' and last_name = 'Robinson' and position = 'LB'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2025, 'GA STATE', 'defense', 'manual_screenshot', 'defense_summary',
  '{
    "total_snaps": 800,
    "run_defense_snaps": 403,
    "pass_rush_snaps": 54,
    "coverage_snaps": 343,
    "defense_grade": 68.6,
    "run_defense_grade": 69.7,
    "tackling_grade": 87.0,
    "pass_rush_grade": 61.6,
    "coverage_grade": 62.9,
    "pressure_total": 14,
    "sacks": 2,
    "hits": 1,
    "hurries": 11,
    "tackles": 69,
    "assists": 28,
    "missed_tackles": 7,
    "missed_tackle_rate": 6.7,
    "stops": 42,
    "targets": 26,
    "receptions_allowed": 21,
    "reception_pct_allowed": 80.8,
    "yards_allowed": 255,
    "yards_per_reception_allowed": 12.1
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

-- Devin Davis
with target as (
  select id
  from public.players
  where first_name = 'Devin' and last_name = 'Davis' and position = 'OL'
  order by created_at desc
  limit 1
)
insert into public.player_pff_profiles (
  player_id, pff_player_name, current_team, jersey_number, height_in, weight_lbs, draft_eligibility_year, source, raw_payload
)
select
  id, 'Devin Davis', 'Charlotte 49ers', 'G #58', 75, 310, 2027, 'manual_screenshot',
  '{"source_note":"Devin Davis Charlotte offense, pass blocking, and run blocking screenshots"}'::jsonb
from target
on conflict (player_id) do update
set
  pff_player_name = excluded.pff_player_name,
  current_team = excluded.current_team,
  jersey_number = excluded.jersey_number,
  height_in = excluded.height_in,
  weight_lbs = excluded.weight_lbs,
  draft_eligibility_year = excluded.draft_eligibility_year,
  source = excluded.source,
  raw_payload = excluded.raw_payload;

with target as (
  select id
  from public.players
  where first_name = 'Devin' and last_name = 'Davis' and position = 'OL'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2025, 'CHARLOTTE', 'offense', 'manual_screenshot', 'offense_summary',
  '{
    "total_snaps": 257,
    "pass_block_snaps": 154,
    "run_block_snaps": 103,
    "offense_grade": 59.2,
    "pass_block_grade": 54.2,
    "run_block_grade": 60.7,
    "penalties": "3 (0)"
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Devin' and last_name = 'Davis' and position = 'OL'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2025, 'CHARLOTTE', 'pass_blocking', 'manual_screenshot', 'pass_blocking_summary',
  '{
    "pass": 154,
    "pblk": 154,
    "pb_pct": 100.0,
    "pblk_grade": 54.2,
    "penalties": "3 (0)",
    "opp": 139,
    "opp_pct": 100.0,
    "sacks_allowed": 0,
    "hits_allowed": 2,
    "hurries_allowed": 8,
    "pressures_allowed": 10,
    "efficiency": 96.4,
    "true_pass_set_pass": 70,
    "true_pass_set_pblk": 70,
    "true_pass_set_pb_pct": 100.0,
    "tps_opp": 64,
    "tps_opp_pct": 100.0,
    "tps_sacks": 0,
    "tps_hits": 1,
    "tps_hurries": 8,
    "tps_pressures": 9,
    "tps_efficiency": 93.0
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Devin' and last_name = 'Davis' and position = 'OL'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2025, 'CHARLOTTE', 'run_blocking', 'manual_screenshot', 'run_blocking_summary',
  '{
    "run": 103,
    "run_block": 103,
    "rb_pct": 100.0,
    "run_block_grade": 60.7,
    "penalties": "3 (0)",
    "zone_run_block_snaps": 68,
    "zone_snap_pct": 66.0,
    "gap_run_block_snaps": 23,
    "gap_snap_pct": 22.3
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

-- Andrew Sprague
with target as (
  select id
  from public.players
  where first_name = 'Andrew' and last_name = 'Sprague' and position = 'OL'
  order by created_at desc
  limit 1
)
insert into public.player_pff_profiles (
  player_id, pff_player_name, current_team, jersey_number, height_in, weight_lbs, draft_eligibility_year, source, raw_payload
)
select
  id, 'Andrew Sprague', 'Michigan Wolverines', 'RT', 80, 315, 2028, 'manual_screenshot',
  '{"source_note":"Andrew Sprague Michigan pass blocking and run blocking screenshots"}'::jsonb
from target
on conflict (player_id) do update
set
  pff_player_name = excluded.pff_player_name,
  current_team = excluded.current_team,
  jersey_number = excluded.jersey_number,
  height_in = excluded.height_in,
  weight_lbs = excluded.weight_lbs,
  draft_eligibility_year = excluded.draft_eligibility_year,
  source = excluded.source,
  raw_payload = excluded.raw_payload;

with target as (
  select id
  from public.players
  where first_name = 'Andrew' and last_name = 'Sprague' and position = 'OL'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2025, 'MICHIGAN', 'run_blocking', 'manual_screenshot', 'run_blocking_summary',
  '{
    "run": 380,
    "run_block": 380,
    "rb_pct": 100.0,
    "run_block_grade": 70.0,
    "penalties": "2 (0)",
    "zone_run_block_snaps": 185,
    "zone_snap_pct": 48.7,
    "gap_run_block_snaps": 162,
    "gap_snap_pct": 42.6
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Andrew' and last_name = 'Sprague' and position = 'OL'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2024, 'MICHIGAN', 'run_blocking', 'manual_screenshot', 'run_blocking_summary',
  '{
    "run": 50,
    "run_block": 50,
    "rb_pct": 100.0,
    "run_block_grade": 63.1,
    "penalties": "0 (0)",
    "zone_run_block_snaps": 19,
    "zone_snap_pct": 38.0,
    "gap_run_block_snaps": 25,
    "gap_snap_pct": 50.0
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Andrew' and last_name = 'Sprague' and position = 'OL'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2025, 'MICHIGAN', 'pass_blocking', 'manual_screenshot', 'pass_blocking_summary',
  '{
    "pass": 360,
    "pblk": 360,
    "pb_pct": 100.0,
    "pblk_grade": 71.0,
    "penalties": "2 (0)",
    "opp": 346,
    "opp_pct": 100.0,
    "sacks_allowed": 1,
    "hits_allowed": 2,
    "hurries_allowed": 17,
    "pressures_allowed": 20,
    "efficiency": 97.0,
    "true_pass_set_pass": 116,
    "true_pass_set_pblk": 116,
    "true_pass_set_pb_pct": 100.0,
    "tps_opp": 112,
    "tps_opp_pct": 100.0,
    "tps_sacks": 0,
    "tps_hits": 1,
    "tps_hurries": 12,
    "tps_pressures": 13,
    "tps_efficiency": 94.2
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Andrew' and last_name = 'Sprague' and position = 'OL'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2024, 'MICHIGAN', 'pass_blocking', 'manual_screenshot', 'pass_blocking_summary',
  '{
    "pass": 23,
    "pblk": 23,
    "pb_pct": 100.0,
    "pblk_grade": 58.9,
    "penalties": "0 (0)",
    "opp": 23,
    "opp_pct": 100.0,
    "sacks_allowed": 0,
    "hits_allowed": 0,
    "hurries_allowed": 1,
    "pressures_allowed": 1,
    "efficiency": 97.8,
    "true_pass_set_pass": 6,
    "true_pass_set_pblk": 6,
    "true_pass_set_pb_pct": 100.0,
    "tps_opp": 6,
    "tps_opp_pct": 100.0,
    "tps_sacks": 0,
    "tps_hits": 0,
    "tps_hurries": 1,
    "tps_pressures": 1,
    "tps_efficiency": 91.7
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

-- Justin Flowe
with target as (
  select id
  from public.players
  where first_name = 'Justin' and last_name = 'Flowe' and position = 'LB'
  order by created_at desc
  limit 1
)
insert into public.player_pff_profiles (
  player_id, pff_player_name, current_team, jersey_number, height_in, weight_lbs, draft_eligibility_year, source, raw_payload
)
select
  id, 'Justin Flowe', 'UNLV Rebels', 'LB #36', 74, 230, 2026, 'manual_screenshot',
  '{"source_note":"Justin Flowe UNLV defense and snaps-by-position screenshots","dob":"2001-10-23"}'::jsonb
from target
on conflict (player_id) do update
set
  pff_player_name = excluded.pff_player_name,
  current_team = excluded.current_team,
  jersey_number = excluded.jersey_number,
  height_in = excluded.height_in,
  weight_lbs = excluded.weight_lbs,
  draft_eligibility_year = excluded.draft_eligibility_year,
  source = excluded.source,
  raw_payload = excluded.raw_payload;

with target as (
  select id
  from public.players
  where first_name = 'Justin' and last_name = 'Flowe' and position = 'LB'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2025, 'UNLV', 'defense', 'manual_screenshot', 'defense_summary',
  '{
    "total_snaps": 84,
    "run_defense_snaps": 27,
    "pass_rush_snaps": 12,
    "coverage_snaps": 45,
    "defense_grade": 72.1,
    "run_defense_grade": 72.6,
    "tackling_grade": 56.0,
    "pass_rush_grade": 56.5,
    "coverage_grade": 75.5,
    "pressure_total": 2,
    "tackles": 6,
    "assists": 5,
    "missed_tackles": 2,
    "missed_tackle_rate": 15.4,
    "stops": 4,
    "targets": 4,
    "receptions_allowed": 3,
    "reception_pct_allowed": 75.0,
    "yards_allowed": 13,
    "yards_per_reception_allowed": 4.3
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Justin' and last_name = 'Flowe' and position = 'LB'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2025, 'UNLV', 'alignment', 'manual_screenshot', 'snaps_by_position_summary',
  '{
    "dline": 5,
    "lolb": 3,
    "rolb": 2,
    "box": 73,
    "lilb": 15,
    "llb": 9,
    "mlb": 10,
    "rilb": 25,
    "rlb": 13,
    "ss": 1,
    "slot_corner": 5,
    "scbl": 3,
    "scbr": 2
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

-- Zakaa Brown
with target as (
  select id
  from public.players
  where first_name = 'Zakaa' and last_name = 'Brown' and position = 'CB'
  order by created_at desc
  limit 1
)
insert into public.player_pff_profiles (
  player_id, pff_player_name, current_team, jersey_number, height_in, weight_lbs, draft_eligibility_year, source, raw_payload
)
select
  id, 'Zakaa Brown', 'Towson Tigers', 'CB #12', 73, 180, 2028, 'manual_screenshot',
  '{"source_note":"Zakaa Brown Towson defense, receiving, and snaps-by-position screenshots"}'::jsonb
from target
on conflict (player_id) do update
set
  pff_player_name = excluded.pff_player_name,
  current_team = excluded.current_team,
  jersey_number = excluded.jersey_number,
  height_in = excluded.height_in,
  weight_lbs = excluded.weight_lbs,
  draft_eligibility_year = excluded.draft_eligibility_year,
  source = excluded.source,
  raw_payload = excluded.raw_payload;

with target as (
  select id
  from public.players
  where first_name = 'Zakaa' and last_name = 'Brown' and position = 'CB'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2025, 'TOWSON', 'defense', 'manual_screenshot', 'defense_summary',
  '{
    "total_snaps": 323,
    "run_defense_snaps": 134,
    "pass_rush_snaps": 0,
    "coverage_snaps": 189,
    "defense_grade": 60.2,
    "run_defense_grade": 75.4,
    "tackling_grade": 86.9,
    "coverage_grade": 57.3,
    "tackles": 14,
    "stops": 1,
    "forced_fumbles": 1,
    "targets": 26,
    "receptions_allowed": 17,
    "reception_pct_allowed": 65.4,
    "yards_allowed": 243,
    "yards_per_reception_allowed": 14.3
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Zakaa' and last_name = 'Brown' and position = 'CB'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2025, 'TOWSON', 'receiving', 'manual_screenshot', 'receiving_summary',
  '{
    "targets": 1,
    "receptions": 1,
    "reception_pct": 100.0,
    "yards": 14,
    "yards_per_reception": 14.0,
    "touchdowns": 0,
    "offense_grade": 73.1,
    "receiving_grade": 73.6,
    "drop_grade": 66.7,
    "fumble_grade": 61.0,
    "pass_snaps": 1,
    "receiving_snaps": 1,
    "route_pct": 100.0,
    "yac": 5,
    "yac_per_reception": 5.0,
    "yprr": 14.0
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Zakaa' and last_name = 'Brown' and position = 'CB'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2025, 'TOWSON', 'alignment', 'manual_screenshot', 'snaps_by_position_summary',
  '{
    "box": 12,
    "llb": 4,
    "rlb": 4,
    "ssl": 2,
    "ssr": 2,
    "slot_corner": 9,
    "scbr": 7,
    "scbir": 1,
    "scbor": 1,
    "wide_corner": 302,
    "lcb": 144,
    "rcb": 158,
    "kick_coverage": 32,
    "l1": 2
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

-- Roy Alexander
with target as (
  select id
  from public.players
  where first_name = 'Roy' and last_name = 'Alexander' and position = 'WR'
  order by created_at desc
  limit 1
)
insert into public.player_pff_profiles (
  player_id, pff_player_name, current_team, jersey_number, height_in, weight_lbs, draft_eligibility_year, source, raw_payload
)
select
  id, 'Roy Alexander', 'Texas Tech Red Raiders', 'WR #18', 71, 200, 2026, 'manual_screenshot',
  '{"source_note":"Roy Alexander offense, receiving, run blocking, and snaps-by-position screenshots"}'::jsonb
from target
on conflict (player_id) do update
set
  pff_player_name = excluded.pff_player_name,
  current_team = excluded.current_team,
  jersey_number = excluded.jersey_number,
  height_in = excluded.height_in,
  weight_lbs = excluded.weight_lbs,
  draft_eligibility_year = excluded.draft_eligibility_year,
  source = excluded.source,
  raw_payload = excluded.raw_payload;

with target as (
  select id
  from public.players
  where first_name = 'Roy' and last_name = 'Alexander' and position = 'WR'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2025, 'TEXAS TECH', 'offense', 'manual_screenshot', 'offense_summary',
  '{
    "total_snaps": 27,
    "pass_snaps": 17,
    "pass_block_snaps": 0,
    "run_snaps": 0,
    "run_block_snaps": 10,
    "offense_grade": 63.8,
    "pass_grade": 66.9,
    "run_block_grade": 40.6,
    "penalties": "0 (0)"
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Roy' and last_name = 'Alexander' and position = 'WR'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2024, 'INCAR WORD', 'offense', 'manual_screenshot', 'offense_summary',
  '{
    "total_snaps": 918,
    "pass_snaps": 561,
    "pass_block_snaps": 0,
    "run_snaps": 8,
    "run_block_snaps": 349,
    "offense_grade": 74.8,
    "pass_grade": 75.7,
    "run_grade": 64.8,
    "run_block_grade": 59.4,
    "penalties": "1 (0)"
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Roy' and last_name = 'Alexander' and position = 'WR'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2023, 'ALBANY', 'offense', 'manual_screenshot', 'offense_summary',
  '{
    "total_snaps": 223,
    "pass_snaps": 162,
    "pass_block_snaps": 0,
    "run_snaps": 1,
    "run_block_snaps": 60,
    "offense_grade": 62.4,
    "pass_grade": 63.8,
    "run_grade": 63.1,
    "run_block_grade": 50.9,
    "penalties": "0 (0)"
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Roy' and last_name = 'Alexander' and position = 'WR'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2022, 'ALBANY', 'offense', 'manual_screenshot', 'offense_summary',
  '{
    "total_snaps": 541,
    "pass_snaps": 412,
    "pass_block_snaps": 2,
    "run_snaps": 9,
    "run_block_snaps": 118,
    "offense_grade": 66.3,
    "pass_grade": 67.1,
    "pass_block_grade": 65.7,
    "run_grade": 60.4,
    "run_block_grade": 58.8,
    "penalties": "3 (0)"
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Roy' and last_name = 'Alexander' and position = 'WR'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2021, 'ALBANY', 'offense', 'manual_screenshot', 'offense_summary',
  '{
    "total_snaps": 357,
    "pass_snaps": 238,
    "pass_block_snaps": 0,
    "run_snaps": 6,
    "run_block_snaps": 113,
    "offense_grade": 63.8,
    "pass_grade": 63.5,
    "run_grade": 65.6,
    "run_block_grade": 50.5,
    "penalties": "0 (0)"
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Roy' and last_name = 'Alexander' and position = 'WR'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2025, 'TEXAS TECH', 'receiving', 'manual_screenshot', 'receiving_summary',
  '{
    "targets": 4,
    "receptions": 3,
    "reception_pct": 75.0,
    "yards": 31,
    "yards_per_reception": 10.3,
    "touchdowns": 0,
    "offense_grade": 63.8,
    "receiving_grade": 66.9,
    "drop_grade": 73.1,
    "fumble_grade": 68.8,
    "pass_snaps": 17,
    "receiving_snaps": 14,
    "route_pct": 82.4,
    "slot_snaps": 15,
    "slot_pct": 88.2,
    "wide_snaps": 2,
    "wide_pct": 11.8,
    "inline_snaps": 0,
    "inline_pct": 0.0,
    "yac": 16
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Roy' and last_name = 'Alexander' and position = 'WR'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2025, 'TEXAS TECH', 'run_blocking', 'manual_screenshot', 'run_blocking_summary',
  '{
    "run": 10,
    "run_block": 10,
    "rb_pct": 100.0,
    "run_block_grade": 40.6,
    "penalties": "0 (0)",
    "zone_run_block_snaps": 9,
    "zone_snap_pct": 90.0,
    "gap_run_block_snaps": 1,
    "gap_snap_pct": 10.0
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Roy' and last_name = 'Alexander' and position = 'WR'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2025, 'TEXAS TECH', 'alignment', 'manual_screenshot', 'snaps_by_position_summary',
  '{
    "inline": 1,
    "slot": 23,
    "wide": 3,
    "kick_coverage": 1,
    "kick_return": 4,
    "punt_return": 5,
    "total": 37
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

-- Sam Feeney
with target as (
  select id
  from public.players
  where first_name = 'Sam' and last_name = 'Feeney' and position = 'EDGE'
  order by created_at desc
  limit 1
)
insert into public.player_pff_profiles (
  player_id, pff_player_name, current_team, jersey_number, height_in, weight_lbs, draft_eligibility_year, source, raw_payload
)
select
  id, 'Sam Feeney', 'Ball State Cardinals', 'ED #D48', 74, 197, 2028, 'manual_screenshot',
  '{"source_note":"Sam Feeney Ball State defense and snaps-by-position screenshots"}'::jsonb
from target
on conflict (player_id) do update
set
  pff_player_name = excluded.pff_player_name,
  current_team = excluded.current_team,
  jersey_number = excluded.jersey_number,
  height_in = excluded.height_in,
  weight_lbs = excluded.weight_lbs,
  draft_eligibility_year = excluded.draft_eligibility_year,
  source = excluded.source,
  raw_payload = excluded.raw_payload;

with target as (
  select id
  from public.players
  where first_name = 'Sam' and last_name = 'Feeney' and position = 'EDGE'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2025, 'BALL ST', 'defense', 'manual_screenshot', 'defense_summary',
  '{
    "total_snaps": 95,
    "run_defense_snaps": 33,
    "pass_rush_snaps": 41,
    "coverage_snaps": 21,
    "defense_grade": 54.9,
    "run_defense_grade": 45.4,
    "tackling_grade": 24.9,
    "pass_rush_grade": 60.4,
    "coverage_grade": 62.9,
    "pressure_total": 6,
    "sacks": 0,
    "hits": 2,
    "hurries": 4,
    "tackles": 2,
    "assists": 1,
    "missed_tackles": 3,
    "missed_tackle_rate": 50.0,
    "stops": 1,
    "targets": 0,
    "receptions_allowed": 0
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Sam' and last_name = 'Feeney' and position = 'EDGE'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2024, 'BALL ST', 'defense', 'manual_screenshot', 'defense_summary',
  '{
    "total_snaps": 69,
    "run_defense_snaps": 29,
    "pass_rush_snaps": 36,
    "coverage_snaps": 4,
    "defense_grade": 67.4,
    "run_defense_grade": 46.7,
    "tackling_grade": 28.9,
    "pass_rush_grade": 83.1,
    "coverage_grade": 47.7,
    "pressure_total": 5,
    "sacks": 3,
    "hits": 0,
    "hurries": 2,
    "tackles": 0,
    "assists": 0,
    "missed_tackles": 2,
    "missed_tackle_rate": 100.0,
    "stops": 3,
    "forced_fumbles": 1,
    "targets": 0,
    "receptions_allowed": 0
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Sam' and last_name = 'Feeney' and position = 'EDGE'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2025, 'BALL ST', 'alignment', 'manual_screenshot', 'snaps_by_position_summary',
  '{
    "dline": 74,
    "lolb": 44,
    "rolb": 30,
    "box": 21,
    "lilb": 6,
    "llb": 2,
    "mlb": 5,
    "rilb": 8,
    "kick_coverage": 18,
    "l4": 8,
    "l5": 7
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

-- Jalen Dye
with target as (
  select id
  from public.players
  where first_name = 'Jalen' and last_name = 'Dye' and position = 'S'
  order by created_at desc
  limit 1
)
insert into public.player_pff_profiles (
  player_id, pff_player_name, current_team, jersey_number, height_in, weight_lbs, draft_eligibility_year, source, raw_payload
)
select
  id, 'Jalen Dye', 'Kansas Jayhawks', 'S #D14', 72, 195, 2026, 'manual_screenshot',
  '{"source_note":"Jalen Dye Kansas defense screenshots"}'::jsonb
from target
on conflict (player_id) do update
set
  pff_player_name = excluded.pff_player_name,
  current_team = excluded.current_team,
  jersey_number = excluded.jersey_number,
  height_in = excluded.height_in,
  weight_lbs = excluded.weight_lbs,
  draft_eligibility_year = excluded.draft_eligibility_year,
  source = excluded.source,
  raw_payload = excluded.raw_payload;

with target as (
  select id
  from public.players
  where first_name = 'Jalen' and last_name = 'Dye' and position = 'S'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2025, 'KANSAS', 'defense', 'manual_screenshot', 'defense_summary',
  '{
    "total_snaps": 99,
    "run_defense_snaps": 54,
    "pass_rush_snaps": 3,
    "coverage_snaps": 42,
    "defense_grade": 76.9,
    "run_defense_grade": 87.3,
    "tackling_grade": 70.8,
    "pass_rush_grade": 82.0,
    "coverage_grade": 63.8,
    "pressure_total": 1,
    "sacks": 1,
    "hits": 0,
    "hurries": 0,
    "batted_passes": 0,
    "tackles": 7,
    "assists": 1,
    "missed_tackles": 1,
    "missed_tackle_rate": 11.1,
    "stops": 3,
    "forced_fumbles": 2,
    "targets": 3,
    "receptions_allowed": 1,
    "reception_pct_allowed": 33.3,
    "yards_allowed": 22,
    "yards_per_reception_allowed": 22.0,
    "yards_after_catch_allowed": 3,
    "longest_reception_allowed": 22
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Jalen' and last_name = 'Dye' and position = 'S'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2024, 'KANSAS', 'defense', 'manual_screenshot', 'defense_summary',
  '{
    "total_snaps": 131,
    "run_defense_snaps": 57,
    "pass_rush_snaps": 6,
    "coverage_snaps": 68,
    "defense_grade": 55.4,
    "run_defense_grade": 63.0,
    "tackling_grade": 73.1,
    "pass_rush_grade": 53.7,
    "coverage_grade": 53.5,
    "pressure_total": 1,
    "sacks": 0,
    "hits": 0,
    "hurries": 1,
    "batted_passes": 0,
    "tackles": 14,
    "assists": 1,
    "missed_tackles": 2,
    "missed_tackle_rate": 11.8,
    "stops": 4,
    "targets": 7,
    "receptions_allowed": 6,
    "reception_pct_allowed": 85.7,
    "yards_allowed": 69,
    "yards_per_reception_allowed": 11.5,
    "yards_after_catch_allowed": 17,
    "longest_reception_allowed": 28
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

-- Khari Gee
with target as (
  select id
  from public.players
  where first_name = 'Khari' and last_name = 'Gee' and position = 'S'
  order by created_at desc
  limit 1
)
insert into public.player_pff_profiles (
  player_id, pff_player_name, current_team, jersey_number, height_in, weight_lbs, draft_eligibility_year, source, raw_payload
)
select
  id, 'Khari Gee', 'Chattanooga Mocs', 'S #D0', 74, 199, 2027, 'manual_screenshot',
  '{"source_note":"Khari Gee Chattanooga defense screenshots"}'::jsonb
from target
on conflict (player_id) do update
set
  pff_player_name = excluded.pff_player_name,
  current_team = excluded.current_team,
  jersey_number = excluded.jersey_number,
  height_in = excluded.height_in,
  weight_lbs = excluded.weight_lbs,
  draft_eligibility_year = excluded.draft_eligibility_year,
  source = excluded.source,
  raw_payload = excluded.raw_payload;

with target as (
  select id
  from public.players
  where first_name = 'Khari' and last_name = 'Gee' and position = 'S'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2025, 'CHATTNOOGA', 'defense', 'manual_screenshot', 'defense_summary',
  '{
    "total_snaps": 392,
    "run_defense_snaps": 185,
    "pass_rush_snaps": 4,
    "coverage_snaps": 203,
    "defense_grade": 57.9,
    "run_defense_grade": 52.0,
    "tackling_grade": 36.4,
    "pass_rush_grade": 56.5,
    "coverage_grade": 60.9,
    "pressure_total": 1,
    "sacks": 0,
    "hits": 0,
    "hurries": 1,
    "batted_passes": 0,
    "tackles": 30,
    "assists": 11,
    "missed_tackles": 13,
    "missed_tackle_rate": 24.1,
    "stops": 10,
    "forced_fumbles": 0,
    "targets": 17,
    "receptions_allowed": 15,
    "reception_pct_allowed": 88.2,
    "yards_allowed": 180,
    "yards_per_reception_allowed": 12.0,
    "yards_after_catch_allowed": 58,
    "longest_reception_allowed": 25
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Khari' and last_name = 'Gee' and position = 'S'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2023, 'GA TECH', 'defense', 'manual_screenshot', 'defense_summary',
  '{
    "total_snaps": 5,
    "run_defense_snaps": 5,
    "pass_rush_snaps": 0,
    "coverage_snaps": 0,
    "defense_grade": 64.6,
    "run_defense_grade": 63.1,
    "tackling_grade": 73.1
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Khari' and last_name = 'Gee' and position = 'S'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2022, 'GA TECH', 'defense', 'manual_screenshot', 'defense_summary',
  '{
    "total_snaps": 56,
    "run_defense_snaps": 27,
    "pass_rush_snaps": 2,
    "coverage_snaps": 27,
    "defense_grade": 61.3,
    "run_defense_grade": 48.8,
    "tackling_grade": 27.5,
    "pass_rush_grade": 71.0,
    "coverage_grade": 66.9,
    "pressure_total": 1,
    "sacks": 1,
    "tackles": 4,
    "assists": 2,
    "missed_tackles": 4,
    "missed_tackle_rate": 40.0,
    "stops": 3,
    "targets": 2,
    "receptions_allowed": 1,
    "reception_pct_allowed": 50.0,
    "yards_allowed": 11,
    "yards_per_reception_allowed": 11.0,
    "yards_after_catch_allowed": 10,
    "longest_reception_allowed": 11
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

-- Jameel Croft Jr.
with target as (
  select id
  from public.players
  where first_name = 'Jameel' and last_name ilike 'Croft%' and position = 'CB'
  order by created_at desc
  limit 1
)
insert into public.player_pff_profiles (
  player_id, pff_player_name, current_team, jersey_number, height_in, weight_lbs, draft_eligibility_year, source, raw_payload
)
select
  id, 'Jameel Croft Jr.', 'Charlotte 49ers', 'CB #D29', 72, 195, 2028, 'manual_screenshot',
  '{"source_note":"Jameel Croft Jr. Charlotte defense screenshots"}'::jsonb
from target
on conflict (player_id) do update
set
  pff_player_name = excluded.pff_player_name,
  current_team = excluded.current_team,
  jersey_number = excluded.jersey_number,
  height_in = excluded.height_in,
  weight_lbs = excluded.weight_lbs,
  draft_eligibility_year = excluded.draft_eligibility_year,
  source = excluded.source,
  raw_payload = excluded.raw_payload;

with target as (
  select id
  from public.players
  where first_name = 'Jameel' and last_name ilike 'Croft%' and position = 'CB'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2025, 'KANSAS', 'defense', 'manual_screenshot', 'defense_summary',
  '{
    "total_snaps": 2,
    "run_defense_snaps": 2,
    "pass_rush_snaps": 0,
    "coverage_snaps": 0,
    "defense_grade": 62.9,
    "run_defense_grade": 62.8,
    "tackling_grade": 74.8,
    "pressure_total": 0,
    "tackles": 1,
    "assists": 0,
    "missed_tackles": 0,
    "missed_tackle_rate": 0.0,
    "stops": 0
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Jameel' and last_name ilike 'Croft%' and position = 'CB'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2024, 'KANSAS', 'defense', 'manual_screenshot', 'defense_summary',
  '{
    "total_snaps": 2,
    "run_defense_snaps": 0,
    "pass_rush_snaps": 0,
    "coverage_snaps": 2,
    "defense_grade": 63.6,
    "coverage_grade": 62.3,
    "pressure_total": 0,
    "tackles": 0
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

-- Kade Kostus
with target as (
  select id
  from public.players
  where first_name = 'Kade' and last_name = 'Kostus' and position = 'DL'
  order by created_at desc
  limit 1
)
insert into public.player_pff_profiles (
  player_id, pff_player_name, current_team, jersey_number, height_in, weight_lbs, draft_eligibility_year, source, raw_payload
)
select
  id, 'Kade Kostus', 'Central Michigan Chippewas', 'DI #D44', 74, 260, 2027, 'manual_screenshot',
  '{"source_note":"Kade Kostus Central Michigan defense and alignment screenshots"}'::jsonb
from target
on conflict (player_id) do update
set
  pff_player_name = excluded.pff_player_name,
  current_team = excluded.current_team,
  jersey_number = excluded.jersey_number,
  height_in = excluded.height_in,
  weight_lbs = excluded.weight_lbs,
  draft_eligibility_year = excluded.draft_eligibility_year,
  source = excluded.source,
  raw_payload = excluded.raw_payload;

with target as (
  select id
  from public.players
  where first_name = 'Kade' and last_name = 'Kostus' and position = 'DL'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2025, 'C MICHIGAN', 'defense', 'manual_screenshot', 'defense_summary',
  '{
    "total_snaps": 103,
    "run_defense_snaps": 47,
    "pass_rush_snaps": 56,
    "coverage_snaps": 0,
    "defense_grade": 46.1,
    "run_defense_grade": 42.2,
    "tackling_grade": 73.8,
    "pass_rush_grade": 59.5,
    "coverage_grade": 60.0,
    "pressure_total": 2,
    "sacks": 1,
    "hits": 0,
    "hurries": 1,
    "tackles": 1,
    "assists": 1,
    "missed_tackles": 0,
    "missed_tackle_rate": 0.0,
    "stops": 2
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Kade' and last_name = 'Kostus' and position = 'DL'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2024, 'C MICHIGAN', 'defense', 'manual_screenshot', 'defense_summary',
  '{
    "total_snaps": 471,
    "run_defense_snaps": 234,
    "pass_rush_snaps": 234,
    "coverage_snaps": 3,
    "defense_grade": 54.0,
    "run_defense_grade": 60.6,
    "tackling_grade": 83.0,
    "pass_rush_grade": 48.7,
    "coverage_grade": 57.8,
    "pressure_total": 7,
    "sacks": 1,
    "hits": 0,
    "hurries": 6,
    "tackles": 13,
    "assists": 4,
    "missed_tackles": 0,
    "missed_tackle_rate": 0.0,
    "stops": 14
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Kade' and last_name = 'Kostus' and position = 'DL'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2023, 'C MICHIGAN', 'defense', 'manual_screenshot', 'defense_summary',
  '{
    "total_snaps": 75,
    "run_defense_snaps": 40,
    "pass_rush_snaps": 35,
    "coverage_snaps": 0,
    "defense_grade": 51.3,
    "run_defense_grade": 58.9,
    "tackling_grade": 76.2,
    "pass_rush_grade": 51.3
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Kade' and last_name = 'Kostus' and position = 'DL'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2025, 'C MICHIGAN', 'alignment', 'manual_screenshot', 'alignment_summary',
  '{
    "dl": 102,
    "box": 1,
    "agp": 0,
    "bgp": 90,
    "ovt": 12,
    "out": 0
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

-- Grant Fielder
with target as (
  select id
  from public.players
  where first_name = 'Grant' and last_name = 'Fielder' and position = 'EDGE'
  order by created_at desc
  limit 1
)
insert into public.player_pff_profiles (
  player_id, pff_player_name, current_team, jersey_number, height_in, weight_lbs, draft_eligibility_year, source, raw_payload
)
select
  id, 'Grant Fielder', 'Florida State Seminoles', 'ED #D98', 74, 245, 2028, 'manual_screenshot',
  '{"source_note":"Grant Fielder Florida State defense and alignment screenshots"}'::jsonb
from target
on conflict (player_id) do update
set
  pff_player_name = excluded.pff_player_name,
  current_team = excluded.current_team,
  jersey_number = excluded.jersey_number,
  height_in = excluded.height_in,
  weight_lbs = excluded.weight_lbs,
  draft_eligibility_year = excluded.draft_eligibility_year,
  source = excluded.source,
  raw_payload = excluded.raw_payload;

with target as (
  select id
  from public.players
  where first_name = 'Grant' and last_name = 'Fielder' and position = 'EDGE'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2025, 'FLORIDA ST', 'defense', 'manual_screenshot', 'defense_summary',
  '{
    "total_snaps": 28,
    "run_defense_snaps": 12,
    "pass_rush_snaps": 15,
    "coverage_snaps": 1,
    "defense_grade": 65.3,
    "run_defense_grade": 68.3,
    "tackling_grade": 72.2,
    "pass_rush_grade": 58.0,
    "coverage_grade": 60.0,
    "pressure_total": 0,
    "tackles": 1,
    "stops": 1
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Grant' and last_name = 'Fielder' and position = 'EDGE'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2024, 'FLORIDA ST', 'defense', 'manual_screenshot', 'defense_summary',
  '{
    "total_snaps": 3,
    "run_defense_snaps": 2,
    "pass_rush_snaps": 1,
    "coverage_snaps": 0,
    "defense_grade": 41.4,
    "run_defense_grade": 50.5,
    "tackling_grade": 71.5,
    "pass_rush_grade": 59.7
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Grant' and last_name = 'Fielder' and position = 'EDGE'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2023, 'FLORIDA ST', 'defense', 'manual_screenshot', 'defense_summary',
  '{
    "total_snaps": 7,
    "run_defense_snaps": 5,
    "pass_rush_snaps": 2,
    "coverage_snaps": 0,
    "defense_grade": 47.3,
    "run_defense_grade": 50.1,
    "tackling_grade": 72.2,
    "pass_rush_grade": 58.5
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Grant' and last_name = 'Fielder' and position = 'EDGE'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2025, 'FLORIDA ST', 'alignment', 'manual_screenshot', 'alignment_summary',
  '{
    "dl": 28,
    "bgp": 1,
    "ovt": 3,
    "out": 24
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

-- Devarrick Woods
with target as (
  select id
  from public.players
  where first_name = 'Devarrick' and last_name = 'Woods' and position = 'DL'
  order by created_at desc
  limit 1
)
insert into public.player_pff_profiles (
  player_id, pff_player_name, current_team, jersey_number, height_in, weight_lbs, draft_eligibility_year, source, raw_payload
)
select
  id, 'Devarrick Woods', 'Texas State Bobcats', 'DI #97', 75, 290, 2027, 'manual_screenshot',
  '{"source_note":"Devarrick Woods Texas State defense screenshot"}'::jsonb
from target
on conflict (player_id) do update
set
  pff_player_name = excluded.pff_player_name,
  current_team = excluded.current_team,
  jersey_number = excluded.jersey_number,
  height_in = excluded.height_in,
  weight_lbs = excluded.weight_lbs,
  draft_eligibility_year = excluded.draft_eligibility_year,
  source = excluded.source,
  raw_payload = excluded.raw_payload;

with target as (
  select id
  from public.players
  where first_name = 'Devarrick' and last_name = 'Woods' and position = 'DL'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2025, 'TEXAS ST', 'defense', 'manual_screenshot', 'defense_summary',
  '{
    "total_snaps": 177,
    "run_defense_snaps": 82,
    "pass_rush_snaps": 95,
    "coverage_snaps": 0,
    "defense_grade": 74.2,
    "run_defense_grade": 70.8,
    "tackling_grade": 80.9,
    "pass_rush_grade": 66.3,
    "coverage_grade": 73.4,
    "pressure_total": 11,
    "sacks": 1,
    "hits": 1,
    "hurries": 9,
    "tackles": 15,
    "assists": 2,
    "missed_tackles": 0,
    "missed_tackle_rate": 0.0,
    "stops": 15
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

-- Reymello Murphy
with target as (
  select id
  from public.players
  where first_name = 'Reymello' and last_name = 'Murphy' and position = 'WR'
  order by created_at desc
  limit 1
)
insert into public.player_pff_profiles (
  player_id, pff_player_name, current_team, jersey_number, height_in, weight_lbs, draft_eligibility_year, source, raw_payload
)
select
  id, 'Reymello Murphy', 'Connecticut Huskies', 'WR #6', 72, 185, 2026, 'manual_screenshot',
  '{"source_note":"Reymello Murphy UConn receiving, blocking, and snaps-by-position screenshots"}'::jsonb
from target
on conflict (player_id) do update
set
  pff_player_name = excluded.pff_player_name,
  current_team = excluded.current_team,
  jersey_number = excluded.jersey_number,
  height_in = excluded.height_in,
  weight_lbs = excluded.weight_lbs,
  draft_eligibility_year = excluded.draft_eligibility_year,
  source = excluded.source,
  raw_payload = excluded.raw_payload;

with target as (
  select id
  from public.players
  where first_name = 'Reymello' and last_name = 'Murphy' and position = 'WR'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2025, 'UCONN', 'receiving', 'manual_screenshot', 'receiving_summary',
  '{
    "targets": 49,
    "receptions": 38,
    "reception_pct": 77.6,
    "yards": 439,
    "yards_per_reception": 11.6,
    "touchdowns": 3,
    "offense_grade": 67.3,
    "receiving_grade": 68.8,
    "drop_grade": 84.9,
    "fumble_grade": 73.0,
    "pass_snaps": 317,
    "receiving_snaps": 297,
    "route_pct": 93.7,
    "slot_snaps": 270,
    "slot_pct": 85.2,
    "wide_snaps": 43,
    "wide_pct": 13.6,
    "inline_snaps": 4,
    "inline_pct": 1.3,
    "yac": 235
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Reymello' and last_name = 'Murphy' and position = 'WR'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2025, 'UCONN', 'blocking', 'manual_screenshot', 'blocking_summary',
  '{
    "offense_snaps": 422,
    "block_snaps": 105,
    "block_pct": 24.9,
    "run_block_snaps": 105,
    "offense_grade": 67.3,
    "run_block_grade": 46.5,
    "penalties": "2 (0)",
    "ite_total": 6
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Reymello' and last_name = 'Murphy' and position = 'WR'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2025, 'UCONN', 'alignment', 'manual_screenshot', 'snaps_by_position_summary',
  '{
    "backfield": 1,
    "fb_l": 1,
    "inline": 6,
    "te_l": 3,
    "te_r": 3,
    "slot": 354,
    "slwr": 87,
    "sliwr": 50,
    "slowr": 47,
    "srwr": 83,
    "sriwr": 44,
    "srowr": 43,
    "wide": 61,
    "lwr": 35,
    "rwr": 26
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

-- Tyrell Reed Jr.
with target as (
  select id
  from public.players
  where first_name = 'Tyrell' and last_name ilike 'Reed%' and position = 'RB'
  order by created_at desc
  limit 1
)
insert into public.player_pff_profiles (
  player_id, pff_player_name, current_team, jersey_number, height_in, weight_lbs, draft_eligibility_year, source, raw_payload
)
select
  id, 'Tyrell Reed Jr.', 'Southeast Missouri State Redhawks', 'HB #29', 70, 210, 2028, 'manual_screenshot',
  '{"source_note":"Tyrell Reed Jr. SEMO offense, rushing, pass blocking, and snaps-by-position screenshots"}'::jsonb
from target
on conflict (player_id) do update
set
  pff_player_name = excluded.pff_player_name,
  current_team = excluded.current_team,
  jersey_number = excluded.jersey_number,
  height_in = excluded.height_in,
  weight_lbs = excluded.weight_lbs,
  draft_eligibility_year = excluded.draft_eligibility_year,
  source = excluded.source,
  raw_payload = excluded.raw_payload;

with target as (
  select id
  from public.players
  where first_name = 'Tyrell' and last_name ilike 'Reed%' and position = 'RB'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2025, 'LA MONROE', 'offense', 'manual_screenshot', 'offense_summary',
  '{
    "total_snaps": 57,
    "pass_snaps": 11,
    "pass_block_snaps": 7,
    "run_snaps": 35,
    "run_block_snaps": 4,
    "offense_grade": 78.4,
    "pass_grade": 55.1,
    "pass_block_grade": 62.2,
    "run_grade": 76.9,
    "run_block_grade": 59.1,
    "penalties": "0 (0)"
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Tyrell' and last_name ilike 'Reed%' and position = 'RB'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2025, 'LA MONROE', 'rushing', 'manual_screenshot', 'rushing_summary',
  '{
    "snaps": 39,
    "attempts": 33,
    "yards": 137,
    "yards_per_attempt": 4.2,
    "touchdowns": 0,
    "fumbles": 0,
    "offense_grade": 78.4,
    "rushing_grade": 76.9,
    "fumble_grade": 80.0,
    "run_block_grade": 59.1,
    "yards_after_contact": 110,
    "yards_after_contact_per_attempt": 3.33,
    "missed_tackles_forced": 10,
    "longest_run": 19,
    "runs_10_plus": 4,
    "zone_runs": 19,
    "gap_runs": 9,
    "designed_yards": 137,
    "runs_15_plus": 3,
    "breakaway_yards": 53,
    "breakaway_yard_pct": 38.7,
    "first_downs": 6,
    "penalties": "0 (0)"
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Tyrell' and last_name ilike 'Reed%' and position = 'RB'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2025, 'LA MONROE', 'pass_blocking', 'manual_screenshot', 'pass_blocking_summary',
  '{
    "pass": 18,
    "pblk": 7,
    "pb_pct": 38.9,
    "pblk_grade": 62.2,
    "penalties": "0 (0)",
    "opp": 6,
    "opp_pct": 35.3,
    "hurries_allowed": 1,
    "pressures_allowed": 1,
    "efficiency": 91.7,
    "tps_pass": 2,
    "tps_pblk": 1,
    "tps_pb_pct": 50.0,
    "tps_opp": 1,
    "tps_opp_pct": 50.0,
    "tps_efficiency": 100.0
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Tyrell' and last_name ilike 'Reed%' and position = 'RB'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2025, 'SEMO', 'alignment', 'manual_screenshot', 'snaps_by_position_summary',
  '{
    "backfield": 56,
    "slot": 1,
    "kick_return": 11,
    "total": 68
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

-- Devin Miles
with target as (
  select id
  from public.players
  where first_name = 'Devin' and last_name = 'Miles' and position = 'RB'
  order by created_at desc
  limit 1
)
insert into public.player_pff_profiles (
  player_id, pff_player_name, current_team, jersey_number, height_in, weight_lbs, draft_eligibility_year, source, raw_payload
)
select
  id, 'Devin Miles', 'Western Michigan Broncos', 'HB #5', 69, 184, 2026, 'manual_screenshot',
  '{"source_note":"Devin Miles Western Michigan rushing, receiving, blocking, and snaps-by-position screenshots"}'::jsonb
from target
on conflict (player_id) do update
set
  pff_player_name = excluded.pff_player_name,
  current_team = excluded.current_team,
  jersey_number = excluded.jersey_number,
  height_in = excluded.height_in,
  weight_lbs = excluded.weight_lbs,
  draft_eligibility_year = excluded.draft_eligibility_year,
  source = excluded.source,
  raw_payload = excluded.raw_payload;

with target as (
  select id
  from public.players
  where first_name = 'Devin' and last_name = 'Miles' and position = 'RB'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2025, 'W MICHIGAN', 'rushing', 'manual_screenshot', 'rushing_summary',
  '{
    "snaps": 143,
    "attempts": 98,
    "yards": 422,
    "yards_per_attempt": 4.3,
    "touchdowns": 3,
    "fumbles": 1,
    "offense_grade": 70.3,
    "rushing_grade": 72.9,
    "fumble_grade": 75.6,
    "run_block_grade": 55.4,
    "yards_after_contact": 293,
    "yards_after_contact_per_attempt": 2.99,
    "missed_tackles_forced": 32,
    "longest_run": 32,
    "runs_10_plus": 7,
    "zone_runs": 48,
    "gap_runs": 48,
    "designed_yards": 422,
    "runs_15_plus": 4,
    "breakaway_yards": 90,
    "breakaway_yard_pct": 21.3,
    "first_downs": 21,
    "penalties": "0 (0)"
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Devin' and last_name = 'Miles' and position = 'RB'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2025, 'W MICHIGAN', 'receiving', 'manual_screenshot', 'receiving_summary',
  '{
    "targets": 9,
    "receptions": 5,
    "reception_pct": 55.6,
    "yards": 36,
    "yards_per_reception": 7.2,
    "touchdowns": 0,
    "offense_grade": 70.3,
    "receiving_grade": 44.4,
    "drop_grade": 29.3,
    "fumble_grade": 75.6,
    "pass_block_grade": 67.4,
    "pass_snaps": 106,
    "receiving_snaps": 57,
    "route_pct": 53.8,
    "pass_block_snaps": 45,
    "pass_block_pct": 42.5,
    "slot_snaps": 2,
    "slot_pct": 1.9,
    "wide_snaps": 7,
    "wide_pct": 6.6,
    "inline_pct": 0.0,
    "yac": 54
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Devin' and last_name = 'Miles' and position = 'RB'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2025, 'W MICHIGAN', 'blocking', 'manual_screenshot', 'blocking_summary',
  '{
    "offense_snaps": 249,
    "block_snaps": 88,
    "block_pct": 35.3,
    "run_block_snaps": 43,
    "pass_block_snaps": 45,
    "offense_grade": 70.3,
    "run_block_grade": 55.4,
    "pass_block_grade": 67.4,
    "opp": 42,
    "opp_pct": 42.4,
    "hits_allowed": 1,
    "pressures_allowed": 1,
    "efficiency": 98.8,
    "penalties": "0 (0)"
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Devin' and last_name = 'Miles' and position = 'RB'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2025, 'W MICHIGAN', 'alignment', 'manual_screenshot', 'snaps_by_position_summary',
  '{
    "backfield": 230,
    "fb_r": 4,
    "hb": 35,
    "hb_l": 81,
    "hb_r": 110,
    "slot": 7,
    "sliwr": 6,
    "sriwr": 1,
    "wide": 12,
    "lwr": 4,
    "rwr": 8,
    "kick_return": 55,
    "kr": 4
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

-- Leonard Sherrod
with target as (
  select id
  from public.players
  where first_name = 'Leonard' and last_name = 'Sherrod' and position = 'S'
  order by created_at desc
  limit 1
)
insert into public.player_pff_profiles (
  player_id, pff_player_name, current_team, jersey_number, height_in, weight_lbs, draft_eligibility_year, source, raw_payload
)
select
  id, 'Leonard Sherrod', 'Tennessee Tech Golden Eagles', 'S #0', 75, null, 2027, 'manual_screenshot',
  '{"source_note":"Leonard Sherrod Tennessee Tech / WHU defense screenshots"}'::jsonb
from target
on conflict (player_id) do update
set
  pff_player_name = excluded.pff_player_name,
  current_team = excluded.current_team,
  jersey_number = excluded.jersey_number,
  height_in = excluded.height_in,
  weight_lbs = excluded.weight_lbs,
  draft_eligibility_year = excluded.draft_eligibility_year,
  source = excluded.source,
  raw_payload = excluded.raw_payload;

with target as (
  select id
  from public.players
  where first_name = 'Leonard' and last_name = 'Sherrod' and position = 'S'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2024, 'WHU', 'defense', 'manual_screenshot', 'defense_summary',
  '{
    "total_snaps": 29,
    "run_defense_snaps": 14,
    "pass_rush_snaps": 0,
    "coverage_snaps": 15,
    "defense_grade": 61.0,
    "run_defense_grade": 74.4,
    "tackling_grade": 84.0,
    "coverage_grade": 51.3,
    "pressure_total": 0,
    "sacks": 0,
    "hits": 0,
    "hurries": 0,
    "batted_passes": 0,
    "tackles": 2,
    "assists": 4,
    "missed_tackles": 0,
    "missed_tackle_rate": 0.0,
    "stops": 0,
    "forced_fumbles": 0,
    "targets": 0,
    "receptions_allowed": 0,
    "yards_allowed": 0,
    "yards_per_reception_allowed": 0.0,
    "yac_allowed": 0,
    "longest_reception_allowed": 0
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

-- Davis Dotson
with target as (
  select id
  from public.players
  where first_name = 'Davis' and last_name = 'Dotson' and position = 'OL'
  order by created_at desc
  limit 1
)
insert into public.player_pff_profiles (
  player_id, pff_player_name, current_team, jersey_number, height_in, weight_lbs, draft_eligibility_year, source, raw_payload
)
select
  id, 'Davis Dotson', 'Oklahoma State Cowboys', 'T #78', 78, 305, 2027, 'manual_screenshot',
  '{"source_note":"Davis Dotson Oklahoma State offense / run-blocking / snaps-by-position screenshots"}'::jsonb
from target
on conflict (player_id) do update
set
  pff_player_name = excluded.pff_player_name,
  current_team = excluded.current_team,
  jersey_number = excluded.jersey_number,
  height_in = excluded.height_in,
  weight_lbs = excluded.weight_lbs,
  draft_eligibility_year = excluded.draft_eligibility_year,
  source = excluded.source,
  raw_payload = excluded.raw_payload;

with target as (
  select id
  from public.players
  where first_name = 'Davis' and last_name = 'Dotson' and position = 'OL'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2025, 'OKLA STATE', 'offense', 'manual_screenshot', 'offense_summary',
  '{
    "total_snaps": 15,
    "pass_snaps": 0,
    "pass_block_snaps": 11,
    "run_snaps": 0,
    "run_block_snaps": 4,
    "offense_grade": 58.6,
    "pass_block_grade": 64.5,
    "run_block_grade": 55.5,
    "penalties": "0 (0)"
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Davis' and last_name = 'Dotson' and position = 'OL'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2024, 'OKLA STATE', 'offense', 'manual_screenshot', 'offense_summary',
  '{
    "total_snaps": 9,
    "pass_snaps": 0,
    "pass_block_snaps": 2,
    "run_snaps": 0,
    "run_block_snaps": 7,
    "offense_grade": 73.4,
    "pass_block_grade": 72.8,
    "run_block_grade": 72.6,
    "penalties": "0 (0)"
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Davis' and last_name = 'Dotson' and position = 'OL'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2023, 'OKLA STATE', 'offense', 'manual_screenshot', 'offense_summary',
  '{
    "total_snaps": 9,
    "pass_snaps": 0,
    "pass_block_snaps": 2,
    "run_snaps": 0,
    "run_block_snaps": 7,
    "offense_grade": 50.5,
    "pass_block_grade": 72.9,
    "run_block_grade": 49.6,
    "penalties": "0 (0)"
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Davis' and last_name = 'Dotson' and position = 'OL'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2025, 'OKLA STATE', 'run_blocking', 'manual_screenshot', 'run_blocking_summary',
  '{
    "run_snaps": 4,
    "run_block_snaps": 4,
    "run_block_pct": 100.0,
    "run_block_grade": 55.5,
    "penalties": "0 (0)",
    "zone_run_block_snaps": 4,
    "zone_snap_pct": 100.0,
    "gap_run_block_snaps": 0,
    "gap_snap_pct": 0.0
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Davis' and last_name = 'Dotson' and position = 'OL'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2024, 'OKLA STATE', 'run_blocking', 'manual_screenshot', 'run_blocking_summary',
  '{
    "run_snaps": 7,
    "run_block_snaps": 7,
    "run_block_pct": 100.0,
    "run_block_grade": 72.6,
    "penalties": "0 (0)",
    "zone_run_block_snaps": 6,
    "zone_snap_pct": 85.7,
    "gap_run_block_snaps": 1,
    "gap_snap_pct": 14.3
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Davis' and last_name = 'Dotson' and position = 'OL'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2023, 'OKLA STATE', 'run_blocking', 'manual_screenshot', 'run_blocking_summary',
  '{
    "run_snaps": 7,
    "run_block_snaps": 7,
    "run_block_pct": 100.0,
    "run_block_grade": 49.6,
    "penalties": "0 (0)",
    "zone_run_block_snaps": 4,
    "zone_snap_pct": 57.1,
    "gap_run_block_snaps": 3,
    "gap_snap_pct": 42.9
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Davis' and last_name = 'Dotson' and position = 'OL'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2025, 'OKLA STATE', 'snaps_by_position', 'manual_screenshot', 'snaps_by_position_summary',
  '{
    "oline_total": 15,
    "fg_xp_kick_total": 37,
    "grand_total": 52
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

-- Roy Alexander
with target as (
  select id
  from public.players
  where first_name = 'Roy' and last_name = 'Alexander' and position = 'WR'
  order by created_at desc
  limit 1
)
insert into public.player_pff_profiles (
  player_id, pff_player_name, current_team, jersey_number, height_in, weight_lbs, draft_eligibility_year, source, raw_payload
)
select
  id, 'Roy Alexander', 'Texas Tech Red Raiders', 'WR #18', 71, 200, 2026, 'manual_screenshot',
  '{"source_note":"Roy Alexander Texas Tech offense / receiving / run-blocking / receiving-depth / snaps-by-position screenshots"}'::jsonb
from target
on conflict (player_id) do update
set
  pff_player_name = excluded.pff_player_name,
  current_team = excluded.current_team,
  jersey_number = excluded.jersey_number,
  height_in = excluded.height_in,
  weight_lbs = excluded.weight_lbs,
  draft_eligibility_year = excluded.draft_eligibility_year,
  source = excluded.source,
  raw_payload = excluded.raw_payload;

with target as (
  select id
  from public.players
  where first_name = 'Roy' and last_name = 'Alexander' and position = 'WR'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2025, 'TEXAS TECH', 'offense', 'manual_screenshot', 'offense_summary',
  '{
    "total_snaps": 27,
    "pass_snaps": 17,
    "pass_block_snaps": 0,
    "run_snaps": 0,
    "run_block_snaps": 10,
    "offense_grade": 63.8,
    "pass_grade": 66.9,
    "run_block_grade": 40.6,
    "penalties": "0 (0)"
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Roy' and last_name = 'Alexander' and position = 'WR'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2024, 'INCAR WORD', 'offense', 'manual_screenshot', 'offense_summary',
  '{
    "total_snaps": 918,
    "pass_snaps": 561,
    "pass_block_snaps": 0,
    "run_snaps": 8,
    "run_block_snaps": 349,
    "offense_grade": 74.8,
    "pass_grade": 75.7,
    "run_grade": 64.8,
    "run_block_grade": 59.4,
    "penalties": "1 (0)"
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Roy' and last_name = 'Alexander' and position = 'WR'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2023, 'ALBANY', 'offense', 'manual_screenshot', 'offense_summary',
  '{
    "total_snaps": 223,
    "pass_snaps": 162,
    "pass_block_snaps": 0,
    "run_snaps": 1,
    "run_block_snaps": 60,
    "offense_grade": 62.4,
    "pass_grade": 63.8,
    "run_grade": 63.1,
    "run_block_grade": 50.9,
    "penalties": "0 (0)"
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Roy' and last_name = 'Alexander' and position = 'WR'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2022, 'ALBANY', 'offense', 'manual_screenshot', 'offense_summary',
  '{
    "total_snaps": 541,
    "pass_snaps": 412,
    "pass_block_snaps": 2,
    "run_snaps": 9,
    "run_block_snaps": 118,
    "offense_grade": 66.3,
    "pass_grade": 67.1,
    "pass_block_grade": 65.7,
    "run_grade": 60.4,
    "run_block_grade": 58.8,
    "penalties": "3 (0)"
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Roy' and last_name = 'Alexander' and position = 'WR'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2021, 'ALBANY', 'offense', 'manual_screenshot', 'offense_summary',
  '{
    "total_snaps": 357,
    "pass_snaps": 238,
    "pass_block_snaps": 0,
    "run_snaps": 6,
    "run_block_snaps": 113,
    "offense_grade": 63.8,
    "pass_grade": 63.5,
    "run_grade": 65.6,
    "run_block_grade": 50.5,
    "penalties": "0 (0)"
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Roy' and last_name = 'Alexander' and position = 'WR'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2025, 'TEXAS TECH', 'receiving', 'manual_screenshot', 'receiving_summary',
  '{
    "targets": 4,
    "receptions": 3,
    "reception_pct": 75.0,
    "yards": 31,
    "yards_per_reception": 10.3,
    "touchdowns": 0,
    "offense_grade": 63.8,
    "receiving_grade": 66.9,
    "drop_grade": 73.1,
    "fumble_grade": 68.8,
    "pass_snaps": 17,
    "receiving_snaps": 14,
    "route_pct": 82.4,
    "pass_block_snaps": 0,
    "pass_block_pct": 0.0,
    "slot_snaps": 15,
    "slot_pct": 88.2,
    "wide_snaps": 2,
    "wide_pct": 11.8,
    "inline_snaps": 0,
    "inline_pct": 0.0,
    "yac": 16,
    "yac_per_reception": 5.3,
    "yards_per_route_run": 2.21
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Roy' and last_name = 'Alexander' and position = 'WR'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2024, 'INCAR WORD', 'receiving', 'manual_screenshot', 'receiving_summary',
  '{
    "targets": 139,
    "receptions": 101,
    "reception_pct": 72.7,
    "yards": 1121,
    "yards_per_reception": 11.1,
    "touchdowns": 13,
    "offense_grade": 74.8,
    "receiving_grade": 75.7,
    "drop_grade": 90.2,
    "fumble_grade": 25.4,
    "pass_snaps": 561,
    "receiving_snaps": 535,
    "route_pct": 95.4,
    "pass_block_snaps": 0,
    "pass_block_pct": 0.0,
    "slot_snaps": 482,
    "slot_pct": 85.9,
    "wide_snaps": 76,
    "wide_pct": 13.5,
    "inline_snaps": 1,
    "inline_pct": 0.2,
    "yac": 538,
    "yac_per_reception": 5.3,
    "yards_per_route_run": 2.10
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Roy' and last_name = 'Alexander' and position = 'WR'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2023, 'ALBANY', 'receiving', 'manual_screenshot', 'receiving_summary',
  '{
    "targets": 28,
    "receptions": 18,
    "reception_pct": 64.3,
    "yards": 144,
    "yards_per_reception": 8.0,
    "touchdowns": 2,
    "offense_grade": 62.4,
    "receiving_grade": 63.8,
    "drop_grade": 74.4,
    "fumble_grade": 29.6,
    "pass_snaps": 162,
    "receiving_snaps": 156,
    "route_pct": 96.3,
    "pass_block_snaps": 0,
    "pass_block_pct": 0.0,
    "slot_snaps": 153,
    "slot_pct": 94.4,
    "wide_snaps": 4,
    "wide_pct": 2.5,
    "inline_snaps": 1,
    "inline_pct": 0.6,
    "yac": 124,
    "yac_per_reception": 6.9,
    "yards_per_route_run": 0.92
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Roy' and last_name = 'Alexander' and position = 'WR'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2022, 'ALBANY', 'receiving', 'manual_screenshot', 'receiving_summary',
  '{
    "targets": 67,
    "receptions": 47,
    "reception_pct": 70.1,
    "yards": 610,
    "yards_per_reception": 13.0,
    "touchdowns": 2,
    "offense_grade": 66.3,
    "receiving_grade": 67.1,
    "drop_grade": 87.1,
    "fumble_grade": 77.7,
    "pass_block_grade": 65.7,
    "pass_snaps": 414,
    "receiving_snaps": 386,
    "route_pct": 93.2,
    "pass_block_pct": 0.5,
    "slot_snaps": 400,
    "slot_pct": 96.6,
    "wide_snaps": 6,
    "wide_pct": 1.4,
    "inline_snaps": 1,
    "inline_pct": 0.2,
    "yac": 255,
    "yac_per_reception": 5.4,
    "yards_per_route_run": 1.58
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Roy' and last_name = 'Alexander' and position = 'WR'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2021, 'ALBANY', 'receiving', 'manual_screenshot', 'receiving_summary',
  '{
    "targets": 49,
    "receptions": 34,
    "reception_pct": 69.4,
    "yards": 512,
    "yards_per_reception": 15.1,
    "touchdowns": 3,
    "offense_grade": 63.8,
    "receiving_grade": 63.5,
    "drop_grade": 41.4,
    "fumble_grade": 55.3,
    "pass_snaps": 238,
    "receiving_snaps": 223,
    "route_pct": 93.7,
    "slot_snaps": 219,
    "slot_pct": 92.0,
    "wide_snaps": 17,
    "wide_pct": 7.1,
    "inline_snaps": 1,
    "inline_pct": 0.4,
    "yac": 263,
    "yac_per_reception": 7.7,
    "yards_per_route_run": 2.30
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Roy' and last_name = 'Alexander' and position = 'WR'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2025, 'TEXAS TECH', 'receiving_depth', 'manual_screenshot', 'receiving_depth_summary',
  '{
    "overall": {
      "deep_20_plus": { "targets": 0, "receptions": 0, "yards": 0 },
      "medium_10_19": { "targets": 1, "receptions": 1, "reception_pct": 100.0, "yards": 15, "yards_per_reception": 15.0, "receiving_grade": 74.5, "drop_grade": 66.7, "yac": 1, "yac_per_reception": 1.0, "yards_per_route_run": 15.0, "adot": 14.0, "first_downs": 1, "rating": 118.8 },
      "short_0_9": { "targets": 2, "receptions": 1, "reception_pct": 50.0, "yards": 13, "yards_per_reception": 13.0, "receiving_grade": 73.3, "drop_grade": 66.7, "yac": 9, "yac_per_reception": 9.0, "yards_per_route_run": 6.5, "adot": 4.0, "missed_tackles_forced": 1, "first_downs": 1, "rating": 70.8 },
      "behind_los": { "targets": 1, "receptions": 1, "reception_pct": 100.0, "yards": 3, "yards_per_reception": 3.0, "receiving_grade": 61.0, "drop_grade": 66.7, "yac": 6, "yac_per_reception": 6.0, "yards_per_route_run": 3.0, "adot": -3.0, "missed_tackles_forced": 1, "first_downs": 0, "rating": 79.2 }
    },
    "directional": {
      "intermediate_center": { "targets": 1, "receptions": 1, "reception_pct": 100.0, "yards": 15, "receiving_grade": 74.5, "drop_grade": 66.7, "yac": 1, "yac_per_reception": 1.0, "yards_per_route_run": 7.5, "adot": 14.0, "first_downs": 1, "rating": 118.8 },
      "short_center": { "targets": 2, "receptions": 1, "reception_pct": 50.0, "yards": 13, "receiving_grade": 73.3, "drop_grade": 66.7, "yac": 9, "yac_per_reception": 9.0, "yards_per_route_run": 3.25, "adot": 4.0, "missed_tackles_forced": 1, "first_downs": 1, "rating": 70.8 },
      "behind_los_center": { "targets": 1, "receptions": 1, "reception_pct": 100.0, "yards": 3, "receiving_grade": 61.0, "drop_grade": 66.7, "yac": 6, "yac_per_reception": 6.0, "yards_per_route_run": 1.5, "adot": -3.0, "missed_tackles_forced": 1, "rating": 79.2 }
    }
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Roy' and last_name = 'Alexander' and position = 'WR'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2025, 'TEXAS TECH', 'run_blocking', 'manual_screenshot', 'run_blocking_summary',
  '{
    "run_snaps": 10,
    "run_block_snaps": 10,
    "run_block_pct": 100.0,
    "run_block_grade": 40.6,
    "penalties": "0 (0)",
    "zone_run_block_snaps": 9,
    "zone_snap_pct": 90.0,
    "gap_run_block_snaps": 1,
    "gap_snap_pct": 10.0
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Roy' and last_name = 'Alexander' and position = 'WR'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2024, 'INCAR WORD', 'run_blocking', 'manual_screenshot', 'run_blocking_summary',
  '{
    "run_snaps": 357,
    "run_block_snaps": 349,
    "run_block_pct": 97.8,
    "run_block_grade": 59.4,
    "penalties": "1 (0)",
    "zone_run_block_snaps": 88,
    "zone_snap_pct": 25.2,
    "gap_run_block_snaps": 234,
    "gap_snap_pct": 67.0
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Roy' and last_name = 'Alexander' and position = 'WR'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2023, 'ALBANY', 'run_blocking', 'manual_screenshot', 'run_blocking_summary',
  '{
    "run_snaps": 61,
    "run_block_snaps": 60,
    "run_block_pct": 98.4,
    "run_block_grade": 50.9,
    "penalties": "0 (0)",
    "zone_run_block_snaps": 37,
    "zone_snap_pct": 61.7,
    "gap_run_block_snaps": 22,
    "gap_snap_pct": 36.7
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Roy' and last_name = 'Alexander' and position = 'WR'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2022, 'ALBANY', 'run_blocking', 'manual_screenshot', 'run_blocking_summary',
  '{
    "run_snaps": 127,
    "run_block_snaps": 118,
    "run_block_pct": 92.9,
    "run_block_grade": 58.8,
    "penalties": "3 (0)",
    "zone_run_block_snaps": 48,
    "zone_snap_pct": 40.7,
    "gap_run_block_snaps": 66,
    "gap_snap_pct": 55.9
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Roy' and last_name = 'Alexander' and position = 'WR'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2021, 'ALBANY', 'run_blocking', 'manual_screenshot', 'run_blocking_summary',
  '{
    "run_snaps": 119,
    "run_block_snaps": 113,
    "run_block_pct": 95.0,
    "run_block_grade": 50.5,
    "penalties": "0 (0)",
    "zone_run_block_snaps": 48,
    "zone_snap_pct": 42.5,
    "gap_run_block_snaps": 62,
    "gap_snap_pct": 54.9
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Roy' and last_name = 'Alexander' and position = 'WR'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2025, 'TEXAS TECH', 'snaps_by_position', 'manual_screenshot', 'snaps_by_position_summary',
  '{
    "inline_total": 1,
    "slot_total": 23,
    "wide_total": 3,
    "kick_coverage_total": 1,
    "kick_return_total": 4,
    "punt_return_total": 5,
    "grand_total": 37
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

-- Sam Feeney
with target as (
  select id
  from public.players
  where first_name = 'Sam' and last_name = 'Feeney' and position = 'EDGE'
  order by created_at desc
  limit 1
)
insert into public.player_pff_profiles (
  player_id, pff_player_name, current_team, jersey_number, height_in, weight_lbs, draft_eligibility_year, source, raw_payload
)
select
  id, 'Sam Feeney', 'Ball State Cardinals', 'ED #48', 74, 197, 2028, 'manual_screenshot',
  '{"source_note":"Sam Feeney Ball State defense and snaps-by-position screenshots"}'::jsonb
from target
on conflict (player_id) do update
set
  pff_player_name = excluded.pff_player_name,
  current_team = excluded.current_team,
  jersey_number = excluded.jersey_number,
  height_in = excluded.height_in,
  weight_lbs = excluded.weight_lbs,
  draft_eligibility_year = excluded.draft_eligibility_year,
  source = excluded.source,
  raw_payload = excluded.raw_payload;

with target as (
  select id
  from public.players
  where first_name = 'Sam' and last_name = 'Feeney' and position = 'EDGE'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2025, 'BALL ST', 'defense', 'manual_screenshot', 'defense_summary',
  '{
    "total_snaps": 95,
    "run_defense_snaps": 33,
    "pass_rush_snaps": 41,
    "coverage_snaps": 21,
    "defense_grade": 54.9,
    "run_defense_grade": 45.4,
    "tackling_grade": 24.9,
    "pass_rush_grade": 60.4,
    "coverage_grade": 62.9,
    "pressure_total": 6,
    "sacks": 0,
    "hits": 2,
    "hurries": 4,
    "batted_passes": 0,
    "tackles": 2,
    "assists": 1,
    "missed_tackles": 3,
    "missed_tackle_rate": 50.0,
    "stops": 1,
    "forced_fumbles": 0,
    "targets": 0,
    "receptions_allowed": 0,
    "yards_allowed": 0
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Sam' and last_name = 'Feeney' and position = 'EDGE'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2024, 'BALL ST', 'defense', 'manual_screenshot', 'defense_summary',
  '{
    "total_snaps": 69,
    "run_defense_snaps": 29,
    "pass_rush_snaps": 36,
    "coverage_snaps": 4,
    "defense_grade": 67.4,
    "run_defense_grade": 46.7,
    "tackling_grade": 28.9,
    "pass_rush_grade": 83.1,
    "coverage_grade": 47.7,
    "pressure_total": 5,
    "sacks": 3,
    "hits": 0,
    "hurries": 2,
    "batted_passes": 0,
    "tackles": 0,
    "assists": 0,
    "missed_tackles": 2,
    "missed_tackle_rate": 100.0,
    "stops": 3,
    "forced_fumbles": 1,
    "targets": 0,
    "receptions_allowed": 0,
    "yards_allowed": 0
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Sam' and last_name = 'Feeney' and position = 'EDGE'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2025, 'BALL ST', 'snaps_by_position', 'manual_screenshot', 'snaps_by_position_summary',
  '{
    "dline_total": 74,
    "lolb_total": 44,
    "rolb_total": 30,
    "box_total": 21,
    "lilb_total": 6,
    "llb_total": 2,
    "mlb_total": 5,
    "rilb_total": 8,
    "kick_coverage_total": 18,
    "l4_total": 8,
    "l5_total": 7
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

-- Jalen Dye
with target as (
  select id
  from public.players
  where first_name = 'Jalen' and last_name = 'Dye' and position = 'S'
  order by created_at desc
  limit 1
)
insert into public.player_pff_profiles (
  player_id, pff_player_name, current_team, jersey_number, height_in, weight_lbs, draft_eligibility_year, source, raw_payload
)
select
  id, 'Jalen Dye', 'Kansas Jayhawks', 'S #14', 72, 195, 2026, 'manual_screenshot',
  '{"source_note":"Jalen Dye Kansas defense and alignment screenshots"}'::jsonb
from target
on conflict (player_id) do update
set
  pff_player_name = excluded.pff_player_name,
  current_team = excluded.current_team,
  jersey_number = excluded.jersey_number,
  height_in = excluded.height_in,
  weight_lbs = excluded.weight_lbs,
  draft_eligibility_year = excluded.draft_eligibility_year,
  source = excluded.source,
  raw_payload = excluded.raw_payload;

with target as (
  select id
  from public.players
  where first_name = 'Jalen' and last_name = 'Dye' and position = 'S'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2025, 'KANSAS', 'defense', 'manual_screenshot', 'defense_summary',
  '{
    "total_snaps": 99,
    "run_defense_snaps": 54,
    "pass_rush_snaps": 3,
    "coverage_snaps": 42,
    "defense_grade": 76.9,
    "run_defense_grade": 87.3,
    "tackling_grade": 70.8,
    "pass_rush_grade": 82.0,
    "coverage_grade": 63.8,
    "pressure_total": 1,
    "sacks": 1,
    "hits": 0,
    "hurries": 0,
    "batted_passes": 0,
    "tackles": 7,
    "assists": 1,
    "missed_tackles": 1,
    "missed_tackle_rate": 11.1,
    "stops": 3,
    "forced_fumbles": 2,
    "targets": 3,
    "receptions_allowed": 1,
    "reception_pct_allowed": 33.3,
    "yards_allowed": 22,
    "yards_per_reception_allowed": 22.0,
    "yac_allowed": 3,
    "longest_reception_allowed": 22,
    "touchdowns_allowed": 0
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Jalen' and last_name = 'Dye' and position = 'S'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2024, 'KANSAS', 'defense', 'manual_screenshot', 'defense_summary',
  '{
    "total_snaps": 131,
    "run_defense_snaps": 57,
    "pass_rush_snaps": 6,
    "coverage_snaps": 68,
    "defense_grade": 55.4,
    "run_defense_grade": 63.0,
    "tackling_grade": 73.1,
    "pass_rush_grade": 53.7,
    "coverage_grade": 53.5,
    "pressure_total": 1,
    "sacks": 0,
    "hits": 0,
    "hurries": 1,
    "batted_passes": 0,
    "tackles": 14,
    "assists": 1,
    "missed_tackles": 2,
    "missed_tackle_rate": 11.8,
    "stops": 4,
    "forced_fumbles": 0,
    "targets": 7,
    "receptions_allowed": 6,
    "reception_pct_allowed": 85.7,
    "yards_allowed": 69,
    "yards_per_reception_allowed": 11.5,
    "yac_allowed": 17,
    "longest_reception_allowed": 28,
    "touchdowns_allowed": 0
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Jalen' and last_name = 'Dye' and position = 'S'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2023, 'KANSAS', 'defense', 'manual_screenshot', 'defense_summary',
  '{
    "total_snaps": 21,
    "run_defense_snaps": 11,
    "pass_rush_snaps": 1,
    "coverage_snaps": 9,
    "defense_grade": 63.2,
    "run_defense_grade": 44.0,
    "tackling_grade": 23.6,
    "pass_rush_grade": 47.6,
    "coverage_grade": 85.9,
    "pressure_total": 1,
    "sacks": 0,
    "hits": 0,
    "hurries": 1,
    "batted_passes": 0,
    "tackles": 0,
    "assists": 1,
    "missed_tackles": 3,
    "missed_tackle_rate": 75.0,
    "stops": 0,
    "forced_fumbles": 0,
    "targets": 2,
    "receptions_allowed": 0,
    "reception_pct_allowed": 0.0,
    "yards_allowed": 0,
    "touchdowns_allowed": 0
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Jalen' and last_name = 'Dye' and position = 'S'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2022, 'KANSAS', 'defense', 'manual_screenshot', 'defense_summary',
  '{
    "total_snaps": 12,
    "run_defense_snaps": 11,
    "pass_rush_snaps": 0,
    "coverage_snaps": 1,
    "defense_grade": 62.2,
    "run_defense_grade": 61.1,
    "coverage_grade": 60.0
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Jalen' and last_name = 'Dye' and position = 'S'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2025, 'KANSAS', 'alignment', 'manual_screenshot', 'alignment_summary',
  '{
    "targets": 3,
    "receptions_allowed": 1,
    "reception_pct_allowed": 33.3,
    "yards_allowed": 22,
    "yards_per_reception_allowed": 22.0,
    "yac_allowed": 3,
    "longest_reception_allowed": 22,
    "touchdowns_allowed": 0,
    "interceptions": 0,
    "pass_breakups": 0,
    "nfl_passer_rating_allowed": 60.4,
    "penalties": "0 (0)",
    "dl_snaps": 0,
    "box_snaps": 33,
    "fs_snaps": 44,
    "slot_snaps": 22,
    "corner_snaps": 0,
    "agp_snaps": 0,
    "bgp_snaps": 0,
    "ovt_snaps": 0,
    "out_snaps": 0
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

-- Khari Gee
with target as (
  select id
  from public.players
  where first_name = 'Khari' and last_name = 'Gee' and position = 'S'
  order by created_at desc
  limit 1
)
insert into public.player_pff_profiles (
  player_id, pff_player_name, current_team, jersey_number, height_in, weight_lbs, draft_eligibility_year, source, raw_payload
)
select
  id, 'Khari Gee', 'Chattanooga Mocs', 'S #0', 74, 199, 2027, 'manual_screenshot',
  '{"source_note":"Khari Gee Chattanooga defense and alignment screenshots"}'::jsonb
from target
on conflict (player_id) do update
set
  pff_player_name = excluded.pff_player_name,
  current_team = excluded.current_team,
  jersey_number = excluded.jersey_number,
  height_in = excluded.height_in,
  weight_lbs = excluded.weight_lbs,
  draft_eligibility_year = excluded.draft_eligibility_year,
  source = excluded.source,
  raw_payload = excluded.raw_payload;

with target as (
  select id
  from public.players
  where first_name = 'Khari' and last_name = 'Gee' and position = 'S'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2025, 'CHATTNOOGA', 'defense', 'manual_screenshot', 'defense_summary',
  '{
    "total_snaps": 392,
    "run_defense_snaps": 185,
    "pass_rush_snaps": 4,
    "coverage_snaps": 203,
    "defense_grade": 57.9,
    "run_defense_grade": 52.0,
    "tackling_grade": 36.4,
    "pass_rush_grade": 56.5,
    "coverage_grade": 60.9,
    "pressure_total": 1,
    "sacks": 0,
    "hits": 0,
    "hurries": 1,
    "batted_passes": 0,
    "tackles": 30,
    "assists": 11,
    "missed_tackles": 13,
    "missed_tackle_rate": 24.1,
    "stops": 10,
    "forced_fumbles": 0,
    "targets": 17,
    "receptions_allowed": 15,
    "reception_pct_allowed": 88.2,
    "yards_allowed": 180,
    "yards_per_reception_allowed": 12.0,
    "yac_allowed": 58,
    "longest_reception_allowed": 25
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Khari' and last_name = 'Gee' and position = 'S'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2023, 'GA TECH', 'defense', 'manual_screenshot', 'defense_summary',
  '{
    "total_snaps": 5,
    "run_defense_snaps": 5,
    "pass_rush_snaps": 0,
    "coverage_snaps": 0,
    "defense_grade": 64.6,
    "run_defense_grade": 63.1,
    "tackling_grade": 73.1,
    "pressure_total": 0,
    "tackles": 0,
    "assists": 1
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Khari' and last_name = 'Gee' and position = 'S'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2022, 'GA TECH', 'defense', 'manual_screenshot', 'defense_summary',
  '{
    "total_snaps": 56,
    "run_defense_snaps": 27,
    "pass_rush_snaps": 2,
    "coverage_snaps": 27,
    "defense_grade": 61.3,
    "run_defense_grade": 48.8,
    "tackling_grade": 27.5,
    "pass_rush_grade": 71.0,
    "coverage_grade": 66.9,
    "pressure_total": 1,
    "sacks": 1,
    "hits": 0,
    "hurries": 0,
    "batted_passes": 0,
    "tackles": 4,
    "assists": 2,
    "missed_tackles": 4,
    "missed_tackle_rate": 40.0,
    "stops": 3,
    "forced_fumbles": 0,
    "targets": 2,
    "receptions_allowed": 1,
    "reception_pct_allowed": 50.0,
    "yards_allowed": 11,
    "yards_per_reception_allowed": 11.0,
    "yac_allowed": 10,
    "longest_reception_allowed": 11
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Khari' and last_name = 'Gee' and position = 'S'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2025, 'CHATTNOOGA', 'alignment', 'manual_screenshot', 'alignment_summary',
  '{
    "targets": 17,
    "receptions_allowed": 15,
    "reception_pct_allowed": 88.2,
    "yards_allowed": 180,
    "yards_per_reception_allowed": 12.0,
    "yac_allowed": 58,
    "longest_reception_allowed": 25,
    "touchdowns_allowed": 0,
    "interceptions": 1,
    "pass_breakups": 0,
    "nfl_passer_rating_allowed": 86.3,
    "penalties": "0 (0)",
    "dl_snaps": 2,
    "box_snaps": 236,
    "fs_snaps": 81,
    "slot_snaps": 72,
    "corner_snaps": 1,
    "agp_snaps": 0,
    "bgp_snaps": 0,
    "ovt_snaps": 0,
    "out_snaps": 2
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

-- Jameel Croft Jr.
with target as (
  select id
  from public.players
  where first_name = 'Jameel' and last_name = 'Croft Jr.' and position = 'CB'
  order by created_at desc
  limit 1
)
insert into public.player_pff_profiles (
  player_id, pff_player_name, current_team, jersey_number, height_in, weight_lbs, draft_eligibility_year, source, raw_payload
)
select
  id, 'Jameel Croft Jr.', 'Charlotte 49ers', 'CB #29', 72, 195, 2028, 'manual_screenshot',
  '{"source_note":"Jameel Croft Jr. current-team page with Kansas report data"}'::jsonb
from target
on conflict (player_id) do update
set
  pff_player_name = excluded.pff_player_name,
  current_team = excluded.current_team,
  jersey_number = excluded.jersey_number,
  height_in = excluded.height_in,
  weight_lbs = excluded.weight_lbs,
  draft_eligibility_year = excluded.draft_eligibility_year,
  source = excluded.source,
  raw_payload = excluded.raw_payload;

with target as (
  select id
  from public.players
  where first_name = 'Jameel' and last_name = 'Croft Jr.' and position = 'CB'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2025, 'KANSAS', 'defense', 'manual_screenshot', 'defense_summary',
  '{
    "total_snaps": 2,
    "run_defense_snaps": 2,
    "pass_rush_snaps": 0,
    "coverage_snaps": 0,
    "defense_grade": 62.9,
    "run_defense_grade": 62.8,
    "tackling_grade": 74.8,
    "pressure_total": 0,
    "tackles": 1,
    "assists": 0,
    "missed_tackles": 0,
    "missed_tackle_rate": 0.0,
    "stops": 0,
    "forced_fumbles": 0,
    "targets": 0,
    "receptions_allowed": 0
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Jameel' and last_name = 'Croft Jr.' and position = 'CB'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2024, 'KANSAS', 'defense', 'manual_screenshot', 'defense_summary',
  '{
    "total_snaps": 2,
    "run_defense_snaps": 0,
    "pass_rush_snaps": 0,
    "coverage_snaps": 2,
    "defense_grade": 63.6,
    "coverage_grade": 62.3,
    "pressure_total": 0
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

-- Kade Kostus
with target as (
  select id
  from public.players
  where first_name = 'Kade' and last_name = 'Kostus' and position = 'DL'
  order by created_at desc
  limit 1
)
insert into public.player_pff_profiles (
  player_id, pff_player_name, current_team, jersey_number, height_in, weight_lbs, draft_eligibility_year, source, raw_payload
)
select
  id, 'Kade Kostus', 'Central Michigan Chippewas', 'DI #44', 74, 260, 2027, 'manual_screenshot',
  '{"source_note":"Kade Kostus Central Michigan defense and alignment screenshots"}'::jsonb
from target
on conflict (player_id) do update
set
  pff_player_name = excluded.pff_player_name,
  current_team = excluded.current_team,
  jersey_number = excluded.jersey_number,
  height_in = excluded.height_in,
  weight_lbs = excluded.weight_lbs,
  draft_eligibility_year = excluded.draft_eligibility_year,
  source = excluded.source,
  raw_payload = excluded.raw_payload;

with target as (
  select id
  from public.players
  where first_name = 'Kade' and last_name = 'Kostus' and position = 'DL'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2025, 'C MICHIGAN', 'defense', 'manual_screenshot', 'defense_summary',
  '{
    "total_snaps": 103,
    "run_defense_snaps": 47,
    "pass_rush_snaps": 56,
    "coverage_snaps": 0,
    "defense_grade": 46.1,
    "run_defense_grade": 42.2,
    "tackling_grade": 73.8,
    "pass_rush_grade": 59.5,
    "coverage_grade": 60.0,
    "pressure_total": 2,
    "sacks": 1,
    "hits": 0,
    "hurries": 1,
    "batted_passes": 0,
    "tackles": 1,
    "assists": 1,
    "missed_tackles": 0,
    "missed_tackle_rate": 0.0,
    "stops": 2,
    "forced_fumbles": 0,
    "targets": 0,
    "receptions_allowed": 0,
    "penalties": "1 (0)"
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Kade' and last_name = 'Kostus' and position = 'DL'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2024, 'C MICHIGAN', 'defense', 'manual_screenshot', 'defense_summary',
  '{
    "total_snaps": 471,
    "run_defense_snaps": 234,
    "pass_rush_snaps": 234,
    "coverage_snaps": 3,
    "defense_grade": 54.0,
    "run_defense_grade": 60.6,
    "tackling_grade": 83.0,
    "pass_rush_grade": 48.7,
    "coverage_grade": 57.8,
    "pressure_total": 7,
    "sacks": 1,
    "hits": 0,
    "hurries": 6,
    "batted_passes": 0,
    "tackles": 13,
    "assists": 4,
    "missed_tackles": 0,
    "missed_tackle_rate": 0.0,
    "stops": 14
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Kade' and last_name = 'Kostus' and position = 'DL'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2023, 'C MICHIGAN', 'defense', 'manual_screenshot', 'defense_summary',
  '{
    "total_snaps": 75,
    "run_defense_snaps": 40,
    "pass_rush_snaps": 35,
    "coverage_snaps": 0,
    "defense_grade": 51.3,
    "run_defense_grade": 58.9,
    "tackling_grade": 76.2,
    "pass_rush_grade": 51.3,
    "pressure_total": 1,
    "sacks": 0,
    "hits": 1,
    "hurries": 0,
    "tackles": 3,
    "assists": 1,
    "missed_tackles": 0,
    "missed_tackle_rate": 0.0,
    "stops": 2
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Kade' and last_name = 'Kostus' and position = 'DL'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2025, 'C MICHIGAN', 'alignment', 'manual_screenshot', 'alignment_summary',
  '{
    "penalties": "1 (0)",
    "dl_snaps": 102,
    "box_snaps": 1,
    "fs_snaps": 0,
    "slot_snaps": 0,
    "corner_snaps": 0,
    "agp_snaps": 0,
    "bgp_snaps": 90,
    "ovt_snaps": 12,
    "out_snaps": 0
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

-- Grant Fielder
with target as (
  select id
  from public.players
  where first_name = 'Grant' and last_name = 'Fielder' and position = 'EDGE'
  order by created_at desc
  limit 1
)
insert into public.player_pff_profiles (
  player_id, pff_player_name, current_team, jersey_number, height_in, weight_lbs, draft_eligibility_year, source, raw_payload
)
select
  id, 'Grant Fielder', 'Florida State Seminoles', 'ED #98', 74, 245, 2028, 'manual_screenshot',
  '{"source_note":"Grant Fielder Florida State defense and alignment screenshots"}'::jsonb
from target
on conflict (player_id) do update
set
  pff_player_name = excluded.pff_player_name,
  current_team = excluded.current_team,
  jersey_number = excluded.jersey_number,
  height_in = excluded.height_in,
  weight_lbs = excluded.weight_lbs,
  draft_eligibility_year = excluded.draft_eligibility_year,
  source = excluded.source,
  raw_payload = excluded.raw_payload;

with target as (
  select id
  from public.players
  where first_name = 'Grant' and last_name = 'Fielder' and position = 'EDGE'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2025, 'FLORIDA ST', 'defense', 'manual_screenshot', 'defense_summary',
  '{
    "total_snaps": 28,
    "run_defense_snaps": 12,
    "pass_rush_snaps": 15,
    "coverage_snaps": 1,
    "defense_grade": 65.3,
    "run_defense_grade": 68.3,
    "tackling_grade": 72.2,
    "pass_rush_grade": 58.0,
    "coverage_grade": 60.0,
    "pressure_total": 0,
    "sacks": 0,
    "hits": 0,
    "hurries": 0,
    "batted_passes": 0,
    "tackles": 1,
    "assists": 0,
    "missed_tackles": 0,
    "missed_tackle_rate": 0.0,
    "stops": 1,
    "forced_fumbles": 0
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Grant' and last_name = 'Fielder' and position = 'EDGE'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2024, 'FLORIDA ST', 'defense', 'manual_screenshot', 'defense_summary',
  '{
    "total_snaps": 3,
    "run_defense_snaps": 2,
    "pass_rush_snaps": 1,
    "coverage_snaps": 0,
    "defense_grade": 41.4,
    "run_defense_grade": 50.5,
    "tackling_grade": 71.5,
    "pass_rush_grade": 59.7,
    "pressure_total": 0,
    "tackles": 0,
    "assists": 1
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Grant' and last_name = 'Fielder' and position = 'EDGE'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2023, 'FLORIDA ST', 'defense', 'manual_screenshot', 'defense_summary',
  '{
    "total_snaps": 7,
    "run_defense_snaps": 5,
    "pass_rush_snaps": 2,
    "coverage_snaps": 0,
    "defense_grade": 47.3,
    "run_defense_grade": 50.1,
    "tackling_grade": 72.2,
    "pass_rush_grade": 58.5,
    "pressure_total": 0,
    "tackles": 1,
    "assists": 0
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Grant' and last_name = 'Fielder' and position = 'EDGE'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2025, 'FLORIDA ST', 'alignment', 'manual_screenshot', 'alignment_summary',
  '{
    "penalties": "0 (0)",
    "dl_snaps": 28,
    "box_snaps": 0,
    "fs_snaps": 0,
    "slot_snaps": 0,
    "corner_snaps": 0,
    "agp_snaps": 0,
    "bgp_snaps": 1,
    "ovt_snaps": 3,
    "out_snaps": 24
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Mike' and last_name = 'Jones' and position = 'DL'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2024, 'VAUO', 'defense', 'manual_screenshot', 'defense_summary',
  '{
    "total_snaps": 68,
    "run_defense_snaps": 40,
    "pass_rush_snaps": 28,
    "coverage_snaps": 0,
    "defense_grade": 70.3,
    "run_defense_grade": 70.8,
    "tackling_grade": 79.6,
    "pass_rush_grade": 63.2,
    "pressure_total": 2,
    "sacks": 1,
    "hits": 1,
    "hurries": 0,
    "batted_passes": 1,
    "tackles": 7,
    "assists": 1,
    "missed_tackles": 0,
    "missed_tackle_rate": 0.0,
    "stops": 5,
    "forced_fumbles": 0,
    "targets": 0,
    "receptions_allowed": 0
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

-- Daniel Kaelin
with target as (
  select id
  from public.players
  where first_name = 'Daniel' and last_name = 'Kaelin' and position = 'QB'
  order by created_at desc
  limit 1
)
insert into public.player_pff_profiles (
  player_id, pff_player_name, current_team, jersey_number, height_in, weight_lbs, draft_eligibility_year, source, raw_payload
)
select
  id, 'Daniel Kaelin', 'Nebraska Cornhuskers', 'QB #10', 75, 218, 2028, 'manual_screenshot',
  '{"source_note":"Daniel Kaelin Nebraska / Virginia passing-rushing-pressure screenshots"}'::jsonb
from target
on conflict (player_id) do update
set
  pff_player_name = excluded.pff_player_name,
  current_team = excluded.current_team,
  jersey_number = excluded.jersey_number,
  height_in = excluded.height_in,
  weight_lbs = excluded.weight_lbs,
  draft_eligibility_year = excluded.draft_eligibility_year,
  source = excluded.source,
  raw_payload = excluded.raw_payload;

with target as (
  select id
  from public.players
  where first_name = 'Daniel' and last_name = 'Kaelin' and position = 'QB'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2025, 'VIRGINIA', 'passing', 'manual_screenshot', 'passing_summary',
  '{
    "dropbacks": 56,
    "attempts": 52,
    "completions": 30,
    "completion_pct": 57.7,
    "yards": 339,
    "yards_per_attempt": 6.5,
    "touchdowns": 1,
    "interceptions": 1,
    "offense_grade": 58.0,
    "passing_grade": 54.0,
    "rushing_grade": 64.4,
    "fumble_grade": 48.1,
    "big_time_throws": 0,
    "big_time_throw_rate": 0.0,
    "turnover_worthy_plays": 2,
    "turnover_worthy_play_rate": 3.6,
    "adot": 7.4,
    "adjusted_completion_pct": 69.4,
    "drops": 4,
    "drop_rate": 11.8,
    "batted_passes": 0,
    "hits_at_throw": 1,
    "throwaways": 2,
    "dropbacks_pressured": 17,
    "sacks": 2,
    "pressure_to_sack_pct": 11.8,
    "time_to_throw": 2.73
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Daniel' and last_name = 'Kaelin' and position = 'QB'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2025, 'VIRGINIA', 'rushing', 'manual_screenshot', 'rushing_summary',
  '{
    "snaps": 73,
    "attempts": 14,
    "yards": 77,
    "yards_per_attempt": 5.5,
    "touchdowns": 0,
    "fumbles": 3,
    "offense_grade": 58.0,
    "rushing_grade": 64.4,
    "fumble_grade": 48.1,
    "run_block_grade": 60.1,
    "yards_after_contact": 9,
    "yards_after_contact_per_attempt": 0.64,
    "missed_tackles_forced": 0,
    "longest_run": 54,
    "runs_10_plus": 2,
    "zone_runs": 6,
    "gap_runs": 0,
    "scrambles": 2,
    "short_yards": 1,
    "designed_yards": 76,
    "runs_15_plus": 1,
    "breakaway_yards": 54,
    "breakaway_yard_pct": 70.1,
    "first_downs": 4,
    "penalties": "0 (0)"
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Daniel' and last_name = 'Kaelin' and position = 'QB'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2025, 'VIRGINIA', 'passing_pressure', 'manual_screenshot', 'passing_pressure_split',
  '{
    "all_plays": {
      "dropbacks": 56,
      "attempts": 52,
      "completions": 30,
      "completion_pct": 57.7,
      "yards": 339,
      "yards_per_attempt": 6.5,
      "touchdowns": 1,
      "interceptions": 1,
      "offense_grade": 58.0,
      "passing_grade": 54.0,
      "rushing_grade": 64.4,
      "fumble_grade": 48.1,
      "turnover_worthy_plays": 2,
      "turnover_worthy_play_rate": 3.6,
      "adot": 7.4,
      "adjusted_completion_pct": 69.4,
      "drops": 4,
      "drop_rate": 11.8,
      "throws_away": 2,
      "pressured_dropbacks": 17,
      "sacks": 2,
      "pressure_to_sack_pct": 11.8,
      "time_to_throw": 2.73
    },
    "kept_clean": {
      "dropback_pct": 69.6,
      "dropbacks": 39,
      "attempts": 39,
      "completions": 26,
      "completion_pct": 66.7,
      "yards": 300,
      "yards_per_attempt": 7.7,
      "touchdowns": 1,
      "interceptions": 1,
      "offense_grade": 70.7,
      "passing_grade": 70.1,
      "fumble_grade": 68.9,
      "adot": 6.7,
      "adjusted_completion_pct": 78.4,
      "drops": 3,
      "drop_rate": 10.3,
      "throwaways": 2
    },
    "under_pressure": {
      "dropback_pct": 30.4,
      "dropbacks": 17,
      "attempts": 13,
      "completions": 4,
      "completion_pct": 30.8,
      "yards": 39,
      "yards_per_attempt": 3.0,
      "touchdowns": 0,
      "interceptions": 0,
      "offense_grade": 28.0,
      "passing_grade": 28.5,
      "rushing_grade": 52.4,
      "fumble_grade": 21.8,
      "turnover_worthy_plays": 2,
      "turnover_worthy_play_rate": 11.8,
      "adot": 9.8,
      "adjusted_completion_pct": 41.7,
      "drops": 1,
      "drop_rate": 20.0,
      "hits_at_throw": 1,
      "dropbacks_pressured": 17,
      "sacks": 2,
      "pressure_to_sack_pct": 11.8,
      "time_to_throw": 3.65
    },
    "not_blitzed": {
      "dropback_pct": 78.6,
      "dropbacks": 44,
      "attempts": 40,
      "completions": 24,
      "completion_pct": 60.0,
      "yards": 274,
      "yards_per_attempt": 6.9,
      "touchdowns": 0,
      "interceptions": 0,
      "offense_grade": 45.6,
      "passing_grade": 47.6,
      "rushing_grade": 52.4,
      "fumble_grade": 33.1,
      "turnover_worthy_plays": 2,
      "turnover_worthy_play_rate": 4.5,
      "adot": 7.5,
      "adjusted_completion_pct": 71.1,
      "drops": 3,
      "drop_rate": 11.1,
      "hits_at_throw": 1,
      "throwaways": 1,
      "dropbacks_pressured": 15,
      "sacks": 2,
      "pressure_to_sack_pct": 13.3,
      "time_to_throw": 2.85
    },
    "when_blitzed": {
      "dropback_pct": 21.4,
      "dropbacks": 12,
      "attempts": 12,
      "completions": 6,
      "completion_pct": 50.0,
      "yards": 65,
      "yards_per_attempt": 5.4,
      "touchdowns": 1,
      "interceptions": 1,
      "offense_grade": 71.6,
      "passing_grade": 71.1,
      "fumble_grade": 65.8,
      "adot": 7.1,
      "adjusted_completion_pct": 63.6,
      "drops": 1,
      "drop_rate": 14.3,
      "throwaways": 1,
      "dropbacks_pressured": 2,
      "sacks": 0,
      "pressure_to_sack_pct": 0.0,
      "time_to_throw": 2.28
    }
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

-- Kaden Eggett
with target as (
  select id
  from public.players
  where first_name = 'Kaden' and last_name = 'Eggett' and position = 'TE'
  order by created_at desc
  limit 1
)
insert into public.player_pff_profiles (
  player_id, pff_player_name, current_team, jersey_number, height_in, weight_lbs, draft_eligibility_year, source, raw_payload
)
select
  id, 'Kaden Eggett', 'Utah Tech Trailblazers', 'TE #86', 75, 240, 2028, 'manual_screenshot',
  '{"source_note":"Kaden Eggett Utah Tech receiving and blocking screenshots"}'::jsonb
from target
on conflict (player_id) do update
set
  pff_player_name = excluded.pff_player_name,
  current_team = excluded.current_team,
  jersey_number = excluded.jersey_number,
  height_in = excluded.height_in,
  weight_lbs = excluded.weight_lbs,
  draft_eligibility_year = excluded.draft_eligibility_year,
  source = excluded.source,
  raw_payload = excluded.raw_payload;

with target as (
  select id
  from public.players
  where first_name = 'Kaden' and last_name = 'Eggett' and position = 'TE'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2025, 'UTAHTC', 'receiving', 'manual_screenshot', 'receiving_summary',
  '{
    "targets": 29,
    "receptions": 24,
    "reception_pct": 82.8,
    "yards": 266,
    "yards_per_reception": 11.1,
    "touchdowns": 0,
    "offense_grade": 65.5,
    "receiving_grade": 68.9,
    "drop_grade": 67.6,
    "fumble_grade": 28.1,
    "pass_block_grade": 66.3,
    "pass_snaps": 197,
    "receiving_snaps": 134,
    "route_pct": 68.0,
    "pass_block_snaps": 60,
    "pass_block_pct": 30.5,
    "slot_snaps": 27,
    "slot_pct": 13.7,
    "wide_snaps": 14,
    "wide_pct": 7.1,
    "inline_snaps": 149,
    "inline_pct": 75.6,
    "yac": 168
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Kaden' and last_name = 'Eggett' and position = 'TE'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2025, 'UTAHTC', 'pass_blocking', 'manual_screenshot', 'pass_blocking_summary',
  '{
    "offense_snaps": 415,
    "block_snaps": 278,
    "block_pct": 67.0,
    "run_block_snaps": 218,
    "pass_block_snaps": 60,
    "offense_grade": 65.5,
    "run_block_grade": 55.0,
    "pass_block_grade": 66.3,
    "pressure_opportunities": 58,
    "pressure_opportunity_pct": 30.2,
    "sacks_allowed": 0,
    "hits_allowed": 1,
    "hurries_allowed": 2,
    "pressures_allowed": 3,
    "pass_block_efficiency": 97.4,
    "penalties": "1 (0)",
    "inline_te_snaps": 338
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

-- Kyle McKinney
with target as (
  select id
  from public.players
  where first_name = 'Kyle' and last_name = 'McKinney' and position = 'S'
  order by created_at desc
  limit 1
)
insert into public.player_pff_profiles (
  player_id, pff_player_name, current_team, jersey_number, height_in, weight_lbs, draft_eligibility_year, source, raw_payload
)
select
  id, 'Kyle McKinney', 'UAB Blazers', 'S #33', 70, 195, 2028, 'manual_screenshot',
  '{"source_note":"Kyle McKinney UAB defense screenshots"}'::jsonb
from target
on conflict (player_id) do update
set
  pff_player_name = excluded.pff_player_name,
  current_team = excluded.current_team,
  jersey_number = excluded.jersey_number,
  height_in = excluded.height_in,
  weight_lbs = excluded.weight_lbs,
  draft_eligibility_year = excluded.draft_eligibility_year,
  source = excluded.source,
  raw_payload = excluded.raw_payload;

with target as (
  select id
  from public.players
  where first_name = 'Kyle' and last_name = 'McKinney' and position = 'S'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2025, 'UAB', 'defense', 'manual_screenshot', 'defense_summary',
  '{
    "total_snaps": 2,
    "run_defense_snaps": 2,
    "pass_rush_snaps": 0,
    "coverage_snaps": 0,
    "defense_grade": 60.0,
    "run_defense_grade": 60.0,
    "pressure_total": 0,
    "tackles": 0
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Kyle' and last_name = 'McKinney' and position = 'S'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2024, 'UAB', 'defense', 'manual_screenshot', 'defense_summary',
  '{
    "total_snaps": 12,
    "run_defense_snaps": 7,
    "pass_rush_snaps": 0,
    "coverage_snaps": 5,
    "defense_grade": 65.1,
    "run_defense_grade": 64.1,
    "tackling_grade": 75.3,
    "coverage_grade": 62.5,
    "pressure_total": 0,
    "sacks": 0,
    "hits": 0,
    "hurries": 0,
    "batted_passes": 1,
    "tackles": 1,
    "assists": 0,
    "missed_tackles": 0,
    "missed_tackle_rate": 0.0,
    "stops": 0,
    "forced_fumbles": 0,
    "targets": 0,
    "receptions_allowed": 0
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

-- Trace Meadows
with target as (
  select id
  from public.players
  where first_name = 'Trace' and last_name = 'Meadows' and position = 'LB'
  order by created_at desc
  limit 1
)
insert into public.player_pff_profiles (
  player_id, pff_player_name, current_team, jersey_number, height_in, weight_lbs, draft_eligibility_year, source, raw_payload
)
select
  id, 'Trace Meadows', 'McNeese State Cowboys', 'LB #23', 72, 210, 2029, 'manual_screenshot',
  '{"source_note":"Trace Meadows special teams screenshots"}'::jsonb
from target
on conflict (player_id) do update
set
  pff_player_name = excluded.pff_player_name,
  current_team = excluded.current_team,
  jersey_number = excluded.jersey_number,
  height_in = excluded.height_in,
  weight_lbs = excluded.weight_lbs,
  draft_eligibility_year = excluded.draft_eligibility_year,
  source = excluded.source,
  raw_payload = excluded.raw_payload;

with target as (
  select id
  from public.players
  where first_name = 'Trace' and last_name = 'Meadows' and position = 'LB'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2025, 'UTEP', 'special_teams', 'manual_screenshot', 'special_teams_summary',
  '{
    "total_snaps": 9,
    "kick_return_snaps": 9,
    "kick_coverage_snaps": 0,
    "punt_return_snaps": 0,
    "punt_coverage_snaps": 0,
    "field_goal_block_snaps": 0,
    "field_goal_kick_snaps": 0,
    "special_teams_grade": 57.0,
    "kickoff_grade": 59.9,
    "penalties": "0 (0)",
    "tackles": 0,
    "assists": 0,
    "missed_tackles": 0
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Trace' and last_name = 'Meadows' and position = 'LB'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2024, 'UTEP', 'special_teams', 'manual_screenshot', 'special_teams_summary',
  '{
    "total_snaps": 25,
    "kick_return_snaps": 19,
    "kick_coverage_snaps": 0,
    "punt_return_snaps": 6,
    "punt_coverage_snaps": 0,
    "field_goal_block_snaps": 0,
    "field_goal_kick_snaps": 0,
    "special_teams_grade": 61.5,
    "penalties": "0 (0)",
    "tackles": 0,
    "assists": 0,
    "missed_tackles": 0
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

-- Willizhuan Yates
with target as (
  select id
  from public.players
  where first_name = 'Willizhuan' and last_name = 'Yates' and position = 'CB'
  order by created_at desc
  limit 1
)
insert into public.player_pff_profiles (
  player_id, pff_player_name, current_team, jersey_number, height_in, weight_lbs, draft_eligibility_year, source, raw_payload
)
select
  id, 'Willizhuan Yates', 'Ball State Cardinals', 'CB #20', 72, 161, 2028, 'manual_screenshot',
  '{"source_note":"Willizhuan Yates defense screenshot totals"}'::jsonb
from target
on conflict (player_id) do update
set
  pff_player_name = excluded.pff_player_name,
  current_team = excluded.current_team,
  jersey_number = excluded.jersey_number,
  height_in = excluded.height_in,
  weight_lbs = excluded.weight_lbs,
  draft_eligibility_year = excluded.draft_eligibility_year,
  source = excluded.source,
  raw_payload = excluded.raw_payload;

with target as (
  select id
  from public.players
  where first_name = 'Willizhuan' and last_name = 'Yates' and position = 'CB'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2025, 'BALL ST', 'defense', 'manual_screenshot_totals', 'defense_summary',
  '{
    "total_snaps": 360,
    "run_defense_snaps": 161,
    "pass_rush_snaps": 1,
    "coverage_snaps": 198,
    "defense_grade": 71.7,
    "run_defense_grade": 64.2,
    "tackling_grade": 70.6,
    "pass_rush_grade": 59.0,
    "coverage_grade": 73.4,
    "pressure_total": 0,
    "sacks": 0,
    "hits": 0,
    "hurries": 0,
    "batted_passes": 0,
    "tackles": 32,
    "assists": 3,
    "missed_tackles": 4,
    "missed_tackle_rate": 10.3,
    "stops": 6,
    "forced_fumbles": 0,
    "targets": 36,
    "receptions_allowed": 18,
    "reception_pct_allowed": 50.0
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

-- Jaavan Mack
with target as (
  select id
  from public.players
  where first_name = 'Jaavan' and last_name = 'Mack' and position = 'CB'
  order by created_at desc
  limit 1
)
insert into public.player_pff_profiles (
  player_id, pff_player_name, current_team, jersey_number, height_in, weight_lbs, draft_eligibility_year, source, raw_payload
)
select
  id, 'Jaavan Mack', 'Western Kentucky Hilltoppers', 'CB #12', 70, 188, 2026, 'manual_screenshot',
  '{"source_note":"Jaavan Mack defense and snaps-by-position screenshots"}'::jsonb
from target
on conflict (player_id) do update
set
  pff_player_name = excluded.pff_player_name,
  current_team = excluded.current_team,
  jersey_number = excluded.jersey_number,
  height_in = excluded.height_in,
  weight_lbs = excluded.weight_lbs,
  draft_eligibility_year = excluded.draft_eligibility_year,
  source = excluded.source,
  raw_payload = excluded.raw_payload;

with target as (
  select id
  from public.players
  where first_name = 'Jaavan' and last_name = 'Mack' and position = 'CB'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2025, 'W KENTUCKY', 'defense', 'manual_screenshot', 'defense_summary',
  '{
    "total_snaps": 309,
    "run_defense_snaps": 131,
    "pass_rush_snaps": 0,
    "coverage_snaps": 178,
    "defense_grade": 68.4,
    "run_defense_grade": 84.9,
    "tackling_grade": 71.6,
    "pass_rush_grade": 39.7,
    "coverage_grade": 66.2,
    "pressure_total": 0,
    "sacks": 0,
    "hits": 0,
    "hurries": 0,
    "batted_passes": 0,
    "tackles": 21,
    "assists": 7,
    "missed_tackles": 2,
    "missed_tackle_rate": 6.7,
    "stops": 8,
    "forced_fumbles": 1,
    "targets": 29,
    "receptions_allowed": 15,
    "reception_pct_allowed": 51.7,
    "yards_allowed": 146,
    "yards_per_reception_allowed": 9.7,
    "yards_after_catch_allowed": 32,
    "longest_reception_allowed": 30
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

-- Keyshawn Burgos
with target as (
  select id
  from public.players
  where first_name = 'Keyshawn' and last_name = 'Burgos' and position = 'EDGE'
  order by created_at desc
  limit 1
)
insert into public.player_pff_profiles (
  player_id, pff_player_name, current_team, jersey_number, height_in, weight_lbs, draft_eligibility_year, source, raw_payload
)
select
  id, 'Keyshawn Burgos', 'Purdue Boilermakers', 'ED #11', 77, 260, 2026, 'manual_screenshot',
  '{"source_note":"Keyshawn Burgos defense screenshots"}'::jsonb
from target
on conflict (player_id) do update
set
  pff_player_name = excluded.pff_player_name,
  current_team = excluded.current_team,
  jersey_number = excluded.jersey_number,
  height_in = excluded.height_in,
  weight_lbs = excluded.weight_lbs,
  draft_eligibility_year = excluded.draft_eligibility_year,
  source = excluded.source,
  raw_payload = excluded.raw_payload;

with target as (
  select id
  from public.players
  where first_name = 'Keyshawn' and last_name = 'Burgos' and position = 'EDGE'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2025, 'VA TECH', 'defense', 'manual_screenshot', 'defense_summary',
  '{
    "total_snaps": 73,
    "run_defense_snaps": 50,
    "pass_rush_snaps": 18,
    "coverage_snaps": 5,
    "defense_grade": 57.9,
    "run_defense_grade": 59.2,
    "tackling_grade": 28.7,
    "pass_rush_grade": 71.3,
    "coverage_grade": 61.7,
    "pressure_total": 3,
    "sacks": 0,
    "hits": 0,
    "hurries": 3,
    "batted_passes": 0,
    "tackles": 1,
    "assists": 2,
    "missed_tackles": 2,
    "missed_tackle_rate": 40.0,
    "stops": 1,
    "forced_fumbles": 0,
    "targets": 0,
    "receptions_allowed": 0
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;

with target as (
  select id
  from public.players
  where first_name = 'Keyshawn' and last_name = 'Burgos' and position = 'EDGE'
  order by created_at desc
  limit 1
)
insert into public.player_pff_season_reports (
  player_id, season, team_name, report_type, source, source_key, metrics
)
select
  id, 2024, 'VA TECH', 'defense', 'manual_screenshot', 'defense_summary',
  '{
    "total_snaps": 456,
    "run_defense_snaps": 194,
    "pass_rush_snaps": 257,
    "coverage_snaps": 5,
    "defense_grade": 60.4,
    "run_defense_grade": 63.0,
    "tackling_grade": 49.3,
    "pass_rush_grade": 60.0,
    "coverage_grade": 54.8,
    "pressure_total": 20,
    "sacks": 2,
    "hits": 6,
    "hurries": 12,
    "batted_passes": 0,
    "tackles": 20,
    "assists": 8,
    "missed_tackles": 8,
    "missed_tackle_rate": 22.2,
    "stops": 16,
    "forced_fumbles": 0,
    "targets": 1,
    "receptions_allowed": 1,
    "reception_pct_allowed": 100.0,
    "yards_allowed": 13,
    "yards_per_reception_allowed": 13.0,
    "yards_after_catch_allowed": 6,
    "longest_reception_allowed": 13
  }'::jsonb
from target
on conflict (player_id, season, source_key) do update
set team_name = excluded.team_name, report_type = excluded.report_type, source = excluded.source, metrics = excluded.metrics;
