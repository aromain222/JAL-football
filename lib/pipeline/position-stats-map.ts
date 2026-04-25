/**
 * Maps position groups to the stat columns that matter most for enrichment
 * and display. Used by the queue enrichment scripts to decide which stats to
 * fetch / verify and by the AI search to weight production scoring.
 */

export type PositionGroup =
  | "QB"
  | "RB"
  | "WR"
  | "TE"
  | "OL"
  | "DL"
  | "EDGE"
  | "LB"
  | "CB"
  | "S"
  | "K"
  | "P"
  | "OTHER";

/** Canonical stat column names from `player_stats` table. */
export type StatColumn =
  | "games_played"
  | "starts"
  | "offensive_snaps"
  | "defensive_snaps"
  | "special_teams_snaps"
  | "passing_yards"
  | "passing_tds"
  | "interceptions_thrown"
  | "rushing_attempts"
  | "rushing_yards"
  | "rushing_tds"
  | "receptions"
  | "receiving_yards"
  | "receiving_tds"
  | "total_touchdowns"
  | "tackles"
  | "sacks"
  | "interceptions"
  | "passes_defended"
  | "tackles_for_loss"
  | "forced_fumbles";

export interface PositionStatConfig {
  /** Stats to fetch/verify (in priority order). */
  primary: StatColumn[];
  /** Additional context stats. */
  secondary: StatColumn[];
}

const COMMON: StatColumn[] = ["games_played", "starts"];

export const POSITION_STAT_MAP: Record<PositionGroup, PositionStatConfig> = {
  QB: {
    primary: ["passing_yards", "passing_tds", "interceptions_thrown"],
    secondary: [...COMMON, "rushing_yards", "rushing_tds", "offensive_snaps"],
  },
  RB: {
    primary: ["rushing_yards", "rushing_attempts", "rushing_tds"],
    secondary: [...COMMON, "receptions", "receiving_yards", "total_touchdowns", "offensive_snaps"],
  },
  WR: {
    primary: ["receptions", "receiving_yards", "receiving_tds"],
    secondary: [...COMMON, "total_touchdowns", "offensive_snaps"],
  },
  TE: {
    primary: ["receptions", "receiving_yards", "receiving_tds"],
    secondary: [...COMMON, "total_touchdowns", "offensive_snaps"],
  },
  OL: {
    primary: ["offensive_snaps", "starts"],
    secondary: [...COMMON],
  },
  DL: {
    primary: ["sacks", "tackles_for_loss", "tackles"],
    secondary: [...COMMON, "forced_fumbles", "defensive_snaps"],
  },
  EDGE: {
    primary: ["sacks", "tackles_for_loss", "tackles"],
    secondary: [...COMMON, "forced_fumbles", "defensive_snaps"],
  },
  LB: {
    primary: ["tackles", "sacks", "interceptions"],
    secondary: [...COMMON, "tackles_for_loss", "passes_defended", "defensive_snaps"],
  },
  CB: {
    primary: ["interceptions", "passes_defended", "tackles"],
    secondary: [...COMMON, "defensive_snaps"],
  },
  S: {
    primary: ["interceptions", "passes_defended", "tackles"],
    secondary: [...COMMON, "tackles_for_loss", "defensive_snaps"],
  },
  K: {
    primary: ["special_teams_snaps"],
    secondary: [...COMMON],
  },
  P: {
    primary: ["special_teams_snaps"],
    secondary: [...COMMON],
  },
  OTHER: {
    primary: ["games_played"],
    secondary: [...COMMON],
  },
};

/** Normalize a raw position string to one of the canonical PositionGroup keys. */
export function normalizePositionGroup(pos: string | null | undefined): PositionGroup {
  const p = (pos ?? "").toUpperCase().trim();
  if (["QB"].includes(p)) return "QB";
  if (["RB", "HB", "FB"].includes(p)) return "RB";
  if (["WR", "FL", "SE"].includes(p)) return "WR";
  if (["TE"].includes(p)) return "TE";
  if (["OL", "OT", "OG", "G", "T", "C", "LT", "RT", "LG", "RG", "IOL"].includes(p)) return "OL";
  if (["DL", "DT", "NT", "DE", "IDL"].includes(p)) return "DL";
  if (["EDGE", "OLB", "LEO", "SDE"].includes(p)) return "EDGE";
  if (["LB", "ILB", "MLB", "WILL", "MIKE", "SAM"].includes(p)) return "LB";
  if (["CB", "DB", "NB", "SLOT"].includes(p)) return "CB";
  if (["S", "SS", "FS", "SAF"].includes(p)) return "S";
  if (["K", "PK"].includes(p)) return "K";
  if (["P"].includes(p)) return "P";
  return "OTHER";
}

export function getPositionStats(pos: string | null | undefined): PositionStatConfig {
  return POSITION_STAT_MAP[normalizePositionGroup(pos)];
}
