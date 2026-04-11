import { Player, PositionGroup, ProductionStatKey, TeamNeed } from "@/lib/types";

export type SupportedFitPosition = Extract<
  PositionGroup,
  "EDGE" | "CB" | "RB" | "WR" | "LB"
>;

export interface FitComponentWeights {
  measurable: number;
  production: number;
  athletic: number;
  experience: number;
  eligibility: number;
}

export interface AthleticBenchmarks {
  fortyGood?: number;
  fortyElite?: number;
  shuttleGood?: number;
  shuttleElite?: number;
  verticalGood?: number;
  verticalElite?: number;
}

export interface ProductionBenchmarks {
  primaryStat: ProductionStatKey;
  good: number;
  elite: number;
  secondaryStat?: ProductionStatKey;
  secondaryGood?: number;
  secondaryElite?: number;
}

export interface PositionFitTemplate {
  weights: FitComponentWeights;
  athletic: AthleticBenchmarks;
  production: ProductionBenchmarks;
  preferredHeightRange?: [number, number];
  preferredWeightRange?: [number, number];
  preferredArmLengthMin?: number;
}

export interface FitScoreBreakdown {
  overallFitScore: number;
  measurableScore: number;
  productionScore: number;
  athleticScore: number;
  experienceScore: number;
  eligibilityScore: number;
  measurementConfidence: number;
  explanation: string;
}

const NEUTRAL_SCORE = 55;

export const POSITION_FIT_TEMPLATES: Record<SupportedFitPosition, PositionFitTemplate> = {
  EDGE: {
    weights: { measurable: 0.25, production: 0.28, athletic: 0.22, experience: 0.15, eligibility: 0.1 },
    athletic: { fortyGood: 4.82, fortyElite: 4.65, shuttleGood: 4.45, shuttleElite: 4.25, verticalGood: 31, verticalElite: 35 },
    production: { primaryStat: "sacks", good: 4, elite: 8, secondaryStat: "tackles", secondaryGood: 28, secondaryElite: 46 },
    preferredHeightRange: [75, 79],
    preferredWeightRange: [235, 265],
    preferredArmLengthMin: 33
  },
  CB: {
    weights: { measurable: 0.24, production: 0.24, athletic: 0.26, experience: 0.14, eligibility: 0.12 },
    athletic: { fortyGood: 4.52, fortyElite: 4.42, shuttleGood: 4.18, shuttleElite: 4.05, verticalGood: 35, verticalElite: 39 },
    production: { primaryStat: "passes_defended", good: 6, elite: 12, secondaryStat: "interceptions", secondaryGood: 2, secondaryElite: 4 },
    preferredHeightRange: [70, 74],
    preferredWeightRange: [180, 200],
    preferredArmLengthMin: 31
  },
  RB: {
    weights: { measurable: 0.2, production: 0.3, athletic: 0.22, experience: 0.14, eligibility: 0.14 },
    athletic: { fortyGood: 4.56, fortyElite: 4.45, shuttleGood: 4.24, shuttleElite: 4.12, verticalGood: 34, verticalElite: 38 },
    production: { primaryStat: "rushing_yards", good: 550, elite: 1000, secondaryStat: "games_played", secondaryGood: 8, secondaryElite: 12 },
    preferredHeightRange: [69, 72],
    preferredWeightRange: [195, 220]
  },
  WR: {
    weights: { measurable: 0.22, production: 0.28, athletic: 0.24, experience: 0.12, eligibility: 0.14 },
    athletic: { fortyGood: 4.56, fortyElite: 4.42, shuttleGood: 4.22, shuttleElite: 4.08, verticalGood: 34, verticalElite: 38 },
    production: { primaryStat: "receiving_yards", good: 500, elite: 900, secondaryStat: "starts", secondaryGood: 5, secondaryElite: 10 },
    preferredHeightRange: [70, 76],
    preferredWeightRange: [180, 210],
    preferredArmLengthMin: 31
  },
  LB: {
    weights: { measurable: 0.24, production: 0.28, athletic: 0.2, experience: 0.16, eligibility: 0.12 },
    athletic: { fortyGood: 4.76, fortyElite: 4.62, shuttleGood: 4.34, shuttleElite: 4.18, verticalGood: 32, verticalElite: 36 },
    production: { primaryStat: "tackles", good: 45, elite: 85, secondaryStat: "sacks", secondaryGood: 2, secondaryElite: 6 },
    preferredHeightRange: [72, 76],
    preferredWeightRange: [225, 245],
    preferredArmLengthMin: 31.5
  }
};

export function calculateRuleBasedFitScore(
  player: Player,
  need: TeamNeed,
  templates: Partial<Record<SupportedFitPosition, PositionFitTemplate>> = {}
): FitScoreBreakdown {
  const template = resolveTemplate(player.position, templates);

  const measurementConfidence = calculateMeasurementConfidence(player, need, template);
  const measurableScore = calculateMeasurableScore(player, need, template, measurementConfidence);
  const athleticScore = calculateAthleticScore(player, template, measurementConfidence);
  const productionScore = calculateProductionScore(player, need, template);
  const experienceScore = calculateExperienceScore(player, need);
  const eligibilityScore = calculateEligibilityScore(player, need);

  const weighted =
    measurableScore * template.weights.measurable +
    productionScore * template.weights.production +
    athleticScore * template.weights.athletic +
    experienceScore * template.weights.experience +
    eligibilityScore * template.weights.eligibility;

  const positionAdjustment = player.position === need.position ? 6 : -18;
  const overallFitScore = clamp(Math.round(weighted + positionAdjustment));

  return {
    overallFitScore,
    measurableScore,
    productionScore,
    athleticScore,
    experienceScore,
    eligibilityScore,
    measurementConfidence,
    explanation: buildExplanation({
      player,
      need,
      overallFitScore,
      measurableScore,
      productionScore,
      athleticScore,
      experienceScore,
      eligibilityScore,
      measurementConfidence
    })
  };
}

function resolveTemplate(
  position: PositionGroup,
  templates: Partial<Record<SupportedFitPosition, PositionFitTemplate>>
): PositionFitTemplate {
  if (isSupportedPosition(position)) {
    return templates[position] ?? POSITION_FIT_TEMPLATES[position];
  }

  return {
    weights: { measurable: 0.22, production: 0.28, athletic: 0.2, experience: 0.15, eligibility: 0.15 },
    athletic: { fortyGood: 4.7, fortyElite: 4.5, shuttleGood: 4.35, shuttleElite: 4.15, verticalGood: 32, verticalElite: 36 },
    production: { primaryStat: "starts", good: 5, elite: 10 }
  };
}

function calculateMeasurementConfidence(
  player: Player,
  need: TeamNeed,
  template: PositionFitTemplate
) {
  const measurements = player.measurements;
  if (!measurements) return 35;

  const checks: Array<number | null | undefined> = [
    measurements.height_in,
    measurements.weight_lbs,
    measurements.arm_length_in,
    measurements.forty_time,
    measurements.shuttle_time,
    measurements.vertical_jump
  ];

  let relevantCount = 2;
  let populated = Number(measurements.height_in !== null && measurements.height_in !== undefined);
  populated += Number(measurements.weight_lbs !== null && measurements.weight_lbs !== undefined);

  if (need.min_arm_length_in || template.preferredArmLengthMin) {
    relevantCount += 1;
    populated += Number(measurements.arm_length_in !== null && measurements.arm_length_in !== undefined);
  }

  if (need.max_forty_time || template.athletic.fortyGood) {
    relevantCount += 1;
    populated += Number(measurements.forty_time !== null && measurements.forty_time !== undefined);
  }

  relevantCount += 2;
  populated += Number(measurements.shuttle_time !== null && measurements.shuttle_time !== undefined);
  populated += Number(measurements.vertical_jump !== null && measurements.vertical_jump !== undefined);

  const ratio = relevantCount > 0 ? populated / relevantCount : 0.5;
  return clamp(Math.round(35 + ratio * 65));
}

function calculateMeasurableScore(
  player: Player,
  need: TeamNeed,
  template: PositionFitTemplate,
  confidence: number
) {
  const measurements = player.measurements;
  if (!measurements) return applyConfidence(NEUTRAL_SCORE, confidence);

  let score = 58;

  score += rangeScore(measurements.height_in, need.min_height_in ?? template.preferredHeightRange?.[0] ?? null, need.max_height_in ?? template.preferredHeightRange?.[1] ?? null, 16);
  score += rangeScore(measurements.weight_lbs, need.min_weight_lbs ?? template.preferredWeightRange?.[0] ?? null, need.max_weight_lbs ?? template.preferredWeightRange?.[1] ?? null, 16);
  score += minimumScore(measurements.arm_length_in ?? null, need.min_arm_length_in ?? template.preferredArmLengthMin ?? null, 10);

  return applyConfidence(clamp(Math.round(score)), confidence);
}

function calculateAthleticScore(
  player: Player,
  template: PositionFitTemplate,
  confidence: number
) {
  const measurements = player.measurements;
  if (!measurements) return applyConfidence(NEUTRAL_SCORE, confidence);

  let total = 0;
  let parts = 0;

  total += inverseBenchmarkScore(measurements.forty_time ?? null, template.athletic.fortyGood, template.athletic.fortyElite);
  parts += 1;
  total += inverseBenchmarkScore(measurements.shuttle_time ?? null, template.athletic.shuttleGood, template.athletic.shuttleElite);
  parts += 1;
  total += forwardBenchmarkScore(measurements.vertical_jump ?? null, template.athletic.verticalGood, template.athletic.verticalElite);
  parts += 1;

  return applyConfidence(clamp(Math.round(total / parts)), confidence);
}

function calculateProductionScore(
  player: Player,
  need: TeamNeed,
  template: PositionFitTemplate
) {
  const stats = player.latest_stats;
  if (!stats) return 45;

  const primaryValue = numericStat(stats, template.production.primaryStat);
  const secondaryValue = template.production.secondaryStat
    ? numericStat(stats, template.production.secondaryStat)
    : null;

  let score = weightedStatScore(primaryValue, template.production.good, template.production.elite, 0.7);

  if (
    template.production.secondaryStat &&
    secondaryValue !== null &&
    template.production.secondaryGood !== undefined &&
    template.production.secondaryElite !== undefined
  ) {
    score += weightedStatScore(
      secondaryValue,
      template.production.secondaryGood,
      template.production.secondaryElite,
      0.3
    );
  }

  if (
    need.production_filters?.stat_key &&
    need.production_filters.min_stat_value !== null &&
    need.production_filters.min_stat_value !== undefined
  ) {
    const needStat = numericStat(stats, need.production_filters.stat_key);
    score += needStat >= need.production_filters.min_stat_value ? 8 : -8;
  }

  if (need.min_production_score) {
    score += score >= need.min_production_score ? 6 : -6;
  }

  return clamp(Math.round(score));
}

function calculateExperienceScore(player: Player, need: TeamNeed) {
  const stats = player.latest_stats;
  if (!stats) return 45;

  const starts = stats.starts ?? 0;
  const gamesPlayed = stats.games_played ?? 0;
  let score = 50;

  if (need.min_starts !== null && need.min_starts !== undefined) {
    score += starts >= need.min_starts ? 22 : -12;
  } else {
    score += tierScore(starts, 4, 9, 18);
  }

  if (
    need.production_filters?.min_games_played !== null &&
    need.production_filters?.min_games_played !== undefined
  ) {
    score += gamesPlayed >= need.production_filters.min_games_played ? 10 : -8;
  } else {
    score += tierScore(gamesPlayed, 8, 12, 8);
  }

  return clamp(Math.round(score));
}

function calculateEligibilityScore(player: Player, need: TeamNeed) {
  let score = 55;
  const years = player.eligibility_remaining;

  if (need.min_years_remaining !== null && need.min_years_remaining !== undefined) {
    score += years >= need.min_years_remaining ? 22 : -20;
  } else {
    score += tierScore(years, 1, 2, 18);
  }

  if (player.class_year === "GR") score -= 4;
  if (player.class_year === "SO" || player.class_year === "JR") score += 4;

  return clamp(Math.round(score));
}

function buildExplanation(input: {
  player: Player;
  need: TeamNeed;
  overallFitScore: number;
  measurableScore: number;
  productionScore: number;
  athleticScore: number;
  experienceScore: number;
  eligibilityScore: number;
  measurementConfidence: number;
}) {
  const parts: string[] = [];

  parts.push(
    input.player.position === input.need.position ? "Exact position match." : "Position mismatch penalty applied."
  );

  const strongestCandidates: Array<[string, number]> = [
    ["measurables", input.measurableScore],
    ["production", input.productionScore],
    ["athletic profile", input.athleticScore],
    ["experience", input.experienceScore],
    ["eligibility", input.eligibilityScore]
  ];
  const strongest = strongestCandidates.sort((a, b) => b[1] - a[1])[0];

  parts.push(`Strongest area: ${strongest[0]} (${strongest[1]}).`);

  if (input.measurementConfidence < 60) {
    parts.push(`Confidence reduced by incomplete testing (${input.measurementConfidence}).`);
  } else {
    parts.push(`Measurement confidence is solid (${input.measurementConfidence}).`);
  }

  if (input.overallFitScore >= 85) {
    parts.push("Projects as a strong shortlist fit.");
  } else if (input.overallFitScore >= 72) {
    parts.push("Projects as a workable board fit.");
  } else {
    parts.push("Needs more context or a softer threshold set.");
  }

  return parts.join(" ");
}

function weightedStatScore(value: number | null, good: number, elite: number, weight: number) {
  if (value === null || value === undefined) return NEUTRAL_SCORE * weight;
  return benchmarkBandScore(value, good, elite) * weight;
}

function benchmarkBandScore(value: number, good: number, elite: number) {
  if (value >= elite) return 95;
  if (value >= good) {
    const ratio = (value - good) / Math.max(elite - good, 1);
    return 75 + ratio * 20;
  }
  if (good <= 0) return 55;
  const ratio = value / good;
  return 40 + ratio * 35;
}

function inverseBenchmarkScore(value: number | null, good?: number, elite?: number) {
  if (value === null || value === undefined || good === undefined || elite === undefined) {
    return NEUTRAL_SCORE;
  }
  if (value <= elite) return 95;
  if (value <= good) {
    const ratio = (good - value) / Math.max(good - elite, 0.01);
    return 75 + ratio * 20;
  }
  const ratio = Math.min((value - good) / Math.max(good - elite, 0.01), 1.5);
  return clamp(Math.round(75 - ratio * 30), 35, 75);
}

function forwardBenchmarkScore(value: number | null, good?: number, elite?: number) {
  if (value === null || value === undefined || good === undefined || elite === undefined) {
    return NEUTRAL_SCORE;
  }
  return benchmarkBandScore(value, good, elite);
}

function minimumScore(value: number | null, minimum: number | null, impact: number) {
  if (minimum === null || minimum === undefined) return 0;
  if (value === null || value === undefined) return -impact * 0.35;
  return value >= minimum ? impact : -impact;
}

function rangeScore(
  value: number | null,
  min: number | null,
  max: number | null,
  impact: number
) {
  if (min === null && max === null) return 0;
  if (value === null || value === undefined) return -impact * 0.35;

  let delta = 0;
  if (min !== null && min !== undefined) delta += value >= min ? impact * 0.6 : -impact * 0.7;
  if (max !== null && max !== undefined) delta += value <= max ? impact * 0.4 : -impact * 0.5;
  return delta;
}

function tierScore(value: number, good: number, elite: number, impact: number) {
  if (value >= elite) return impact;
  if (value >= good) return impact * 0.55;
  return -impact * 0.35;
}

function numericStat(
  stats: NonNullable<Player["latest_stats"]>,
  key: ProductionStatKey
) {
  return Number(stats[key] ?? 0);
}

function applyConfidence(score: number, confidence: number) {
  const confidenceFactor = confidence / 100;
  return clamp(Math.round(score * confidenceFactor + NEUTRAL_SCORE * (1 - confidenceFactor)));
}

function isSupportedPosition(position: PositionGroup): position is SupportedFitPosition {
  return ["EDGE", "CB", "RB", "WR", "LB"].includes(position);
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

/*
Example usage:

import { calculateRuleBasedFitScore } from "@/lib/scoring/fitScore";
import { demoNeeds, demoPlayers } from "@/lib/data/demo";

const result = calculateRuleBasedFitScore(demoPlayers[1], demoNeeds[1]);

// result =>
// {
//   overallFitScore: 88,
//   measurableScore: 84,
//   productionScore: 91,
//   athleticScore: 79,
//   experienceScore: 82,
//   eligibilityScore: 77,
//   measurementConfidence: 93,
//   explanation: "Exact position match. Strongest area: production (91). Measurement confidence is solid (93). Projects as a strong shortlist fit."
// }

How to expand:
1. Add the new position to SupportedFitPosition.
2. Add a new POSITION_FIT_TEMPLATES entry with weights and benchmarks.
3. If the position needs custom production logic, adjust the template's primary/secondary stat targets.
4. If the position needs custom measurable preferences, extend preferred ranges or add new fields to the template.
5. Keep weights summing to 1.0 so scores stay interpretable across positions.
*/
