import { z } from "zod";

const positionEnum = z.enum([
  "QB",
  "RB",
  "WR",
  "TE",
  "OL",
  "EDGE",
  "DL",
  "LB",
  "CB",
  "S",
  "ST"
]);

const emptyToNullNumber = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) return null;
  if (typeof value === "string") return Number(value);
  return value;
}, z.number().finite().nullable());

const productionFiltersSchema = z.object({
  min_games_played: emptyToNullNumber.refine(
    (value) => value === null || (Number.isInteger(value) && value >= 0 && value <= 20),
    "Min games must be an integer between 0 and 20"
  ),
  min_starts: emptyToNullNumber.refine(
    (value) => value === null || (Number.isInteger(value) && value >= 0 && value <= 20),
    "Min starts must be an integer between 0 and 20"
  ),
  stat_key: z
    .enum([
      "starts",
      "games_played",
      "receiving_yards",
      "rushing_yards",
      "tackles",
      "sacks",
      "interceptions",
      "passes_defended",
      "offensive_snaps",
      "defensive_snaps"
    ])
    .nullable(),
  min_stat_value: emptyToNullNumber.refine(
    (value) => value === null || value >= 0,
    "Featured stat minimum must be non-negative"
  )
}).superRefine((value, ctx) => {
  if ((value.stat_key && value.min_stat_value === null) || (!value.stat_key && value.min_stat_value !== null)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Featured stat and minimum must be set together",
      path: ["stat_key"]
    });
  }
});

export const needSchema = z.object({
  title: z.string().min(3).max(80),
  position: positionEnum,
  priority: z.enum(["critical", "high", "medium"]),
  target_count: z.coerce.number().int().min(1).max(15),
  class_focus: z.string().max(40).optional().or(z.literal("")),
  min_height_in: emptyToNullNumber.refine(
    (value) => value === null || (Number.isInteger(value) && value >= 60 && value <= 90),
    "Min height must be an integer between 60 and 90"
  ),
  max_height_in: emptyToNullNumber.refine(
    (value) => value === null || (Number.isInteger(value) && value >= 60 && value <= 90),
    "Max height must be an integer between 60 and 90"
  ),
  min_weight_lbs: emptyToNullNumber.refine(
    (value) => value === null || (Number.isInteger(value) && value >= 150 && value <= 420),
    "Min weight must be an integer between 150 and 420"
  ),
  max_weight_lbs: emptyToNullNumber.refine(
    (value) => value === null || (Number.isInteger(value) && value >= 150 && value <= 420),
    "Max weight must be an integer between 150 and 420"
  ),
  min_arm_length_in: emptyToNullNumber.refine(
    (value) => value === null || (value >= 28 && value <= 40),
    "Arm length must be between 28 and 40 inches"
  ),
  max_forty_time: emptyToNullNumber.refine(
    (value) => value === null || (value >= 4 && value <= 6),
    "Forty time must be between 4.00 and 6.00"
  ),
  min_years_remaining: emptyToNullNumber.refine(
    (value) => value === null || (Number.isInteger(value) && value >= 0 && value <= 6),
    "Years remaining must be between 0 and 6"
  ),
  scheme: z.string().max(60).optional().or(z.literal("")),
  priority_traits: z.array(z.string().trim().min(1).max(24)).max(8),
  production_filters: productionFiltersSchema,
  min_starts: emptyToNullNumber.refine(
    (value) => value === null || (Number.isInteger(value) && value >= 0 && value <= 60),
    "Min starts must be an integer between 0 and 60"
  ),
  min_production_score: emptyToNullNumber.refine(
    (value) => value === null || (Number.isInteger(value) && value >= 0 && value <= 100),
    "Production score must be an integer between 0 and 100"
  ),
  active: z.boolean(),
  notes: z.string().max(500).optional().or(z.literal(""))
}).superRefine((value, ctx) => {
  if (
    value.min_height_in !== null &&
    value.max_height_in !== null &&
    value.min_height_in > value.max_height_in
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Height min cannot exceed height max",
      path: ["max_height_in"]
    });
  }

  if (
    value.min_weight_lbs !== null &&
    value.max_weight_lbs !== null &&
    value.min_weight_lbs > value.max_weight_lbs
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Weight min cannot exceed weight max",
      path: ["max_weight_lbs"]
    });
  }
});

export const reviewSchema = z.object({
  needId: z.string().uuid(),
  playerId: z.string().uuid(),
  decision: z.enum(["left", "right", "save", "needs_film"]),
  fitScore: z.coerce.number().min(0).max(100),
  note: z.string().max(500).optional().or(z.literal(""))
});

export const shortlistStageSchema = z.object({
  shortlistId: z.string().uuid(),
  stage: z.enum(["assistant", "coordinator", "head_coach", "final_watch"])
});
