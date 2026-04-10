import type { PlayerPffGrade, PositionGroup } from "@/lib/types";

export interface PffPrimaryGrade {
  key: string;
  label: string;
  value: number;
}

const DEFAULT_GRADE_PRIORITY = [
  { key: "grades_overall", label: "Overall" },
  { key: "grades_offense", label: "Offense" },
  { key: "grades_defense", label: "Defense" },
  { key: "grades_pass", label: "Passing" },
  { key: "grades_pass_route", label: "Route" },
  { key: "grades_run_rb", label: "Run" },
  { key: "grades_pass_rush", label: "Pass Rush" },
  { key: "grades_coverage_db", label: "Coverage" },
  { key: "grades_coverage_lb", label: "Coverage" },
  { key: "grades_run_block", label: "Run Block" },
  { key: "grades_pass_block", label: "Pass Block" },
  { key: "grades_tackle", label: "Tackle" },
] as const;

const POSITION_GRADE_PRIORITY: Record<string, Array<{ key: keyof PlayerPffGrade | string; label: string }>> = {
  QB: [
    { key: "grades_overall", label: "Overall" },
    { key: "grades_pass", label: "Passing" },
    { key: "grades_offense", label: "Offense" },
  ],
  WR: [
    { key: "grades_overall", label: "Overall" },
    { key: "grades_pass_route", label: "Route" },
    { key: "grades_offense", label: "Offense" },
    { key: "grades_hands_drop", label: "Hands" },
  ],
  TE: [
    { key: "grades_overall", label: "Overall" },
    { key: "grades_pass_route", label: "Route" },
    { key: "grades_run_block", label: "Block" },
    { key: "grades_offense", label: "Offense" },
  ],
  RB: [
    { key: "grades_overall", label: "Overall" },
    { key: "grades_run_rb", label: "Run" },
    { key: "grades_offense", label: "Offense" },
    { key: "grades_pass_block_rb", label: "Pass Block" },
  ],
  OL: [
    { key: "grades_overall", label: "Overall" },
    { key: "grades_pass_block", label: "Pass Block" },
    { key: "grades_run_block", label: "Run Block" },
  ],
  EDGE: [
    { key: "grades_overall", label: "Overall" },
    { key: "grades_pass_rush", label: "Pass Rush" },
    { key: "grades_defense", label: "Defense" },
    { key: "grades_run_defense_dl", label: "Run Defense" },
  ],
  DL: [
    { key: "grades_overall", label: "Overall" },
    { key: "grades_defense", label: "Defense" },
    { key: "grades_pass_rush", label: "Pass Rush" },
    { key: "grades_run_defense_dl", label: "Run Defense" },
  ],
  LB: [
    { key: "grades_overall", label: "Overall" },
    { key: "grades_defense", label: "Defense" },
    { key: "grades_coverage_lb", label: "Coverage" },
    { key: "grades_run_defense_lb", label: "Run Defense" },
    { key: "grades_pass_rush_lb", label: "Pass Rush" },
    { key: "grades_tackle", label: "Tackle" },
  ],
  CB: [
    { key: "grades_overall", label: "Overall" },
    { key: "grades_coverage_db", label: "Coverage" },
    { key: "grades_defense", label: "Defense" },
    { key: "grades_tackle_db", label: "Tackle" },
  ],
  S: [
    { key: "grades_overall", label: "Overall" },
    { key: "grades_coverage_db", label: "Coverage" },
    { key: "grades_defense", label: "Defense" },
    { key: "grades_tackle_db", label: "Tackle" },
  ],
};

function toNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function normalizePosition(position?: string | null): PositionGroup | string | null {
  if (!position) return null;
  const upper = position.toUpperCase();
  if (upper === "DE") return "EDGE";
  if (upper === "DT" || upper === "NT") return "DL";
  return upper;
}

export function getPffPrimaryGrade(
  pffStats: Record<string, unknown> | PlayerPffGrade | null | undefined,
  position?: string | null
): PffPrimaryGrade | null {
  if (!pffStats) return null;

  const normalizedPosition = normalizePosition(position ?? (pffStats.position as string | null | undefined));
  const candidates = normalizedPosition
    ? POSITION_GRADE_PRIORITY[normalizedPosition] ?? DEFAULT_GRADE_PRIORITY
    : DEFAULT_GRADE_PRIORITY;

  for (const candidate of candidates) {
    const value = toNumber(pffStats[candidate.key as keyof typeof pffStats]);
    if (value != null) {
      return { key: candidate.key, label: candidate.label, value };
    }
  }

  return null;
}

export function formatPffPrimaryGrade(
  pffStats: Record<string, unknown> | PlayerPffGrade | null | undefined,
  position?: string | null
): string | null {
  const primary = getPffPrimaryGrade(pffStats, position);
  if (!primary) return null;
  return `${primary.label} ${primary.value.toFixed(1)}`;
}

function populatedSignalCount(row: Record<string, unknown>): number {
  return Object.entries(row).reduce((count, [key, value]) => {
    if (!key.startsWith("grades_") && !key.startsWith("stats_") && !key.startsWith("snaps_")) {
      return count;
    }
    if (value == null || value === "" || value === 0 || value === "0") return count;
    return count + 1;
  }, 0);
}

function precedenceScore(row: Record<string, unknown>): number {
  let score = 0;
  const pffPlayerId = toNumber(row.pff_player_id);
  if (pffPlayerId != null && pffPlayerId > 0) score += 1_000_000;
  if (row.player_id) score += 100_000;
  score += Number(row.season ?? 0) * 1_000;
  score += populatedSignalCount(row);
  const updatedAt = typeof row.updated_at === "string" ? Date.parse(row.updated_at) : 0;
  if (Number.isFinite(updatedAt)) score += Math.floor(updatedAt / 1_000_000_000);
  return score;
}

export function choosePreferredPffRow(
  rows: Array<Record<string, unknown>>
): Record<string, unknown> | null {
  if (!rows.length) return null;
  return [...rows].sort((a, b) => precedenceScore(b) - precedenceScore(a))[0] ?? null;
}
