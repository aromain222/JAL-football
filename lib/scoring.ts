import { Player, PlayerFitResult, TeamNeed } from "@/lib/types";
import { detectArchetype } from "@/lib/archetypes";

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

// PFF grades are on a 0–100 scale where ~60 is average and 80+ is elite.
// Map to a scoring scale so 60 PFF → ~50 score, 80 → ~78, 90 → ~92.
function pffGradeToScore(grade: number): number {
  return clamp(Math.round(((grade - 40) / 52) * 80 + 18));
}

// Pick the most position-relevant PFF grade from a player's PFF data.
function calculatePffScore(player: Player): number {
  const pff = player.pffStats;
  if (!pff) return 45;

  const g = (key: keyof typeof pff) => {
    const v = pff[key];
    return typeof v === "number" && v > 0 ? v : null;
  };

  let grade: number | null = null;
  switch (player.position) {
    case "QB":   grade = g("grades_pass") ?? g("grades_offense") ?? g("grades_overall"); break;
    case "WR":   grade = g("grades_pass_route") ?? g("grades_offense") ?? g("grades_overall"); break;
    case "TE":   grade = g("grades_pass_route") ?? g("grades_run_block") ?? g("grades_offense") ?? g("grades_overall"); break;
    case "RB":   grade = g("grades_run_rb") ?? g("grades_offense") ?? g("grades_overall"); break;
    case "OL":   grade = g("grades_pass_block") ?? g("grades_run_block") ?? g("grades_offense") ?? g("grades_overall"); break;
    case "EDGE": grade = g("grades_pass_rush") ?? g("grades_defense") ?? g("grades_overall"); break;
    case "DL":   grade = g("grades_pass_rush") ?? g("grades_run_defense_dl") ?? g("grades_defense") ?? g("grades_overall"); break;
    case "LB":   grade = g("grades_defense") ?? g("grades_coverage_lb") ?? g("grades_overall"); break;
    case "CB":   grade = g("grades_coverage_db") ?? g("grades_defense") ?? g("grades_overall"); break;
    case "S":    grade = g("grades_coverage_db") ?? g("grades_defense") ?? g("grades_overall"); break;
    default:     grade = g("grades_overall") ?? g("grades_offense") ?? g("grades_defense"); break;
  }

  return grade != null ? pffGradeToScore(grade) : 48;
}

export function calculateProductionScore(player: Player) {
  const stats = player.latest_stats;
  if (!stats) return 35;

  switch (player.position) {
    case "WR":
    case "TE":
      return clamp(
        (stats.receiving_yards ?? 0) / 10 +
          (stats.total_touchdowns ?? 0) * 5 +
          (stats.starts ?? 0) * 2.5
      );
    case "RB":
      return clamp(
        (stats.rushing_yards ?? 0) / 10 +
          (stats.total_touchdowns ?? 0) * 5 +
          (stats.starts ?? 0) * 2
      );
    case "QB":
      return clamp(
        (stats.starts ?? 0) * 5 +
          (stats.passing_yards ?? 0) / 30 +
          (stats.offensive_snaps ?? 0) / 15
      );
    case "EDGE":
    case "DL":
    case "LB":
      return clamp(
        (stats.tackles ?? 0) * 1.4 +
          (stats.sacks ?? 0) * 10 +
          (stats.passes_defended ?? 0) * 2.5
      );
    case "CB":
    case "S":
      return clamp(
        (stats.tackles ?? 0) * 1.2 +
          (stats.interceptions ?? 0) * 16 +
          (stats.passes_defended ?? 0) * 6
      );
    default:
      return clamp(
        (stats.starts ?? 0) * 5 +
          (stats.offensive_snaps ?? 0) / 10 +
          (stats.games_played ?? 0) * 2
      );
  }
}

// Position-typical h/w ranges used when no explicit need filter is set.
const POSITION_RANGES: Record<string, { h: [number, number]; w: [number, number] }> = {
  QB:   { h: [72, 77], w: [210, 240] },
  RB:   { h: [68, 73], w: [190, 225] },
  WR:   { h: [69, 76], w: [175, 215] },
  TE:   { h: [74, 78], w: [220, 265] },
  OL:   { h: [75, 80], w: [290, 340] },
  EDGE: { h: [74, 78], w: [240, 275] },
  DL:   { h: [73, 77], w: [270, 340] },
  LB:   { h: [72, 76], w: [220, 255] },
  CB:   { h: [69, 74], w: [170, 200] },
  S:    { h: [70, 75], w: [190, 220] },
};

function rangeScore(value: number | null | undefined, min: number, max: number, impact: number): number {
  if (value == null) return -impact * 0.25;
  if (value >= min && value <= max) return impact;
  const range = Math.max(max - min, 1);
  const dist = value < min ? min - value : value - max;
  const ratio = Math.min(dist / (range * 0.6), 1);
  return impact * (1 - ratio) - impact * ratio;
}

export function calculateMeasurementScore(player: Player, need: TeamNeed) {
  const measurements = player.measurements;
  if (!measurements) return 42;

  const posRanges = POSITION_RANGES[need.position] ?? POSITION_RANGES[player.position];
  const heightMin = need.min_height_in ?? posRanges?.h[0] ?? null;
  const heightMax = need.max_height_in ?? posRanges?.h[1] ?? null;
  const weightMin = need.min_weight_lbs ?? posRanges?.w[0] ?? null;
  const weightMax = need.max_weight_lbs ?? posRanges?.w[1] ?? null;

  let score = 52;
  if (heightMin != null && heightMax != null) score += rangeScore(measurements.height_in, heightMin, heightMax, 18);
  if (weightMin != null && weightMax != null) score += rangeScore(measurements.weight_lbs, weightMin, weightMax, 18);

  if (need.min_arm_length_in && measurements.arm_length_in) {
    score += measurements.arm_length_in >= need.min_arm_length_in ? 10 : -10;
  }
  if (need.max_forty_time && measurements.forty_time) {
    score += measurements.forty_time <= need.max_forty_time ? 12 : -12;
  }

  // Athleticism bonuses from combine data regardless of explicit need
  if ((player.position === "WR" || player.position === "CB" || player.position === "S") && measurements.forty_time) {
    score += measurements.forty_time <= 4.40 ? 12 : measurements.forty_time <= 4.52 ? 6 : 0;
  }
  if ((player.position === "EDGE" || player.position === "OL") && measurements.wing_span_in) {
    score += measurements.wing_span_in >= 82 ? 8 : measurements.wing_span_in >= 78 ? 4 : 0;
  }
  if (player.position === "RB" && measurements.forty_time) {
    score += measurements.forty_time <= 4.45 ? 10 : measurements.forty_time <= 4.55 ? 5 : 0;
  }

  return clamp(Math.round(score));
}

export function calculateFit(player: Player, need: TeamNeed): PlayerFitResult {
  const productionScore = calculateProductionScore(player);
  const measurementScore = calculateMeasurementScore(player, need);
  const pffScore = calculatePffScore(player);
  const productionFilters = need.production_filters;
  const starts = player.latest_stats?.starts ?? 0;
  const gamesPlayed = player.latest_stats?.games_played ?? 0;
  const featuredStatValue =
    productionFilters?.stat_key && player.latest_stats
      ? Number(player.latest_stats[productionFilters.stat_key] ?? 0)
      : null;

  // Weighted base: production 40%, measurements 22%, PFF grade 25%, pad 13%
  let fitScore = productionScore * 0.40 + measurementScore * 0.22 + pffScore * 0.25;

  // Position is the strongest signal — mismatch is heavily penalised
  fitScore += player.position === need.position ? 12 : -28;

  // Eligibility runway
  fitScore += player.eligibility_remaining >= 2 ? 6 : player.eligibility_remaining >= 1 ? 2 : -6;
  if (need.min_years_remaining && player.eligibility_remaining >= need.min_years_remaining) fitScore += 5;

  // Need-specific experience requirements
  if (need.min_starts && starts >= need.min_starts) fitScore += 8;
  if (productionFilters?.min_games_played && gamesPlayed >= productionFilters.min_games_played) fitScore += 5;

  // Featured stat filter
  if (
    productionFilters?.min_stat_value != null &&
    featuredStatValue !== null &&
    featuredStatValue >= productionFilters.min_stat_value
  ) fitScore += 8;

  // Archetype bonus — physical build match against what the need is targeting
  const archetype = detectArchetype(
    player.position,
    player.measurements?.height_in,
    player.measurements?.weight_lbs
  );
  if (need.priority_traits?.length && archetype && need.priority_traits.includes(archetype)) {
    fitScore += 12;
  }

  const matchReasons = [
    player.position === need.position ? "Exact position match" : "Adjacent fit only",
    starts >= (need.min_starts ?? 0) ? "Meets experience threshold" : "Below target starts",
    need.min_years_remaining
      ? player.eligibility_remaining >= need.min_years_remaining
        ? "Meets eligibility runway"
        : "Below eligibility target"
      : "Eligibility flexible",
    productionScore >= (need.min_production_score ?? 0)
      ? "Production clears need threshold"
      : "Production below target",
    pffScore >= 65 ? `PFF signals strong (${pffScore})` : pffScore >= 50 ? "PFF signals average" : player.pffStats ? "PFF signals below threshold" : "No PFF data on file"
  ];

  if (need.priority_traits?.length) {
    matchReasons.push(
      archetype && need.priority_traits.includes(archetype)
        ? `Build matches target archetype (${archetype})`
        : need.priority_traits[0]
          ? `Target archetype: ${need.priority_traits[0]}`
          : "No archetype target"
    );
  }

  if (need.max_forty_time) {
    matchReasons.push(
      player.measurements?.forty_time && player.measurements.forty_time <= need.max_forty_time
        ? "Verified speed clears ceiling"
        : "Speed threshold still open"
    );
  }

  if (productionFilters?.stat_key && productionFilters.min_stat_value !== null) {
    matchReasons.push(
      featuredStatValue !== null && featuredStatValue >= productionFilters.min_stat_value
        ? `${productionFilters.stat_key.replaceAll("_", " ")} clears target`
        : `${productionFilters.stat_key.replaceAll("_", " ")} below target`
    );
  }

  const fitSummary =
    fitScore >= 82
      ? "High-priority board fit — measurables, production, and PFF signals align."
      : fitScore >= 68
        ? "Viable board fit with enough alignment to advance to film review."
        : fitScore >= 52
          ? "Borderline profile — worth tracking but needs more context."
          : "Low alignment with current need profile.";

  return {
    player,
    fitScore: clamp(Math.round(fitScore)),
    productionScore: clamp(Math.round(productionScore)),
    measurementScore: clamp(Math.round(measurementScore)),
    matchReasons,
    fitSummary
  };
}
