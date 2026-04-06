export type PositionGroup =
  | "QB"
  | "RB"
  | "WR"
  | "TE"
  | "OL"
  | "EDGE"
  | "DL"
  | "LB"
  | "CB"
  | "S"
  | "ST";

export type NeedPriority = "critical" | "high" | "medium";
export type NeedStatus = "active" | "closed" | "draft";
export type ReviewDecision = "right" | "left" | "save" | "needs_film";
export type ProductionStatKey =
  | "starts"
  | "games_played"
  | "receiving_yards"
  | "rushing_yards"
  | "tackles"
  | "sacks"
  | "interceptions"
  | "passes_defended"
  | "offensive_snaps"
  | "defensive_snaps";
export type ShortlistStage =
  | "assistant"
  | "coordinator"
  | "head_coach"
  | "final_watch";

export interface ProductionFilters {
  min_games_played: number | null;
  min_starts: number | null;
  stat_key: ProductionStatKey | null;
  min_stat_value: number | null;
}

export interface PlayerMeasurement {
  player_id: string;
  height_in: number | null;
  weight_lbs: number | null;
  arm_length_in?: number | null;
  forty_time: number | null;
  shuttle_time: number | null;
  vertical_jump: number | null;
  wing_span_in: number | null;
  verified_at: string | null;
}

export interface PlayerStat {
  player_id: string;
  season: number;
  games_played: number | null;
  starts: number | null;
  offensive_snaps: number | null;
  defensive_snaps: number | null;
  special_teams_snaps: number | null;
  passing_yards: number | null;
  rushing_yards: number | null;
  receiving_yards: number | null;
  total_touchdowns: number | null;
  tackles: number | null;
  sacks: number | null;
  interceptions: number | null;
  passes_defended: number | null;
  passing_tds?: number | null;
  interceptions_thrown?: number | null;
  rushing_attempts?: number | null;
  rushing_tds?: number | null;
  receptions?: number | null;
  receiving_tds?: number | null;
  tackles_for_loss?: number | null;
  forced_fumbles?: number | null;
  source?: string | null;
}

export interface Player {
  id: string;
  first_name: string;
  last_name: string;
  position: PositionGroup;
  transfer_year: number;
  current_school: string;
  previous_school: string | null;
  hometown: string | null;
  class_year: string;
  eligibility_remaining: number;
  stars: number | null;
  academic_status: string | null;
  status: string;
  film_url: string | null;
  photo_url?: string | null;
  x_handle?: string | null;
  x_user_id?: string | null;
  contact_window: string | null;
  notes: string | null;
  conference?: string | null;
  measurements?: PlayerMeasurement | null;
  latest_stats?: PlayerStat | null;
  tags?: string[];
}

export interface PlayerSourceNote {
  id: string;
  player_id: string;
  source_platform: string;
  source_account: string | null;
  source_url: string | null;
  note_type: string;
  source_text: string;
  summary: string | null;
  traits: string[];
  status_signal: string | null;
  confidence: number | null;
  created_by: string | null;
  created_at: string;
}

export interface Team {
  id: string;
  name: string;
  conference: string;
  logo_url: string | null;
}

export interface Profile {
  id: string;
  team_id: string;
  full_name: string;
  role: string;
}

export interface TeamNeed {
  id: string;
  team_id: string;
  created_by: string;
  title: string;
  position: PositionGroup;
  priority: NeedPriority;
  status: NeedStatus;
  target_count: number;
  class_focus: string | null;
  min_height_in: number | null;
  max_height_in?: number | null;
  min_weight_lbs: number | null;
  max_weight_lbs?: number | null;
  min_arm_length_in?: number | null;
  max_forty_time?: number | null;
  min_years_remaining?: number | null;
  scheme?: string | null;
  priority_traits?: string[] | null;
  production_filters?: ProductionFilters | null;
  min_starts: number | null;
  min_production_score: number | null;
  notes: string | null;
  created_at: string;
}

export interface TeamNeedInsertInput {
  title: string;
  position: PositionGroup;
  priority: NeedPriority;
  status: NeedStatus;
  target_count: number;
  class_focus: string | null;
  min_height_in: number | null;
  max_height_in: number | null;
  min_weight_lbs: number | null;
  max_weight_lbs: number | null;
  min_arm_length_in: number | null;
  max_forty_time: number | null;
  min_years_remaining: number | null;
  scheme: string | null;
  priority_traits: string[];
  production_filters: ProductionFilters;
  min_starts: number | null;
  min_production_score: number | null;
  notes: string | null;
}

export interface PlayerReview {
  id: string;
  need_id: string;
  player_id: string;
  reviewer_id: string;
  decision: ReviewDecision;
  fit_score: number;
  note: string | null;
  created_at: string;
}

export interface ShortlistItem {
  id: string;
  need_id: string;
  player_id: string;
  created_by: string;
  stage: ShortlistStage;
  priority_rank: number | null;
  note: string | null;
  created_at: string;
}

export interface DashboardMetrics {
  activeNeeds: number;
  totalPlayers: number;
  shortlistedPlayers: number;
  recentReviews: number;
}

export interface PlayerFitResult {
  player: Player;
  fitScore: number;
  productionScore: number;
  measurementScore: number;
  matchReasons: string[];
  fitSummary: string;
}

export interface PlayersPageResult<TPlayer> {
  items: TPlayer[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ShortlistBoardItem extends ShortlistItem {
  player: Player | null;
  need: TeamNeed | null;
  fitScore: number | null;
  latestNote: string | null;
}

import type { SchemeProfile } from "@/lib/scheme/registry";
export type { SchemeProfile };

export interface PlayerPffGrade {
  id?: string;
  pff_player_id?: number;
  player_name?: string;
  team_name?: string | null;
  position?: string | null;
  season?: number;
  player_id?: string | null;
  grades_overall?: number | null;
  grades_offense?: number | null;
  grades_defense?: number | null;
  grades_special_teams?: number | null;
  snaps_offense?: number | null;
  snaps_defense?: number | null;
  snaps_special_teams?: number | null;
  snaps_slot?: number | null;
  snaps_wide_left?: number | null;
  snaps_wide_right?: number | null;
  snaps_inline_te?: number | null;
  snaps_backfield?: number | null;
  snaps_at_left_tackle?: number | null;
  snaps_at_left_guard?: number | null;
  snaps_at_center?: number | null;
  snaps_at_right_guard?: number | null;
  snaps_at_right_tackle?: number | null;
  snaps_at_left_end?: number | null;
  snaps_at_right_end?: number | null;
  snaps_interior_dl?: number | null;
  snaps_in_box_lb?: number | null;
  snaps_off_ball_lb?: number | null;
  snaps_free_safety?: number | null;
  snaps_strong_safety?: number | null;
  snaps_slot_cb?: number | null;
  snaps_outside_cb?: number | null;
  snaps_in_box_db?: number | null;
  snaps_deep_safety?: number | null;
  grades_pass?: number | null;
  grades_run_qb?: number | null;
  stats_completions?: number | null;
  stats_attempts?: number | null;
  stats_passing_yards?: number | null;
  stats_passing_tds?: number | null;
  stats_interceptions?: number | null;
  stats_big_time_throws?: number | null;
  stats_turnover_worthy_plays?: number | null;
  stats_adjusted_completion_pct?: number | null;
  stats_yards_per_attempt?: number | null;
  grades_pass_route?: number | null;
  stats_targets?: number | null;
  stats_receptions?: number | null;
  stats_receiving_yards?: number | null;
  stats_yac?: number | null;
  stats_catch_rate?: number | null;
  stats_yards_per_route_run?: number | null;
  grades_run_rb?: number | null;
  stats_carries?: number | null;
  stats_rushing_yards?: number | null;
  stats_yards_after_contact_per_carry?: number | null;
  stats_broken_tackles?: number | null;
  stats_elusive_rating?: number | null;
  grades_pass_block_rb?: number | null;
  grades_run_block_rb?: number | null;
  grades_pass_block?: number | null;
  grades_run_block?: number | null;
  stats_pass_block_snaps?: number | null;
  stats_pressures_allowed?: number | null;
  stats_sacks_allowed?: number | null;
  stats_hits_allowed?: number | null;
  stats_hurries_allowed?: number | null;
  grades_pass_rush?: number | null;
  grades_run_defense_dl?: number | null;
  stats_pressures?: number | null;
  stats_sacks?: number | null;
  stats_hits?: number | null;
  stats_hurries?: number | null;
  stats_run_stops?: number | null;
  grades_coverage_lb?: number | null;
  grades_tackle?: number | null;
  grades_run_defense_lb?: number | null;
  grades_pass_rush_lb?: number | null;
  stats_tackles?: number | null;
  stats_stops_lb?: number | null;
  stats_forced_fumbles?: number | null;
  grades_coverage_db?: number | null;
  grades_man_coverage?: number | null;
  grades_zone_coverage?: number | null;
  grades_tackle_db?: number | null;
  stats_targets_allowed?: number | null;
  stats_receptions_allowed?: number | null;
  stats_yards_allowed?: number | null;
  stats_interceptions_def?: number | null;
  stats_pass_breakups?: number | null;
}

export interface PlayerSchemeContext {
  latestPffSeason: PlayerPffGrade | null;
  featuredStats: FeaturedStat[];
  fitTrait: string;
  schemeFitSummary: string | null;
  schemeDelta: number;
  resolvedOriginScheme: SchemeProfile | null;
  resolvedDestinationScheme: SchemeProfile | null;
}

export interface FeaturedStat {
  label: string;
  value: string;
}
