import type { PositionGroup } from "@/lib/types";
import type { PlayerPffGrade } from "@/lib/types";

export interface FeaturedStat {
  label: string;
  value: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function grade(val: number | null | undefined, label: string): { label: string; value: string; score: number } | null {
  if (val == null || val <= 0) return null;
  return { label, value: val.toFixed(1), score: val };
}

function count(val: number | null | undefined, label: string, minVal = 1): { label: string; value: string; score: number } | null {
  if (val == null || val < minVal) return null;
  return { label, value: String(val), score: val };
}

function decimal(val: number | null | undefined, label: string, suffix = "", minVal = 0): { label: string; value: string; score: number } | null {
  if (val == null || val <= minVal) return null;
  return { label, value: `${val.toFixed(1)}${suffix}`, score: val };
}

function pct(val: number | null | undefined, label: string): { label: string; value: string; score: number } | null {
  if (val == null || val <= 0) return null;
  return { label, value: `${val.toFixed(1)}%`, score: val };
}

type Candidate = { label: string; value: string; score: number };

/** Pick top-N candidates by score, filtering nulls. */
function pick(candidates: (Candidate | null)[], max = 3): FeaturedStat[] {
  return (candidates.filter(Boolean) as Candidate[])
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map(({ label, value }) => ({ label, value }));
}

// ---------------------------------------------------------------------------
// Alignment usage helpers
// ---------------------------------------------------------------------------

function alignmentStat(pff: PlayerPffGrade): Candidate | null {
  const slot = pff.snaps_slot ?? 0;
  const wide = (pff.snaps_wide_left ?? 0) + (pff.snaps_wide_right ?? 0);
  const inline = pff.snaps_inline_te ?? 0;
  const total = slot + wide + inline;
  if (total < 50) return null;
  const dominant = Math.max(slot, wide, inline);
  if (dominant === slot && slot / total > 0.45)
    return { label: "Slot Usage", value: `${Math.round((slot / total) * 100)}%`, score: 30 };
  if (dominant === wide && wide / total > 0.5)
    return { label: "Wide Usage", value: `${Math.round((wide / total) * 100)}%`, score: 25 };
  if (dominant === inline && inline / total > 0.4)
    return { label: "Inline TE Usage", value: `${Math.round((inline / total) * 100)}%`, score: 25 };
  return null;
}

function safetyAlignmentStat(pff: PlayerPffGrade): Candidate | null {
  const box = pff.snaps_in_box_db ?? 0;
  const deep = pff.snaps_deep_safety ?? 0;
  const slot = pff.snaps_slot_cb ?? 0;
  const total = box + deep + slot;
  if (total < 30) return null;
  if (box / total > 0.4) return { label: "Box Safety %", value: `${Math.round((box / total) * 100)}%`, score: 30 };
  if (deep / total > 0.4) return { label: "Deep Safety %", value: `${Math.round((deep / total) * 100)}%`, score: 28 };
  return null;
}

// ---------------------------------------------------------------------------
// fitTrait derivation
// ---------------------------------------------------------------------------

function deriveFitTrait(position: PositionGroup, pff: PlayerPffGrade): string {
  switch (position) {
    case "QB": {
      if ((pff.grades_pass ?? 0) >= 80) return "high-accuracy passer";
      if ((pff.stats_yards_per_attempt ?? 0) >= 8.5) return "downfield passer";
      if ((pff.grades_run_qb ?? 0) >= 70) return "dual-threat QB";
      return "pocket passer";
    }
    case "RB": {
      if ((pff.stats_yards_after_contact_per_carry ?? 0) >= 3.0) return "downhill power back";
      if ((pff.stats_broken_tackles ?? 0) >= 15) return "elusive back";
      if ((pff.grades_pass_route ?? 0) >= 70) return "receiving back";
      return "between-the-tackles runner";
    }
    case "WR": {
      if ((pff.stats_yards_per_route_run ?? 0) >= 2.2) return "route-running receiver";
      const slot = pff.snaps_slot ?? 0;
      const wide = (pff.snaps_wide_left ?? 0) + (pff.snaps_wide_right ?? 0);
      if (slot > wide) return "slot receiver";
      return "outside receiver";
    }
    case "TE": {
      if ((pff.grades_pass_route ?? 0) >= 70) return "receiving TE";
      if ((pff.grades_run_block ?? 0) >= 65) return "inline blocking TE";
      return "hybrid TE";
    }
    case "OL": {
      const pb = pff.grades_pass_block ?? 0;
      const rb = pff.grades_run_block ?? 0;
      if (pb > rb && pb >= 65) return "pass-blocking lineman";
      if (rb > pb && rb >= 65) return "run-blocking lineman";
      return "interior lineman";
    }
    case "EDGE": {
      if ((pff.grades_pass_rush ?? 0) >= 75) return "pass-rush specialist";
      if ((pff.grades_run_defense_dl ?? 0) >= 70) return "run-stopping edge";
      return "edge defender";
    }
    case "DL": {
      if ((pff.grades_pass_rush ?? 0) >= 70) return "interior pass rusher";
      if ((pff.grades_run_defense_dl ?? 0) >= 70) return "nose/run stuffer";
      return "interior defensive lineman";
    }
    case "LB": {
      if ((pff.grades_coverage_lb ?? 0) >= 70) return "coverage linebacker";
      if ((pff.grades_pass_rush_lb ?? 0) >= 70) return "blitzing linebacker";
      if ((pff.grades_tackle ?? 0) >= 72) return "downhill tackler";
      return "off-ball linebacker";
    }
    case "CB": {
      const outside = pff.snaps_outside_cb ?? 0;
      const slotCb = pff.snaps_slot_cb ?? 0;
      if ((pff.grades_man_coverage ?? 0) >= 70) return "man-coverage corner";
      if ((pff.grades_zone_coverage ?? 0) >= 70) {
        if (slotCb > outside) return "zone-coverage slot corner";
        return "zone-coverage corner";
      }
      if (slotCb > outside) return "slot cornerback";
      return "outside cornerback";
    }
    case "S": {
      const box = pff.snaps_in_box_db ?? 0;
      const deep = pff.snaps_deep_safety ?? 0;
      if ((pff.grades_coverage_db ?? 0) >= 70) {
        if (deep > box) return "zone-coverage deep safety";
        return "box/fit safety";
      }
      if ((pff.grades_tackle_db ?? 0) >= 70) return "box safety / run supporter";
      return "free safety";
    }
    default:
      return "special teams contributor";
  }
}

// ---------------------------------------------------------------------------
// Main selector
// ---------------------------------------------------------------------------

export function selectFeaturedStats(
  pff: PlayerPffGrade,
  position: PositionGroup
): { featuredStats: FeaturedStat[]; fitTrait: string } {
  const fitTrait = deriveFitTrait(position, pff);
  let candidates: (Candidate | null)[] = [];

  switch (position) {
    case "QB":
      candidates = [
        grade(pff.grades_pass,                     "Pass Grade"),
        pct(pff.stats_adjusted_completion_pct,     "Adj. Completion %"),
        decimal(pff.stats_yards_per_attempt,       "YPA"),
        count(pff.stats_big_time_throws,           "Big Time Throws", 2),
        grade(pff.grades_run_qb,                   "Rush Grade"),
      ];
      break;

    case "RB":
      candidates = [
        grade(pff.grades_run_rb,                        "Rush Grade"),
        decimal(pff.stats_yards_after_contact_per_carry,"YAC/Carry"),
        count(pff.stats_broken_tackles,                 "Broken Tackles", 5),
        grade(pff.grades_pass_route,                    "Receiving Grade"),
        grade(pff.grades_pass_block_rb,                 "Pass Block Grade"),
      ];
      break;

    case "WR":
      candidates = [
        grade(pff.grades_pass_route,             "Receiving Grade"),
        decimal(pff.stats_yards_per_route_run,   "YPRR"),
        pct(pff.stats_catch_rate,                "Catch Rate"),
        decimal(pff.stats_yac,                   "YAC"),
        alignmentStat(pff),
      ];
      break;

    case "TE":
      candidates = [
        grade(pff.grades_pass_route,             "Receiving Grade"),
        decimal(pff.stats_yards_per_route_run,   "YPRR"),
        pct(pff.stats_catch_rate,                "Catch Rate"),
        grade(pff.grades_run_block,              "Run Block Grade"),
        alignmentStat(pff),
      ];
      break;

    case "OL":
      candidates = [
        grade(pff.grades_pass_block,          "Pass Block Grade"),
        grade(pff.grades_run_block,           "Run Block Grade"),
        count(pff.stats_pressures_allowed,    "Pressures Allowed", 0),   // lower = better — invert
        decimal(pff.stats_sacks_allowed,      "Sacks Allowed"),
      ];
      // For OL, fewer pressures is better — flip the score so low numbers rank well
      candidates = candidates.map((c) => {
        if (!c) return null;
        if (c.label === "Pressures Allowed") {
          // Only show if low enough to be a standout
          const raw = pff.stats_pressures_allowed ?? 99;
          if (raw > 15) return null;
          return { ...c, score: 100 - raw };
        }
        return c;
      });
      break;

    case "DL":
    case "EDGE":
      candidates = [
        grade(pff.grades_pass_rush,            "Pass Rush Grade"),
        grade(pff.grades_run_defense_dl,       "Run Defense Grade"),
        count(pff.stats_pressures,             "Pressures", 5),
        decimal(pff.stats_sacks,               "Sacks"),
        count(pff.stats_run_stops,             "Run Stops", 5),
      ];
      break;

    case "LB":
      candidates = [
        grade(pff.grades_coverage_lb,          "Coverage Grade"),
        grade(pff.grades_tackle,               "Tackle Grade"),
        grade(pff.grades_run_defense_lb,       "Run Defense Grade"),
        grade(pff.grades_pass_rush_lb,         "Pass Rush Grade"),
        count(pff.stats_stops_lb,              "Stops", 5),
      ];
      break;

    case "CB":
      candidates = [
        grade(pff.grades_coverage_db,          "Coverage Grade"),
        grade(pff.grades_man_coverage,         "Man Coverage"),
        grade(pff.grades_zone_coverage,        "Zone Coverage"),
        count(pff.stats_interceptions_def,     "INTs"),
        count(pff.stats_pass_breakups,         "PBUs", 2),
      ];
      break;

    case "S":
      candidates = [
        grade(pff.grades_coverage_db,          "Coverage Grade"),
        grade(pff.grades_tackle_db,            "Tackle Grade"),
        count(pff.stats_interceptions_def,     "INTs"),
        count(pff.stats_pass_breakups,         "PBUs", 2),
        safetyAlignmentStat(pff),
      ];
      break;

    default:
      // ST-only
      candidates = [
        grade(pff.grades_special_teams,        "ST Grade"),
        count(pff.snaps_special_teams,         "ST Snaps", 50),
      ];
  }

  return { featuredStats: pick(candidates, 3), fitTrait };
}
