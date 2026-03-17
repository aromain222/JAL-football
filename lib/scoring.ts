import { Player, PlayerFitResult, TeamNeed } from "@/lib/types";

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

export function calculateProductionScore(player: Player) {
  const stats = player.latest_stats;
  if (!stats) return 50;

  switch (player.position) {
    case "WR":
    case "TE":
      return clamp(
        (stats.receiving_yards ?? 0) / 12 +
          (stats.total_touchdowns ?? 0) * 4 +
          (stats.starts ?? 0) * 2
      );
    case "EDGE":
    case "DL":
    case "LB":
      return clamp(
        (stats.tackles ?? 0) * 1.2 +
          (stats.sacks ?? 0) * 8 +
          (stats.passes_defended ?? 0) * 2
      );
    case "CB":
    case "S":
      return clamp(
        (stats.tackles ?? 0) * 1.1 +
          (stats.interceptions ?? 0) * 14 +
          (stats.passes_defended ?? 0) * 5
      );
    default:
      return clamp(
        (stats.starts ?? 0) * 4 +
          (stats.offensive_snaps ?? 0) / 12 +
          (stats.games_played ?? 0) * 2
      );
  }
}

export function calculateMeasurementScore(player: Player, need: TeamNeed) {
  const measurements = player.measurements;
  if (!measurements) return 55;

  let score = 60;

  if (need.min_height_in && measurements.height_in) {
    score += measurements.height_in >= need.min_height_in ? 15 : -12;
  }

  if (need.max_height_in && measurements.height_in) {
    score += measurements.height_in <= need.max_height_in ? 6 : -8;
  }

  if (need.min_weight_lbs && measurements.weight_lbs) {
    score += measurements.weight_lbs >= need.min_weight_lbs ? 15 : -10;
  }

  if (need.max_weight_lbs && measurements.weight_lbs) {
    score += measurements.weight_lbs <= need.max_weight_lbs ? 6 : -8;
  }

  if (need.min_arm_length_in && measurements.arm_length_in) {
    score += measurements.arm_length_in >= need.min_arm_length_in ? 10 : -8;
  }

  if (need.max_forty_time && measurements.forty_time) {
    score += measurements.forty_time <= need.max_forty_time ? 10 : -10;
  }

  if (player.position === "WR" || player.position === "CB") {
    score += measurements.forty_time && measurements.forty_time <= 4.5 ? 10 : 0;
  }

  if (player.position === "EDGE" || player.position === "OL") {
    score += measurements.wing_span_in && measurements.wing_span_in >= 80 ? 10 : 0;
  }

  return clamp(score);
}

export function calculateFit(player: Player, need: TeamNeed): PlayerFitResult {
  const productionScore = calculateProductionScore(player);
  const measurementScore = calculateMeasurementScore(player, need);
  const productionFilters = need.production_filters;
  const starts = player.latest_stats?.starts ?? 0;
  const gamesPlayed = player.latest_stats?.games_played ?? 0;
  const featuredStatValue =
    productionFilters?.stat_key && player.latest_stats
      ? Number(player.latest_stats[productionFilters.stat_key] ?? 0)
      : null;

  let fitScore = productionScore * 0.55 + measurementScore * 0.35;
  fitScore += player.position === need.position ? 8 : -20;
  fitScore += need.min_starts && starts >= need.min_starts ? 8 : 0;
  fitScore +=
    need.min_years_remaining && player.eligibility_remaining >= need.min_years_remaining ? 6 : 0;
  fitScore +=
    productionFilters?.min_games_played && gamesPlayed >= productionFilters.min_games_played
      ? 4
      : 0;
  fitScore +=
    productionFilters?.min_stat_value !== null &&
    productionFilters?.min_stat_value !== undefined &&
    featuredStatValue !== null &&
    featuredStatValue >= productionFilters.min_stat_value
      ? 8
      : 0;
  fitScore += player.eligibility_remaining >= 2 ? 4 : 0;

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
      : "Production below target"
  ];

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
    fitScore >= 85
      ? "High-priority board fit with live measurables and production."
      : fitScore >= 72
        ? "Viable board fit with enough alignment to advance."
        : "Borderline profile that needs more context or film.";

  return {
    player,
    fitScore: clamp(Math.round(fitScore)),
    productionScore: clamp(Math.round(productionScore)),
    measurementScore: clamp(Math.round(measurementScore)),
    matchReasons,
    fitSummary
  };
}
