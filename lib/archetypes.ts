import type { PositionGroup } from "@/lib/types";

export type ArchetypeDef = {
  name: string;
  position: PositionGroup;
  heightMin: number; // inches
  heightMax: number;
  weightMin: number; // lbs
  weightMax: number;
};

export const ARCHETYPES: ArchetypeDef[] = [
  // RB
  { name: "Workhorse",    position: "RB", heightMin: 70, heightMax: 74, weightMin: 215, weightMax: 240 },
  { name: "All-Purpose",  position: "RB", heightMin: 68, heightMax: 72, weightMin: 195, weightMax: 215 },
  { name: "Speed Back",   position: "RB", heightMin: 68, heightMax: 71, weightMin: 180, weightMax: 200 },
  // WR
  { name: "X Receiver",  position: "WR", heightMin: 73, heightMax: 77, weightMin: 200, weightMax: 230 },
  { name: "Slot",         position: "WR", heightMin: 69, heightMax: 73, weightMin: 180, weightMax: 205 },
  { name: "Deep Threat",  position: "WR", heightMin: 69, heightMax: 74, weightMin: 175, weightMax: 200 },
  // TE
  { name: "Inline TE",   position: "TE", heightMin: 75, heightMax: 78, weightMin: 240, weightMax: 270 },
  { name: "Move TE",     position: "TE", heightMin: 74, heightMax: 77, weightMin: 220, weightMax: 245 },
  // OL
  { name: "Pass Pro LT",       position: "OL", heightMin: 77, heightMax: 80, weightMin: 300, weightMax: 320 },
  { name: "Power RT",           position: "OL", heightMin: 77, heightMax: 80, weightMin: 310, weightMax: 340 },
  { name: "Center",             position: "OL", heightMin: 73, heightMax: 76, weightMin: 290, weightMax: 310 },
  { name: "Guard Technician",   position: "OL", heightMin: 75, heightMax: 78, weightMin: 300, weightMax: 320 },
  { name: "Guard Mauler",       position: "OL", heightMin: 75, heightMax: 78, weightMin: 320, weightMax: 350 },
  // DL
  { name: "Nose Tackle", position: "DL", heightMin: 73, heightMax: 76, weightMin: 300, weightMax: 380 },
  { name: "3-Tech",      position: "DL", heightMin: 74, heightMax: 77, weightMin: 270, weightMax: 305 },
  // EDGE
  { name: "Speed Rusher", position: "EDGE", heightMin: 74, heightMax: 77, weightMin: 240, weightMax: 270 },
  { name: "Power End",    position: "EDGE", heightMin: 75, heightMax: 78, weightMin: 260, weightMax: 290 },
  // LB
  { name: "Mike", position: "LB", heightMin: 72, heightMax: 75, weightMin: 230, weightMax: 250 },
  { name: "Will", position: "LB", heightMin: 72, heightMax: 75, weightMin: 215, weightMax: 235 },
  { name: "Sam",  position: "LB", heightMin: 74, heightMax: 77, weightMin: 240, weightMax: 265 },
  // CB
  { name: "Outside CB", position: "CB", heightMin: 71, heightMax: 74, weightMin: 180, weightMax: 200 },
  { name: "Slot CB",    position: "CB", heightMin: 69, heightMax: 72, weightMin: 175, weightMax: 195 },
  // S
  { name: "Free Safety",   position: "S", heightMin: 70, heightMax: 74, weightMin: 190, weightMax: 210 },
  { name: "Strong Safety", position: "S", heightMin: 72, heightMax: 75, weightMin: 205, weightMax: 225 },
];

/**
 * Score how well a value fits within [min, max].
 * Returns 1.0 if inside, decays linearly to 0 as distance grows past the range.
 */
function dimensionScore(value: number, min: number, max: number): number {
  if (value >= min && value <= max) return 1.0;
  const range = max - min;
  const slack = Math.max(range * 0.3, 2); // allow 30% overhang (min 2 units)
  if (value < min) return Math.max(0, 1 - (min - value) / slack);
  return Math.max(0, 1 - (value - max) / slack);
}

/**
 * Returns the best-fit archetype name for a player given their position and
 * measurements, or null if measurements are missing / no candidate scores ≥ 0.5.
 */
export function detectArchetype(
  position: string | null | undefined,
  height_in: number | null | undefined,
  weight_lbs: number | null | undefined
): string | null {
  if (!position || height_in == null || weight_lbs == null) return null;

  const pos = position.toUpperCase();
  const candidates = ARCHETYPES.filter((a) => a.position === pos);
  if (!candidates.length) return null;

  let best: ArchetypeDef | null = null;
  let bestScore = -1;

  for (const a of candidates) {
    const hScore = dimensionScore(height_in, a.heightMin, a.heightMax);
    const wScore = dimensionScore(weight_lbs, a.weightMin, a.weightMax);
    const score = (hScore + wScore) / 2;
    if (score > bestScore) {
      bestScore = score;
      best = a;
    }
  }

  return bestScore >= 0.5 && best ? best.name : null;
}

/** All archetype names for a given position (for filter dropdowns). */
export function getArchetypesForPosition(position: string): string[] {
  return ARCHETYPES.filter((a) => a.position === position.toUpperCase()).map((a) => a.name);
}

/** All archetypes grouped by position (for <optgroup> rendering). */
export function getArchetypesByPosition(): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const a of ARCHETYPES) {
    if (!result[a.position]) result[a.position] = [];
    result[a.position].push(a.name);
  }
  return result;
}
