import type { PositionGroup } from "@/lib/types";
import type { SchemeProfile } from "./registry";
import type { FeaturedStat } from "./featuredStats";

// ---------------------------------------------------------------------------
// Scheme similarity helpers
// ---------------------------------------------------------------------------

const OFFENSE_COMPATIBILITY: Record<string, Record<string, number>> = {
  air_raid:   { air_raid: 2,  spread: 1,  west_coast: 0,  pro: -1, option: -2, pistol: 0  },
  spread:     { spread: 2,    air_raid: 1, pistol: 1,      west_coast: 0, pro: 0,  option: -1 },
  pistol:     { pistol: 2,    spread: 1,  option: 1,      air_raid: 0, pro: 0,  west_coast: -1 },
  west_coast: { west_coast: 2,pro: 1,     spread: 0,      air_raid: -1, option: -2, pistol: 0 },
  pro:        { pro: 2,       west_coast: 1, spread: 0,    air_raid: -1, option: -1, pistol: 0 },
  option:     { option: 2,    pistol: 1,  spread: -1,     pro: -2, air_raid: -2, west_coast: -2 },
};

const DEFENSE_COMPATIBILITY: Record<string, Record<string, number>> = {
  "4-2-5":  { "4-2-5": 2, "3-3-5": 1,  "4-3": 0,  "3-4": 0,  multiple: 1  },
  "3-4":    { "3-4": 2,   "4-3": 0,    "4-2-5": 0, "3-3-5": 1, multiple: 1 },
  "4-3":    { "4-3": 2,   "3-4": 0,    "4-2-5": 0, "3-3-5": 0, multiple: 1 },
  "3-3-5":  { "3-3-5": 2, "4-2-5": 1,  "3-4": 1,  "4-3": 0,  multiple: 1  },
  multiple:  { multiple: 2, "4-2-5": 1, "3-4": 1,  "4-3": 1,  "3-3-5": 1   },
};

function offenseTranslation(origin: SchemeProfile, dest: SchemeProfile): number {
  return OFFENSE_COMPATIBILITY[origin.offense_family]?.[dest.offense_family] ?? 0;
}

function defenseTranslation(origin: SchemeProfile, dest: SchemeProfile): number {
  return DEFENSE_COMPATIBILITY[origin.defense_front]?.[dest.defense_front] ?? 0;
}

// ---------------------------------------------------------------------------
// Philosophy match (position-specific)
// ---------------------------------------------------------------------------

function philosophyMatch(
  dest: SchemeProfile,
  position: PositionGroup,
  featuredStats: FeaturedStat[]
): number {
  const labels = featuredStats.map((s) => s.label.toLowerCase());
  let score = 0;

  switch (position) {
    case "QB":
      if (dest.offense_style === "pass_heavy" && labels.some((l) => l.includes("pass") || l.includes("adj"))) score += 1;
      if (dest.offense_family === "air_raid" && labels.some((l) => l.includes("ypa") || l.includes("compl"))) score += 1;
      if (dest.run_family === "read_option" && labels.some((l) => l.includes("rush"))) score += 1;
      break;
    case "RB":
      if ((dest.run_family === "gap" || dest.run_family === "power") && labels.some((l) => l.includes("yac") || l.includes("broken"))) score += 1;
      if ((dest.run_family === "zone") && labels.some((l) => l.includes("rush grade"))) score += 1;
      if (dest.offense_style === "pass_heavy" && labels.some((l) => l.includes("receiving"))) score += 1;
      break;
    case "WR":
      if (dest.offense_style === "pass_heavy" && labels.some((l) => l.includes("yprr") || l.includes("receiv"))) score += 1;
      if (dest.offense_family === "air_raid" && labels.some((l) => l.includes("catch rate"))) score += 1;
      break;
    case "TE":
      if (dest.run_family === "gap" || dest.run_family === "power") {
        if (labels.some((l) => l.includes("run block") || l.includes("inline"))) score += 1;
      }
      if (dest.offense_style === "pass_heavy" && labels.some((l) => l.includes("receiv") || l.includes("yprr"))) score += 1;
      break;
    case "OL":
      if ((dest.run_family === "gap" || dest.run_family === "power") && labels.some((l) => l.includes("run block"))) score += 1;
      if (dest.offense_style === "pass_heavy" && labels.some((l) => l.includes("pass block"))) score += 1;
      break;
    case "DL":
    case "EDGE":
      if ((dest.defense_style === "man_pressure" || dest.defense_style === "zone_pressure") && labels.some((l) => l.includes("pass rush"))) score += 1;
      if (dest.run_family === "power" || dest.run_family === "gap") {
        if (labels.some((l) => l.includes("run"))) score += 1;
      }
      break;
    case "LB":
      if (dest.defense_style === "zone" && labels.some((l) => l.includes("coverage"))) score += 1;
      if ((dest.defense_style === "man_pressure" || dest.defense_style === "zone_pressure") && labels.some((l) => l.includes("pass rush"))) score += 1;
      break;
    case "CB":
      if ((dest.defense_style === "press_man" || dest.defense_style === "man" || dest.defense_style === "man_pressure") && labels.some((l) => l.includes("man"))) score += 1;
      if ((dest.defense_style === "zone" || dest.defense_style === "cover_2") && labels.some((l) => l.includes("zone"))) score += 1;
      break;
    case "S":
      if ((dest.defense_style === "zone" || dest.defense_style === "cover_2") && labels.some((l) => l.includes("coverage"))) score += 1;
      if (dest.defense_front === "4-2-5" && labels.some((l) => l.includes("box"))) score += 1;
      break;
  }

  return Math.min(score, 2);
}

// ---------------------------------------------------------------------------
// Standout bonus
// ---------------------------------------------------------------------------

function standoutBonus(
  dest: SchemeProfile,
  position: PositionGroup,
  featuredStats: FeaturedStat[]
): number {
  if (featuredStats.length === 0) return 0;
  const top = featuredStats[0].label.toLowerCase();

  if (position === "EDGE" || position === "DL") {
    if ((dest.defense_style === "man_pressure" || dest.defense_style === "zone_pressure") && top.includes("pass rush")) return 2;
  }
  if (position === "WR" || position === "TE") {
    if (dest.offense_style === "pass_heavy" && (top.includes("receiv") || top.includes("yprr"))) return 2;
  }
  if (position === "OL") {
    if (dest.offense_style === "pass_heavy" && top.includes("pass block")) return 2;
    if ((dest.run_family === "gap" || dest.run_family === "power") && top.includes("run block")) return 2;
  }
  if (position === "RB") {
    if ((dest.run_family === "gap" || dest.run_family === "power") && (top.includes("yac") || top.includes("broken"))) return 2;
  }
  if (position === "CB") {
    if (dest.defense_style === "press_man" && top.includes("man")) return 2;
  }
  if (position === "S") {
    if (dest.defense_front === "4-2-5" && top.includes("coverage")) return 2;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Main exports
// ---------------------------------------------------------------------------

/**
 * Returns a delta in range [−8, +8] to fold into the existing fit score.
 * For positions that are neither offense nor defense dominant, only the
 * relevant axis (offense for skill, defense for defenders) is used.
 */
export function computeSchemeDelta(
  origin: SchemeProfile | null,
  dest: SchemeProfile | null,
  position: PositionGroup,
  featuredStats: FeaturedStat[]
): number {
  if (!origin || !dest) return 0;

  const offensePositions: PositionGroup[] = ["QB", "RB", "WR", "TE", "OL"];
  const defensePositions: PositionGroup[] = ["DL", "EDGE", "LB", "CB", "S"];

  let translation = 0;
  if (offensePositions.includes(position)) {
    translation = offenseTranslation(origin, dest); // −2 to +2
  } else if (defensePositions.includes(position)) {
    translation = defenseTranslation(origin, dest); // −2 to +2
  }

  const philosophy = philosophyMatch(dest, position, featuredStats); // 0 to +2
  const bonus = standoutBonus(dest, position, featuredStats);          // 0 or +2

  const raw = translation + philosophy + bonus;
  return Math.max(-8, Math.min(8, raw));
}

/**
 * Human-readable scheme translation sentence.
 * Returns null if either scheme is unknown.
 */
export function generateSchemeSummary(
  origin: SchemeProfile | null,
  dest: SchemeProfile | null,
  position: PositionGroup,
  fitTrait: string
): string | null {
  if (!origin || !dest || !fitTrait) return null;

  const originDesc = `${origin.offense_style.replace("_", "-")} ${origin.offense_family.replace("_", " ")}`;
  const destDesc = `${dest.defense_style.replace("_", "-")} ${dest.defense_front}`;

  const offensePositions: PositionGroup[] = ["QB", "RB", "WR", "TE", "OL"];
  if (offensePositions.includes(position)) {
    const originOffense = `${origin.offense_style.replace("_", "-")} ${origin.offense_family.replace("_", " ")}`;
    const destOffense = `${dest.offense_style.replace("_", "-")} ${dest.offense_family.replace("_", " ")}`;
    return `Travels well from a ${originOffense} into a ${destOffense} offense as a ${fitTrait}`;
  }

  return `Travels well from a ${originDesc} scheme into a ${destDesc} as a ${fitTrait}`;
}
