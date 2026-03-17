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
  contact_window: string | null;
  notes: string | null;
  conference?: string | null;
  measurements?: PlayerMeasurement | null;
  latest_stats?: PlayerStat | null;
  tags?: string[];
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
