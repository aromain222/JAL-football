import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { detectArchetype } from "@/lib/archetypes";
import { formatHeightInFeetInches } from "@/lib/football";
import { getPffPrimaryGrade } from "@/lib/pff/summary";
import type { Player, PlayerPffGrade, PositionGroup, ProductionStatKey } from "@/lib/types";

export type AiBoardFilters = {
  search?: string;
  position?: string;
  classYear?: string;
  yearsRemaining?: string;
  heightMin?: string;
  heightMax?: string;
  weightMin?: string;
  weightMax?: string;
  armLengthMin?: string;
  fortyMax?: string;
  school?: string;
  conference?: string;
  archetype?: string;
};

export type AiRoleKey =
  | "interior_dl"
  | "edge"
  | "slot_cb"
  | "outside_cb"
  | "box_safety"
  | "free_safety"
  | "strong_safety"
  | "slot_receiver"
  | "boundary_receiver"
  | "inline_te"
  | "move_te"
  | "backfield_rb";

export type AiTraitKey =
  | "run_support"
  | "coverage"
  | "pass_rush"
  | "pass_blocking"
  | "run_blocking"
  | "route_running"
  | "explosive"
  | "big_body"
  | "receiving"
  | "tackling"
  | "ball_skills";

export type PffCriterion = {
  column: string;
  target_value: number;
  weight: number;
  label: string;
  preference: "high" | "low";
  source?: "pff" | "production" | "alignment";
};

export type AiRoleCriterion = {
  key: AiRoleKey;
  strength: "required" | "preferred";
  label: string;
};

export type AiTraitCriterion = {
  key: AiTraitKey;
  strength: "required" | "preferred";
  label: string;
};

export type AiProductionPriority = {
  stat: string;
  min_value?: number | null;
  weight: number;
  label: string;
};

export type AiSearchFilters = {
  active_in_portal: boolean;
  min_years_remaining?: number;
  min_weight_lbs?: number;
  max_weight_lbs?: number;
  min_height_in?: number;
  max_height_in?: number;
};

export type AiSearchCriteria = {
  positions: PositionGroup[];
  football_positions: string[];
  min_years_remaining?: number;
  min_weight_lbs?: number;
  max_weight_lbs?: number;
  min_height_in?: number;
  max_height_in?: number;
  filters: AiSearchFilters;
  roles: AiRoleCriterion[];
  traits: AiTraitCriterion[];
  pff_criteria: PffCriterion[];
  production_priorities: AiProductionPriority[];
  body_type_hint?: string;
  reasoning: string;
};

export type AiPlayerSearchResult = {
  playerId: string;
  matchScore: number;
  fitScore: number;
  pffScore: number;
  productionScore: number;
  profileScore: number;
  reasonBadges: string[];
  searchExplanation: string[];
  featuredStats: Array<{ label: string; value: string }>;
  hasPffData: boolean;
};

const SYSTEM_PROMPT = `You are a college football recruiting analyst. Convert a coach's plain-English player search into structured JSON criteria for the JAL Football app.

APP POSITION GROUPS:
- QB
- RB
- WR
- TE
- OL
- EDGE
- DL
- LB
- CB
- S

IMPORTANT POSITION MAPPING:
- nose tackle / interior defensive tackle / big defensive tackle -> positions ["DL"], role "interior_dl"
- pass rushing defensive end / edge rusher -> positions ["EDGE"], role "edge"
- slot corner / nickel -> positions ["CB"], role "slot_cb"
- boundary corner / outside corner -> positions ["CB"], role "outside_cb"
- box safety -> positions ["S"], role "box_safety"
- free safety / deep safety -> positions ["S"], role "free_safety"
- strong safety -> positions ["S"], role "strong_safety"
- slot receiver -> positions ["WR"], role "slot_receiver"
- boundary receiver / outside receiver / X receiver -> positions ["WR"], role "boundary_receiver"
- inline tight end / Y tight end -> positions ["TE"], role "inline_te"
- move tight end / flex tight end -> positions ["TE"], role "move_te"
- backfield running back / receiving back -> positions ["RB"], role "backfield_rb"

TRAIT KEYS:
- run_support
- coverage
- pass_rush
- pass_blocking
- run_blocking
- route_running
- explosive
- big_body
- receiving
- tackling
- ball_skills

USE THESE REAL PFF FIELDS:
- grades_pass
- grades_offense
- grades_defense
- grades_pass_route
- grades_run_rb
- grades_pass_block
- grades_run_block
- grades_pass_block_rb
- grades_pass_rush
- grades_run_defense_dl
- grades_run_defense_lb
- grades_coverage_lb
- grades_coverage_db
- grades_tackle
- grades_tackle_db
- stats_pass_rush_snaps
- stats_targets
- stats_receptions
- stats_receiving_yards
- stats_rushing_yards
- stats_passing_yards
- stats_yards_per_route_run
- stats_elusive_rating
- stats_tackles
- stats_sacks
- stats_pass_breakups
- stats_interceptions_def
- stats_passer_rating_allowed
- snaps_interior_dl
- snaps_at_left_end
- snaps_at_right_end
- snaps_slot_cb
- snaps_outside_cb
- snaps_in_box_db
- snaps_free_safety
- snaps_strong_safety
- snaps_slot
- snaps_wide_left
- snaps_wide_right
- snaps_inline_te
- snaps_backfield

PRODUCTION PRIORITY STATS:
- games_played
- starts
- passing_yards
- passing_tds
- rushing_yards
- rushing_tds
- receptions
- receiving_yards
- receiving_tds
- tackles
- sacks
- interceptions
- passes_defended
- tackles_for_loss

RULES:
- Return only APP position groups, never DT/DE/NT/FS/SS as positions.
- football_positions should contain football-native labels like G, IOL, C, OT, LT, RT, NT, 3T, X, Slot, Boundary when the query clearly implies them.
- Use roles for alignment or deployment intent.
- Use traits for play-style intent.
- Only use min/max height or weight when the query gives an explicit measurable or a clearly hard requirement.
- For words like tall, lengthy, long, rangy, or big-framed at receiver/corner/safety/tight end/edge, set a reasonable min_height_in instead of leaving height unconstrained.
- For words like big, heavy, long, twitchy, explosive, use body_type_hint and/or traits instead of hard measurable gates.
- Explicit years remaining should be treated as a hard minimum.
- production_priorities are optional but should be included when the coach clearly asks for production, proven output, sacks, tackles, yards, etc.
- For "nose tackle" or "nose guard", use positions ["DL"], role "interior_dl", strongly consider traits "big_body" and "run_support", and set a meaningful min_weight_lbs floor unless the coach explicitly says otherwise.
- For "slot corner", use positions ["CB"], role "slot_cb"; if the coach mentions run support, add traits "run_support" and "tackling".
- For "off-ball linebacker" or "box linebacker", use positions ["LB"] and lean on traits like "run_support", "tackling", and "big_body" when the wording implies it.
- When the query asks for physicality, box play, run defense, or tackle volume, include both trait evidence and production priorities that reflect that ask.

Return ONLY valid JSON:
{
  "positions": ["QB"],
  "football_positions": ["QB"],
  "min_years_remaining": null,
  "min_weight_lbs": null,
  "max_weight_lbs": null,
  "min_height_in": null,
  "max_height_in": null,
  "filters": {
    "active_in_portal": true,
    "min_years_remaining": null,
    "min_weight_lbs": null,
    "max_weight_lbs": null,
    "min_height_in": null,
    "max_height_in": null
  },
  "roles": [{ "key": "slot_cb", "strength": "required", "label": "Slot CB role" }],
  "traits": [{ "key": "run_support", "strength": "preferred", "label": "Run support" }],
  "pff_criteria": [{ "column": "grades_tackle_db", "target_value": 60, "weight": 0.9, "label": "Tackling grade", "preference": "high", "source": "pff" }],
  "production_priorities": [{ "stat": "tackles", "min_value": 35, "weight": 0.5, "label": "Tackle production" }],
  "body_type_hint": "big-bodied",
  "reasoning": "short explanation"
}`;

const positionSchema = z.enum(["QB", "RB", "WR", "TE", "OL", "EDGE", "DL", "LB", "CB", "S"]);
const roleSchema = z.enum([
  "interior_dl",
  "edge",
  "slot_cb",
  "outside_cb",
  "box_safety",
  "free_safety",
  "strong_safety",
  "slot_receiver",
  "boundary_receiver",
  "inline_te",
  "move_te",
  "backfield_rb",
]);
const traitSchema = z.enum([
  "run_support",
  "coverage",
  "pass_rush",
  "pass_blocking",
  "run_blocking",
  "route_running",
  "explosive",
  "big_body",
  "receiving",
  "tackling",
  "ball_skills",
]);

const criteriaSchema = z.object({
  positions: z.array(positionSchema).default([]),
  football_positions: z.array(z.string().min(1)).default([]),
  min_years_remaining: z.number().nullable().optional(),
  min_weight_lbs: z.number().nullable().optional(),
  max_weight_lbs: z.number().nullable().optional(),
  min_height_in: z.number().nullable().optional(),
  max_height_in: z.number().nullable().optional(),
  filters: z
    .object({
      active_in_portal: z.boolean().default(true),
      min_years_remaining: z.number().nullable().optional(),
      min_weight_lbs: z.number().nullable().optional(),
      max_weight_lbs: z.number().nullable().optional(),
      min_height_in: z.number().nullable().optional(),
      max_height_in: z.number().nullable().optional(),
    })
    .default({ active_in_portal: true }),
  roles: z
    .array(
      z.object({
        key: roleSchema,
        strength: z.enum(["required", "preferred"]).default("preferred"),
        label: z.string().min(1),
      })
    )
    .default([]),
  traits: z
    .array(
      z.object({
        key: traitSchema,
        strength: z.enum(["required", "preferred"]).default("preferred"),
        label: z.string().min(1),
      })
    )
    .default([]),
  pff_criteria: z
    .array(
      z.object({
        column: z.string().min(1),
        target_value: z.number(),
        weight: z.number().min(0).max(1.5),
        label: z.string().min(1),
        preference: z.enum(["high", "low"]).default("high"),
        source: z.enum(["pff", "production", "alignment"]).optional(),
      })
    )
    .default([]),
  production_priorities: z
    .array(
      z.object({
        stat: z.string().min(1),
        min_value: z.number().nullable().optional(),
        weight: z.number().min(0).max(1.5),
        label: z.string().min(1),
      })
    )
    .default([]),
  body_type_hint: z.string().nullable().optional(),
  reasoning: z.string().default(""),
});

const ROLE_LABELS: Record<AiRoleKey, string> = {
  interior_dl: "Interior DL",
  edge: "Edge",
  slot_cb: "Slot CB",
  outside_cb: "Outside CB",
  box_safety: "Box Safety",
  free_safety: "Free Safety",
  strong_safety: "Strong Safety",
  slot_receiver: "Slot WR",
  boundary_receiver: "Boundary WR",
  inline_te: "Inline TE",
  move_te: "Move TE",
  backfield_rb: "Backfield RB",
};

const ROLE_SNAP_LABELS: Record<AiRoleKey, string> = {
  interior_dl: "interior DL snaps",
  edge: "edge snaps",
  slot_cb: "slot coverage reps",
  outside_cb: "outside CB reps",
  box_safety: "box reps",
  free_safety: "deep safety reps",
  strong_safety: "strong safety reps",
  slot_receiver: "slot reps",
  boundary_receiver: "boundary reps",
  inline_te: "inline TE snaps",
  move_te: "move TE reps",
  backfield_rb: "backfield reps",
};

const DEFAULT_PRODUCTION_PRIORITIES: Partial<Record<PositionGroup, AiProductionPriority[]>> = {
  QB: [
    { stat: "passing_yards", min_value: 1200, weight: 0.7, label: "Passing yards" },
    { stat: "passing_tds", min_value: 10, weight: 0.6, label: "Passing TDs" },
  ],
  RB: [
    { stat: "rushing_yards", min_value: 500, weight: 0.7, label: "Rushing yards" },
    { stat: "rushing_tds", min_value: 5, weight: 0.5, label: "Rush TDs" },
  ],
  WR: [
    { stat: "receiving_yards", min_value: 450, weight: 0.7, label: "Receiving yards" },
    { stat: "receptions", min_value: 25, weight: 0.5, label: "Receptions" },
  ],
  TE: [
    { stat: "receiving_yards", min_value: 250, weight: 0.65, label: "Receiving yards" },
    { stat: "receptions", min_value: 15, weight: 0.45, label: "Receptions" },
  ],
  OL: [
    { stat: "starts", min_value: 5, weight: 0.7, label: "Starts" },
    { stat: "games_played", min_value: 8, weight: 0.45, label: "Games" },
  ],
  EDGE: [
    { stat: "sacks", min_value: 3, weight: 0.7, label: "Sacks" },
    { stat: "tackles_for_loss", min_value: 5, weight: 0.55, label: "TFL" },
  ],
  DL: [
    { stat: "tackles_for_loss", min_value: 4, weight: 0.65, label: "TFL" },
    { stat: "sacks", min_value: 2, weight: 0.5, label: "Sacks" },
  ],
  LB: [
    { stat: "tackles", min_value: 40, weight: 0.65, label: "Tackles" },
    { stat: "sacks", min_value: 2, weight: 0.4, label: "Sacks" },
  ],
  CB: [
    { stat: "passes_defended", min_value: 5, weight: 0.65, label: "Pass breakups" },
    { stat: "interceptions", min_value: 1, weight: 0.45, label: "Interceptions" },
  ],
  S: [
    { stat: "tackles", min_value: 35, weight: 0.55, label: "Tackles" },
    { stat: "passes_defended", min_value: 3, weight: 0.5, label: "Pass breakups" },
  ],
};

const POSITION_PROJECTION_RANGES: Partial<
  Record<PositionGroup, { height?: [number, number]; weight?: [number, number]; arm?: number }>
> = {
  QB: { height: [72, 77], weight: [200, 235] },
  RB: { height: [68, 73], weight: [190, 225] },
  WR: { height: [70, 76], weight: [180, 215], arm: 31 },
  TE: { height: [74, 79], weight: [230, 260], arm: 32 },
  OL: { height: [75, 80], weight: [285, 335], arm: 33 },
  EDGE: { height: [74, 79], weight: [235, 270], arm: 33 },
  DL: { height: [73, 78], weight: [275, 335], arm: 32.5 },
  LB: { height: [72, 76], weight: [220, 250], arm: 31.5 },
  CB: { height: [70, 74], weight: [180, 205], arm: 31 },
  S: { height: [71, 75], weight: [190, 220], arm: 30.5 },
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function toNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function stripCodeFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/m, "").replace(/```\s*$/m, "").trim();
}

function uniquePush<T>(items: T[], value: T) {
  if (!items.includes(value)) items.push(value);
}

function pushFootballPosition(positions: string[], ...values: string[]) {
  for (const value of values) {
    const trimmed = value.trim();
    if (trimmed && !positions.includes(trimmed)) {
      positions.push(trimmed);
    }
  }
}

function addRoleCriterion(
  roles: AiRoleCriterion[],
  role: AiRoleKey,
  strength: "required" | "preferred",
  label: string
) {
  if (roles.some((item) => item.key === role)) return;
  roles.push({ key: role, strength, label });
}

function addTraitCriterion(
  traits: AiTraitCriterion[],
  trait: AiTraitKey,
  strength: "required" | "preferred",
  label: string
) {
  if (traits.some((item) => item.key === trait)) return;
  traits.push({ key: trait, strength, label });
}

function addProductionPriority(
  priorities: AiProductionPriority[],
  stat: string,
  minValue: number | null | undefined,
  weight: number,
  label: string
) {
  if (priorities.some((item) => item.stat === stat)) return;
  priorities.push({
    stat,
    min_value: minValue ?? undefined,
    weight,
    label,
  });
}

function addPffCriterion(
  criteria: PffCriterion[],
  column: string,
  targetValue: number,
  weight: number,
  label: string,
  preference: "high" | "low" = "high",
  source: "pff" | "production" | "alignment" = "pff"
) {
  if (criteria.some((item) => item.column === column)) return;
  criteria.push({
    column,
    target_value: targetValue,
    weight,
    label,
    preference,
    source,
  });
}

function parseYearsRemaining(query: string): number | undefined {
  const match = query.match(/(?:at least\s*)?(\d+)\s*(?:year|yr)s?(?:\s*(?:of)?\s*(?:eligibility|remaining|left))?/i);
  if (!match) return undefined;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : undefined;
}

function parseWeightBounds(query: string): { min?: number; max?: number } {
  const minMatch = query.match(/(?:at least|min(?:imum)?)\s*(\d{3})\s*(?:lb|lbs|pounds)/i);
  const maxMatch = query.match(/(?:under|below|max(?:imum)?|no more than)\s*(\d{3})\s*(?:lb|lbs|pounds)/i);
  const exactMatch = query.match(/(\d{3})\s*(?:lb|lbs|pounds)/i);

  const min = minMatch ? Number(minMatch[1]) : undefined;
  const max = maxMatch ? Number(maxMatch[1]) : undefined;

  if (!min && !max && exactMatch) {
    const exact = Number(exactMatch[1]);
    return { min: exact, max: exact };
  }

  return { min, max };
}

function parseHeightBounds(query: string): { min?: number; max?: number } {
  const feetInchesMatch = query.match(/(\d)\s*['-]\s*(\d{1,2})/);
  const inchesMatch = query.match(/(\d{2})\s*(?:in|inch|inches)/i);
  const toInches = (feet: number, inches: number) => feet * 12 + inches;

  let exact: number | undefined;
  if (feetInchesMatch) {
    exact = toInches(Number(feetInchesMatch[1]), Number(feetInchesMatch[2]));
  } else if (inchesMatch) {
    exact = Number(inchesMatch[1]);
  }

  if (!exact) return {};

  if (/(?:under|below|max(?:imum)?|no more than)/i.test(query)) {
    return { max: exact };
  }
  if (/(?:at least|min(?:imum)?|over|above)/i.test(query)) {
    return { min: exact };
  }

  return { min: exact, max: exact };
}

function inferImplicitHeightFloor(query: string, positions: PositionGroup[]): number | undefined {
  if (!/(tall|length|lengthy|long|rangy|big-framed|big framed)/i.test(query)) {
    return undefined;
  }

  const position = positions[0];
  switch (position) {
    case "WR":
      return 73;
    case "TE":
      return 76;
    case "CB":
      return 72;
    case "S":
      return 72;
    case "EDGE":
      return 75;
    case "DL":
      return 74;
    case "LB":
      return 73;
    case "OL":
      return 76;
    case "QB":
      return 74;
    case "RB":
      return 71;
    default:
      return 73;
  }
}

function inferImplicitWeightFloor(
  query: string,
  positions: PositionGroup[],
  roles: AiRoleCriterion[]
): number | undefined {
  const lower = query.toLowerCase();

  if (/(nose tackle|nose guard|0-tech|0 tech)/.test(lower)) {
    if (/(big|massive|heavy|true nose)/.test(lower)) return 300;
    return 285;
  }

  const hasInteriorDlRole = roles.some((role) => role.key === "interior_dl");
  if (hasInteriorDlRole || (positions.includes("DL") && /(interior defensive tackle|interior dl|defensive tackle)/.test(lower))) {
    if (/(big|massive|heavy)/.test(lower)) return 290;
    return 275;
  }

  return undefined;
}

function applyImplicitSizeHints(query: string, criteria: AiSearchCriteria): AiSearchCriteria {
  const implicitHeightFloor = inferImplicitHeightFloor(query, criteria.positions);
  const implicitWeightFloor = inferImplicitWeightFloor(query, criteria.positions, criteria.roles);
  const bodyTypeHint =
    criteria.body_type_hint ??
    (/(tall|length|lengthy|long|rangy|big-framed|big framed)/i.test(query) ? "tall-bodied" : undefined);

  return {
    ...criteria,
    min_weight_lbs: criteria.min_weight_lbs ?? implicitWeightFloor,
    min_height_in: criteria.min_height_in ?? implicitHeightFloor,
    filters: {
      ...criteria.filters,
      active_in_portal: true,
      min_weight_lbs: criteria.filters.min_weight_lbs ?? criteria.min_weight_lbs ?? implicitWeightFloor,
      max_weight_lbs: criteria.filters.max_weight_lbs ?? criteria.max_weight_lbs,
      min_height_in: criteria.filters.min_height_in ?? criteria.min_height_in ?? implicitHeightFloor,
      max_height_in: criteria.filters.max_height_in ?? criteria.max_height_in,
      min_years_remaining: criteria.filters.min_years_remaining ?? criteria.min_years_remaining,
    },
    body_type_hint: bodyTypeHint,
  };
}

function buildHeuristicCriteria(query: string): AiSearchCriteria {
  const text = query.trim();
  const lower = text.toLowerCase();

  const positions: PositionGroup[] = [];
  const footballPositions: string[] = [];
  const roles: AiRoleCriterion[] = [];
  const traits: AiTraitCriterion[] = [];
  const pffCriteria: PffCriterion[] = [];
  const productionPriorities: AiProductionPriority[] = [];
  const reasoningBits: string[] = [];

  const yearsRemaining = parseYearsRemaining(lower);
  const weightBounds = parseWeightBounds(lower);
  const heightBounds = parseHeightBounds(lower);

  if (/(nose tackle|nose guard|interior defensive tackle|defensive tackle|interior dl)/.test(lower)) {
    uniquePush(positions, "DL");
    pushFootballPosition(footballPositions, "NT", "IDL");
    addRoleCriterion(roles, "interior_dl", "required", "Interior DL role");
    addTraitCriterion(traits, "big_body", "preferred", "Big body");
    addTraitCriterion(traits, "run_support", "preferred", "Run support");
    addPffCriterion(pffCriteria, "snaps_interior_dl", 60, 1.1, "Interior DL usage", "high", "alignment");
    addPffCriterion(pffCriteria, "grades_run_defense_dl", 62, 0.9, "Run defense", "high", "pff");
    addProductionPriority(productionPriorities, "tackles_for_loss", 2, 0.5, "TFL");
    reasoningBits.push("interior DL usage");
  }

  if (/(edge|edge rusher|pass rusher|pass rushing|defensive end|speed rusher)/.test(lower)) {
    uniquePush(positions, "EDGE");
    pushFootballPosition(footballPositions, "EDGE");
    addRoleCriterion(roles, "edge", "required", "Edge role");
    addTraitCriterion(traits, "pass_rush", "preferred", "Pass rush");
    addPffCriterion(pffCriteria, "grades_pass_rush", 65, 0.95, "Pass rush", "high", "pff");
    addProductionPriority(productionPriorities, "sacks", 3, 0.7, "Sacks");
    addProductionPriority(productionPriorities, "tackles_for_loss", 4, 0.55, "TFL");
    reasoningBits.push("edge pass-rush profile");
  }

  if (/(slot corner|nickel|slot cb)/.test(lower)) {
    uniquePush(positions, "CB");
    pushFootballPosition(footballPositions, "NB", "Slot");
    addRoleCriterion(roles, "slot_cb", "required", "Slot CB role");
    addPffCriterion(pffCriteria, "snaps_slot_cb", 40, 1.1, "Slot usage", "high", "alignment");
    addPffCriterion(pffCriteria, "grades_coverage_db", 62, 0.85, "Coverage", "high", "pff");
    reasoningBits.push("slot coverage reps");
  }

  if (/(boundary corner|outside corner|outside cb|boundary cb)/.test(lower)) {
    uniquePush(positions, "CB");
    pushFootballPosition(footballPositions, "Boundary", "Outside");
    addRoleCriterion(roles, "outside_cb", "required", "Outside CB role");
    addPffCriterion(pffCriteria, "snaps_outside_cb", 60, 1.05, "Outside CB usage", "high", "alignment");
    addPffCriterion(pffCriteria, "grades_coverage_db", 62, 0.85, "Coverage", "high", "pff");
    reasoningBits.push("outside corner usage");
  }

  if (/(box safety)/.test(lower)) {
    uniquePush(positions, "S");
    pushFootballPosition(footballPositions, "Box");
    addRoleCriterion(roles, "box_safety", "required", "Box safety role");
    addTraitCriterion(traits, "run_support", "preferred", "Run support");
    addTraitCriterion(traits, "tackling", "preferred", "Tackling");
    addPffCriterion(pffCriteria, "snaps_in_box_db", 35, 1.0, "Box usage", "high", "alignment");
    reasoningBits.push("box safety deployment");
  }

  if (/(free safety|deep safety)/.test(lower)) {
    uniquePush(positions, "S");
    pushFootballPosition(footballPositions, "FS", "Deep");
    addRoleCriterion(roles, "free_safety", "required", "Free safety role");
    addTraitCriterion(traits, "coverage", "preferred", "Coverage");
    addPffCriterion(pffCriteria, "snaps_free_safety", 35, 1.0, "Free safety usage", "high", "alignment");
    reasoningBits.push("free safety deployment");
  }

  if (/(strong safety)/.test(lower)) {
    uniquePush(positions, "S");
    pushFootballPosition(footballPositions, "SS");
    addRoleCriterion(roles, "strong_safety", "required", "Strong safety role");
    addTraitCriterion(traits, "run_support", "preferred", "Run support");
    addPffCriterion(pffCriteria, "snaps_strong_safety", 35, 1.0, "Strong safety usage", "high", "alignment");
    reasoningBits.push("strong safety deployment");
  }

  if (/(slot receiver|slot wr|slot wide receiver)/.test(lower)) {
    uniquePush(positions, "WR");
    pushFootballPosition(footballPositions, "Slot");
    addRoleCriterion(roles, "slot_receiver", "required", "Slot WR role");
    addPffCriterion(pffCriteria, "snaps_slot", 40, 1.0, "Slot usage", "high", "alignment");
    reasoningBits.push("slot receiving usage");
  }

  if (/(boundary receiver|outside receiver|x receiver|x wr|tall x wr)/.test(lower)) {
    uniquePush(positions, "WR");
    pushFootballPosition(footballPositions, "X", "Boundary");
    addRoleCriterion(roles, "boundary_receiver", "required", "Boundary WR role");
    addPffCriterion(pffCriteria, "snaps_wide_left", 35, 0.8, "Boundary reps", "high", "alignment");
    addPffCriterion(pffCriteria, "snaps_wide_right", 35, 0.8, "Boundary reps", "high", "alignment");
    reasoningBits.push("boundary receiving usage");
  }

  if (/(inline tight end|inline te|y tight end)/.test(lower)) {
    uniquePush(positions, "TE");
    pushFootballPosition(footballPositions, "Y", "Inline");
    addRoleCriterion(roles, "inline_te", "required", "Inline TE role");
    addPffCriterion(pffCriteria, "snaps_inline_te", 35, 1.0, "Inline TE usage", "high", "alignment");
    reasoningBits.push("inline TE usage");
  }

  if (/(move tight end|flex tight end|move te)/.test(lower)) {
    uniquePush(positions, "TE");
    pushFootballPosition(footballPositions, "Move");
    addRoleCriterion(roles, "move_te", "required", "Move TE role");
    reasoningBits.push("move TE alignment");
  }

  if (/(receiving back|backfield back|backfield rb)/.test(lower)) {
    uniquePush(positions, "RB");
    pushFootballPosition(footballPositions, "Backfield");
    addRoleCriterion(roles, "backfield_rb", "required", "Backfield RB role");
    addTraitCriterion(traits, "receiving", "preferred", "Receiving");
    reasoningBits.push("backfield receiving profile");
  }

  if (/(guard|left guard|right guard|\biol\b|interior offensive line)/.test(lower)) {
    uniquePush(positions, "OL");
    pushFootballPosition(footballPositions, "G", "IOL");
    reasoningBits.push("guard/iol profile");
  }

  if (/(center|\bc\b)/.test(lower)) {
    uniquePush(positions, "OL");
    pushFootballPosition(footballPositions, "C", "IOL");
    reasoningBits.push("center profile");
  }

  if (/(offensive tackle|left tackle|right tackle|\bot\b)/.test(lower)) {
    uniquePush(positions, "OL");
    pushFootballPosition(footballPositions, "OT");
    reasoningBits.push("tackle profile");
  }

  if (/(off-ball linebacker|off ball linebacker|linebacker|box linebacker)/.test(lower)) {
    uniquePush(positions, "LB");
    pushFootballPosition(footballPositions, "LB");
    reasoningBits.push("linebacker profile");
  }

  if (/(corner|cb)/.test(lower) && positions.length === 0) {
    uniquePush(positions, "CB");
    pushFootballPosition(footballPositions, "CB");
  }
  if (/(safety)/.test(lower) && positions.length === 0) {
    uniquePush(positions, "S");
    pushFootballPosition(footballPositions, "S");
  }
  if (/(wide receiver|receiver| wr\b)/.test(lower) && positions.length === 0) {
    uniquePush(positions, "WR");
    pushFootballPosition(footballPositions, "WR");
  }
  if (/(running back| rb\b)/.test(lower) && positions.length === 0) {
    uniquePush(positions, "RB");
    pushFootballPosition(footballPositions, "RB");
  }
  if (/(tight end| te\b)/.test(lower) && positions.length === 0) {
    uniquePush(positions, "TE");
    pushFootballPosition(footballPositions, "TE");
  }
  if (/(quarterback| qb\b)/.test(lower) && positions.length === 0) {
    uniquePush(positions, "QB");
    pushFootballPosition(footballPositions, "QB");
  }
  if (/(offensive line|ol|tackle|guard|center)/.test(lower) && positions.length === 0) {
    uniquePush(positions, "OL");
    pushFootballPosition(footballPositions, "OL");
  }

  if (/(pass[-\s]?pro|pass protection|pass protector|pass blocking|pass-blocking)/.test(lower)) {
    addTraitCriterion(traits, "pass_blocking", "preferred", "Pass blocking");
    addPffCriterion(pffCriteria, "grades_pass_block", 68, 1.0, "Pass block grade", "high", "pff");
    addPffCriterion(pffCriteria, "stats_pressures_allowed", 8, 0.95, "Pressures allowed", "low", "pff");
    addPffCriterion(pffCriteria, "stats_sacks_allowed", 2, 0.85, "Sacks allowed", "low", "pff");
    addPffCriterion(pffCriteria, "stats_pass_block_snaps", 120, 0.7, "Pass-pro usage", "high", "alignment");
    reasoningBits.push("pass protection weighting");
  }

  if (/(run blocking|run-blocking|mauler|road grader|move people in the run game)/.test(lower)) {
    addTraitCriterion(traits, "run_blocking", "preferred", "Run blocking");
    addPffCriterion(pffCriteria, "grades_run_block", 68, 0.95, "Run block grade", "high", "pff");
    reasoningBits.push("run-block weighting");
  }

  if (/(run support|good in the run|good against the run|run defense|stops the run)/.test(lower)) {
    addTraitCriterion(traits, "run_support", "preferred", "Run support");
    addPffCriterion(pffCriteria, "grades_run_defense_lb", 62, 0.75, "Run defense", "high", "pff");
    addPffCriterion(pffCriteria, "grades_run_defense_dl", 62, 0.75, "Run defense", "high", "pff");
    addPffCriterion(pffCriteria, "grades_tackle_db", 64, 0.7, "Tackle grade", "high", "pff");
    addPffCriterion(pffCriteria, "grades_tackle", 64, 0.7, "Tackle grade", "high", "pff");
    addProductionPriority(productionPriorities, "tackles", 40, 0.55, "Tackles");
    reasoningBits.push("run-defense evidence");
  }

  if (/(coverage|cover|man cover|zone cover)/.test(lower)) {
    addTraitCriterion(traits, "coverage", "preferred", "Coverage");
    addPffCriterion(pffCriteria, "grades_coverage_db", 62, 0.75, "Coverage", "high", "pff");
    addPffCriterion(pffCriteria, "grades_coverage_lb", 62, 0.75, "Coverage", "high", "pff");
    addPffCriterion(pffCriteria, "stats_targets_allowed", 25, 0.65, "Targets allowed", "low", "pff");
    addPffCriterion(pffCriteria, "stats_yards_allowed", 275, 0.65, "Yards allowed", "low", "pff");
    reasoningBits.push("coverage evidence");
  }

  if (/(physical|big|heavy|long|big-bodied|big bodied)/.test(lower)) {
    addTraitCriterion(traits, "big_body", "preferred", "Physical build");
  }

  if (/(explosive|burst|speed|fast|juice)/.test(lower)) {
    addTraitCriterion(traits, "explosive", "preferred", "Explosive traits");
  }

  if (/(tackle|tackles|tackling)/.test(lower)) {
    addTraitCriterion(traits, "tackling", "preferred", "Tackling");
    addProductionPriority(productionPriorities, "tackles", 35, 0.6, "Tackles");
  }

  if (/(pass rush|pass-rush|rush the passer|sacks?)/.test(lower)) {
    addTraitCriterion(traits, "pass_rush", "preferred", "Pass rush");
    addProductionPriority(productionPriorities, "sacks", 3, 0.65, "Sacks");
  }

  if (/(route|route running|separator)/.test(lower)) {
    addTraitCriterion(traits, "route_running", "preferred", "Route running");
  }

  if (/(ball skills|interceptions|pbu|pass breakups)/.test(lower)) {
    addTraitCriterion(traits, "ball_skills", "preferred", "Ball skills");
    addProductionPriority(productionPriorities, "interceptions", 1, 0.45, "Interceptions");
    addProductionPriority(productionPriorities, "passes_defended", 4, 0.45, "Pass breakups");
  }

  if (/(receiving|hands|catch radius|yards)/.test(lower) && positions.includes("WR")) {
    addTraitCriterion(traits, "receiving", "preferred", "Receiving");
    addProductionPriority(productionPriorities, "receiving_yards", 450, 0.65, "Receiving yards");
    addProductionPriority(productionPriorities, "receptions", 25, 0.45, "Receptions");
  }

  if (/(receiving|hands|catch radius)/.test(lower) && positions.includes("TE")) {
    addTraitCriterion(traits, "receiving", "preferred", "Receiving");
    addProductionPriority(productionPriorities, "receiving_yards", 250, 0.6, "Receiving yards");
  }

  if (/(rushing|runner|yards after contact)/.test(lower) && positions.includes("RB")) {
    addProductionPriority(productionPriorities, "rushing_yards", 500, 0.65, "Rushing yards");
    addProductionPriority(productionPriorities, "rushing_tds", 5, 0.45, "Rush TDs");
  }

  const defaultPositionPriorities = positions.flatMap((position) => DEFAULT_PRODUCTION_PRIORITIES[position] ?? []);
  for (const priority of defaultPositionPriorities) {
    if (productionPriorities.length >= 2) break;
    addProductionPriority(productionPriorities, priority.stat, priority.min_value, priority.weight, priority.label);
  }

  const reasoning =
    reasoningBits.length > 0
      ? `Parsed from the query using built-in football heuristics: ${reasoningBits.join(", ")}.`
      : "Parsed from the query using built-in football heuristics.";

  const criteria: AiSearchCriteria = {
    positions,
    football_positions: footballPositions,
    min_years_remaining: yearsRemaining,
    min_weight_lbs: weightBounds.min,
    max_weight_lbs: weightBounds.max,
    min_height_in: heightBounds.min,
    max_height_in: heightBounds.max,
    filters: {
      active_in_portal: true,
      min_years_remaining: yearsRemaining,
      min_weight_lbs: weightBounds.min,
      max_weight_lbs: weightBounds.max,
      min_height_in: heightBounds.min,
      max_height_in: heightBounds.max,
    },
    roles,
    traits,
    pff_criteria: pffCriteria,
    production_priorities: productionPriorities,
    body_type_hint: /(physical|big|heavy|big-bodied|big bodied)/.test(lower)
      ? "big-bodied"
      : /(tall|length|lengthy|long|rangy|big-framed|big framed)/.test(lower)
        ? "tall-bodied"
        : undefined,
    reasoning,
  };

  return applyImplicitSizeHints(lower, criteria);
}

function gradeToScore(value: number | null): number {
  if (value == null) return 40;
  if (value >= 90) return 100;
  if (value >= 80) return 88 + (value - 80) * 1.2;
  if (value >= 70) return 72 + (value - 70) * 1.6;
  if (value >= 60) return 55 + (value - 60) * 1.7;
  return 30 + Math.max(0, value - 40) * 1.25;
}

function ratioScore(value: number | null, target: number): number {
  if (value == null || target <= 0) return 40;
  const ratio = value / target;
  if (ratio >= 1.4) return 100;
  if (ratio >= 1.0) return 82 + (ratio - 1.0) * 45;
  if (ratio >= 0.8) return 60 + (ratio - 0.8) * 110;
  if (ratio >= 0.5) return 35 + (ratio - 0.5) * 80;
  return 20 + ratio * 30;
}

function inverseMetricScore(value: number | null, good: number, elite: number): number {
  if (value == null) return 45;
  if (value <= elite) return 100;
  if (value <= good) return 70 + ((good - value) / Math.max(0.01, good - elite)) * 30;
  return clamp(55 - (value - good) * 25);
}

function forwardMetricScore(value: number | null, good: number, elite: number): number {
  if (value == null) return 45;
  if (value >= elite) return 100;
  if (value >= good) return 70 + ((value - good) / Math.max(0.01, elite - good)) * 30;
  return clamp(40 + (value / Math.max(1, good)) * 30);
}

function getStatValue(player: Player, stat: string): number | null {
  const stats = player.latest_stats;
  if (!stats) return null;
  const value = (stats as unknown as Record<string, unknown>)[stat];
  return toNumber(value);
}

function positionFamily(players: Player[], criteria: AiSearchCriteria): PositionGroup[] {
  return criteria.positions.length > 0
    ? criteria.positions
    : Array.from(new Set(players.map((player) => player.position)));
}

function normalizeCriteria(parsed: z.infer<typeof criteriaSchema>): AiSearchCriteria {
  const filterYears = parsed.filters?.min_years_remaining ?? parsed.min_years_remaining ?? undefined;
  const filterMinWeight = parsed.filters?.min_weight_lbs ?? parsed.min_weight_lbs ?? undefined;
  const filterMaxWeight = parsed.filters?.max_weight_lbs ?? parsed.max_weight_lbs ?? undefined;
  const filterMinHeight = parsed.filters?.min_height_in ?? parsed.min_height_in ?? undefined;
  const filterMaxHeight = parsed.filters?.max_height_in ?? parsed.max_height_in ?? undefined;

  return {
    positions: parsed.positions ?? [],
    football_positions: parsed.football_positions ?? [],
    min_years_remaining: filterYears,
    min_weight_lbs: filterMinWeight,
    max_weight_lbs: filterMaxWeight,
    min_height_in: filterMinHeight,
    max_height_in: filterMaxHeight,
    filters: {
      active_in_portal: parsed.filters?.active_in_portal ?? true,
      min_years_remaining: filterYears,
      min_weight_lbs: filterMinWeight,
      max_weight_lbs: filterMaxWeight,
      min_height_in: filterMinHeight,
      max_height_in: filterMaxHeight,
    },
    roles: parsed.roles ?? [],
    traits: parsed.traits ?? [],
    pff_criteria: parsed.pff_criteria ?? [],
    production_priorities: parsed.production_priorities ?? [],
    body_type_hint: parsed.body_type_hint ?? undefined,
    reasoning: parsed.reasoning ?? "",
  };
}

export async function extractSearchCriteria(query: string): Promise<AiSearchCriteria> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return buildHeuristicCriteria(query);
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1400,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: query }],
    });

    const rawText = message.content[0]?.type === "text" ? message.content[0].text : "";
    const parsedJson = JSON.parse(stripCodeFences(rawText));
    return applyImplicitSizeHints(query, normalizeCriteria(criteriaSchema.parse(parsedJson)));
  } catch (error) {
    console.error(
      `[ai-search] Falling back to heuristic parser: ${error instanceof Error ? error.message : "unknown error"}`
    );
    return buildHeuristicCriteria(query);
  }
}

function roleAlignmentValue(role: AiRoleKey, pffStats: Record<string, unknown> | null): number | null {
  if (!pffStats) return null;
  const value = (key: string) => toNumber(pffStats[key]) ?? 0;

  switch (role) {
    case "interior_dl":
      return value("snaps_interior_dl");
    case "edge":
      return value("snaps_at_left_end") + value("snaps_at_right_end");
    case "slot_cb":
      return value("snaps_slot_cb");
    case "outside_cb":
      return value("snaps_outside_cb");
    case "box_safety":
      return value("snaps_in_box_db");
    case "free_safety":
      return value("snaps_free_safety");
    case "strong_safety":
      return value("snaps_strong_safety");
    case "slot_receiver":
      return value("snaps_slot");
    case "boundary_receiver":
      return value("snaps_wide_left") + value("snaps_wide_right");
    case "inline_te":
      return value("snaps_inline_te");
    case "move_te":
      return value("snaps_slot") + value("snaps_wide_left") + value("snaps_wide_right");
    case "backfield_rb":
      return value("snaps_backfield");
  }
}

function roleAlignmentTarget(role: AiRoleKey): number {
  switch (role) {
    case "interior_dl":
    case "edge":
    case "outside_cb":
    case "slot_receiver":
    case "boundary_receiver":
      return 120;
    case "slot_cb":
    case "box_safety":
    case "free_safety":
    case "strong_safety":
    case "inline_te":
    case "move_te":
    case "backfield_rb":
      return 80;
  }
}

function roleAlignmentGate(role: AiRoleKey): number {
  switch (role) {
    case "interior_dl":
    case "edge":
    case "outside_cb":
    case "boundary_receiver":
      return 60;
    case "slot_cb":
    case "slot_receiver":
      return 40;
    case "box_safety":
    case "free_safety":
    case "strong_safety":
    case "inline_te":
    case "move_te":
    case "backfield_rb":
      return 25;
  }
}

function formatSnapLine(role: AiRoleKey, snaps: number | null): string | null {
  if (snaps == null || snaps <= 0) return null;
  return `${Math.round(snaps)} ${ROLE_SNAP_LABELS[role]}`;
}

function scoreRoleFit(
  criteria: AiSearchCriteria,
  pffStats: Record<string, unknown> | null
): { score: number; badges: string[]; explanation: string | null; requiredMissed: boolean } {
  if (criteria.roles.length === 0) return { score: 65, badges: [], explanation: null, requiredMissed: false };
  if (!pffStats) return { score: 52, badges: [], explanation: null, requiredMissed: false };

  const scores: number[] = [];
  const badges: string[] = [];
  const snapLines: Array<{ snaps: number; line: string }> = [];
  let requiredMissed = false;

  for (const role of criteria.roles) {
    const value = roleAlignmentValue(role.key, pffStats);
    const gate = roleAlignmentGate(role.key);
    const baseScore = ratioScore(value, roleAlignmentTarget(role.key));
    const score =
      role.strength === "required" && (value == null || value < gate)
        ? Math.min(baseScore, 18)
        : role.strength === "required"
          ? baseScore
          : Math.max(baseScore, 45);

    if (role.strength === "required" && (value == null || value < gate)) {
      requiredMissed = true;
    }

    const snapLine = formatSnapLine(role.key, value);
    if (snapLine && value != null) {
      snapLines.push({ snaps: value, line: snapLine });
    }

    scores.push(score);
    if (score >= 70) badges.push(ROLE_LABELS[role.key]);
  }

  return {
    score: Math.round(scores.reduce((sum, value) => sum + value, 0) / Math.max(1, scores.length)),
    badges: badges.slice(0, 2),
    explanation: snapLines.sort((a, b) => b.snaps - a.snaps)[0]?.line ?? null,
    requiredMissed,
  };
}

function scoreTraitFit(
  trait: AiTraitCriterion,
  player: Player,
  pffStats: Record<string, unknown> | null
): number {
  const primary = getPffPrimaryGrade(pffStats, player.position);
  switch (trait.key) {
    case "run_support":
      return Math.round(
        (
          gradeToScore(toNumber(pffStats?.grades_tackle_db ?? pffStats?.grades_tackle ?? null)) +
          gradeToScore(toNumber(pffStats?.grades_run_defense_lb ?? pffStats?.grades_run_defense_dl ?? null)) +
          ratioScore(getStatValue(player, "tackles"), 35)
        ) / 3
      );
    case "coverage":
      return Math.round(
        (
          gradeToScore(toNumber(pffStats?.grades_coverage_db ?? pffStats?.grades_coverage_lb ?? null)) +
          gradeToScore(toNumber(pffStats?.stats_passer_rating_allowed != null ? 100 - (toNumber(pffStats?.stats_passer_rating_allowed) ?? 100) : null)) +
          ratioScore(getStatValue(player, "passes_defended"), 4)
        ) / 3
      );
    case "pass_rush":
      return Math.round(
        (
          gradeToScore(toNumber(pffStats?.grades_pass_rush ?? pffStats?.grades_pass_rush_lb ?? null)) +
          ratioScore(toNumber(pffStats?.stats_pass_rush_snaps), 120) +
          ratioScore(getStatValue(player, "sacks"), 4)
        ) / 3
      );
    case "pass_blocking":
      return Math.round(
        (
          gradeToScore(toNumber(pffStats?.grades_pass_block ?? pffStats?.grades_pass_block_rb ?? null)) +
          inverseMetricScore(toNumber(pffStats?.stats_pressures_allowed ?? pffStats?.stats_pressures_allowed_rb ?? null), 10, 4) +
          inverseMetricScore(toNumber(pffStats?.stats_sacks_allowed ?? null), 2, 0)
        ) / 3
      );
    case "run_blocking":
      return Math.round(
        (
          gradeToScore(toNumber(pffStats?.grades_run_block ?? pffStats?.grades_run_block_rb ?? null)) +
          ratioScore(toNumber(pffStats?.stats_pass_block_snaps), 120) +
          ratioScore(getStatValue(player, "starts"), 6)
        ) / 3
      );
    case "route_running":
      return Math.round(
        (
          gradeToScore(toNumber(pffStats?.grades_pass_route ?? primary?.value ?? null)) +
          ratioScore(toNumber(pffStats?.stats_yards_per_route_run), 1.75) +
          ratioScore(getStatValue(player, "receiving_yards"), 450)
        ) / 3
      );
    case "explosive":
      return Math.round(
        (
          inverseMetricScore(player.measurements?.forty_time ?? null, 4.65, 4.45) +
          forwardMetricScore(player.measurements?.vertical_jump ?? null, 32, 37) +
          ratioScore(toNumber(pffStats?.stats_yards_per_route_run ?? pffStats?.stats_elusive_rating ?? pffStats?.stats_yards_per_attempt), 2)
        ) / 3
      );
    case "big_body":
      return scoreBodyTypeHint(player, "big");
    case "receiving":
      return Math.round(
        (
          gradeToScore(toNumber(pffStats?.grades_pass_route ?? pffStats?.grades_offense ?? null)) +
          ratioScore(getStatValue(player, "receiving_yards"), 300) +
          ratioScore(toNumber(pffStats?.stats_targets), 25)
        ) / 3
      );
    case "tackling":
      return Math.round(
        (
          gradeToScore(toNumber(pffStats?.grades_tackle_db ?? pffStats?.grades_tackle ?? null)) +
          ratioScore(toNumber(pffStats?.stats_tackles), 35) +
          ratioScore(getStatValue(player, "tackles"), 35)
        ) / 3
      );
    case "ball_skills":
      return Math.round(
        (
          ratioScore(toNumber(pffStats?.stats_interceptions_def), 2) +
          ratioScore(getStatValue(player, "interceptions"), 2) +
          ratioScore(getStatValue(player, "passes_defended"), 5)
        ) / 3
      );
  }
}

function scorePffCriteria(criteria: AiSearchCriteria, pffStats: Record<string, unknown> | null): number {
  if (!pffStats && criteria.pff_criteria.length > 0) return 35;
  if (criteria.pff_criteria.length === 0) {
    return gradeToScore(getPffPrimaryGrade(pffStats)?.value ?? null);
  }

  const weighted: number[] = [];
  const weights: number[] = [];

  for (const criterion of criteria.pff_criteria) {
    const value = toNumber(pffStats?.[criterion.column]);
    if (value == null) continue;
    const score =
      criterion.preference === "low"
        ? inverseMetricScore(value, criterion.target_value, Math.max(0, criterion.target_value * 0.45))
        : criterion.column.startsWith("grades_")
          ? Math.max(gradeToScore(value), ratioScore(value, criterion.target_value))
          : ratioScore(value, criterion.target_value);
    weighted.push(score * criterion.weight);
    weights.push(criterion.weight);
  }

  if (!weights.length) return gradeToScore(getPffPrimaryGrade(pffStats)?.value ?? null);
  return Math.round(weighted.reduce((sum, value) => sum + value, 0) / weights.reduce((sum, value) => sum + value, 0));
}

function scoreBodyTypeHint(player: Player, bodyTypeHint?: string): number {
  if (!bodyTypeHint) return 60;
  const weight = player.measurements?.weight_lbs ?? null;
  const height = player.measurements?.height_in ?? null;
  const hint = bodyTypeHint.toLowerCase();

  if (hint.includes("big") || hint.includes("heavy") || hint.includes("long")) {
    return Math.round((ratioScore(weight, 220) + ratioScore(height, 73)) / 2);
  }

  if (hint.includes("compact")) {
    return clamp(80 - Math.max(0, (height ?? 72) - 72) * 4);
  }

  if (hint.includes("lean")) {
    return clamp(80 - Math.max(0, (weight ?? 210) - 205) * 0.6);
  }

  return 60;
}

function rangeCenterScore(value: number | null, range?: [number, number]): number {
  if (value == null || !range) return 60;
  const [min, max] = range;
  if (value >= min && value <= max) return 90;
  if (value < min) return clamp(90 - (min - value) * 8);
  return clamp(90 - (value - max) * 8);
}

function scoreProjectionPotential(criteria: AiSearchCriteria, player: Player): number {
  const position = criteria.positions[0] ?? player.position;
  const ranges = POSITION_PROJECTION_RANGES[position];
  if (!ranges) return 65;

  const heightScore = rangeCenterScore(player.measurements?.height_in ?? null, ranges.height);
  const weightScore = rangeCenterScore(player.measurements?.weight_lbs ?? null, ranges.weight);
  const armScore = ranges.arm != null ? ratioScore(player.measurements?.arm_length_in ?? null, ranges.arm) : 65;
  const archetype = detectArchetype(player.position, player.measurements?.height_in, player.measurements?.weight_lbs);
  const archetypeBonus = archetype ? 8 : 0;

  return Math.round((heightScore + weightScore + armScore) / 3 + archetypeBonus);
}

function scoreProfileFit(criteria: AiSearchCriteria, player: Player): number {
  const weight = player.measurements?.weight_lbs ?? null;
  const height = player.measurements?.height_in ?? null;
  const armLength = player.measurements?.arm_length_in ?? null;
  const forty = player.measurements?.forty_time ?? null;

  const subscores: number[] = [];

  if (criteria.min_weight_lbs != null) subscores.push(ratioScore(weight, criteria.min_weight_lbs));
  if (criteria.max_weight_lbs != null && weight != null) {
    subscores.push(weight <= criteria.max_weight_lbs ? 88 : clamp(88 - (weight - criteria.max_weight_lbs) * 2));
  }
  if (criteria.min_height_in != null) subscores.push(ratioScore(height, criteria.min_height_in));
  if (criteria.max_height_in != null && height != null) {
    subscores.push(height <= criteria.max_height_in ? 88 : clamp(88 - (height - criteria.max_height_in) * 10));
  }
  if (criteria.body_type_hint) subscores.push(scoreBodyTypeHint(player, criteria.body_type_hint));

  if (criteria.traits.some((trait) => trait.key === "explosive")) {
    subscores.push((inverseMetricScore(forty, 4.65, 4.45) + forwardMetricScore(player.measurements?.vertical_jump ?? null, 32, 37)) / 2);
  }

  if (criteria.traits.some((trait) => trait.key === "big_body") && armLength != null) {
    subscores.push(ratioScore(armLength, 32));
  }

  subscores.push(scoreProjectionPotential(criteria, player));

  if (!subscores.length) return 65;
  return Math.round(subscores.reduce((sum, score) => sum + score, 0) / subscores.length);
}

function scoreEligibility(criteria: AiSearchCriteria, player: Player): number {
  if (criteria.min_years_remaining == null) return 70;
  if (player.eligibility_remaining >= criteria.min_years_remaining) {
    const bonus = Math.min(15, (player.eligibility_remaining - criteria.min_years_remaining) * 8);
    return 85 + bonus;
  }
  if (player.eligibility_remaining === criteria.min_years_remaining - 1) return 35;
  return 0;
}

function relevantSnapCount(player: Player): number | null {
  const stats = player.latest_stats;
  if (!stats) return null;
  if (["QB", "RB", "WR", "TE", "OL"].includes(player.position)) {
    return toNumber(stats.offensive_snaps);
  }
  return toNumber(stats.defensive_snaps);
}

function flashRateTargets(stat: string): { good: number; elite: number; minSnaps: number } | null {
  switch (stat) {
    case "tackles_for_loss":
      return { good: 0.025, elite: 0.07, minSnaps: 20 };
    case "sacks":
      return { good: 0.015, elite: 0.045, minSnaps: 20 };
    case "tackles":
      return { good: 0.09, elite: 0.18, minSnaps: 20 };
    case "passes_defended":
      return { good: 0.012, elite: 0.035, minSnaps: 20 };
    case "interceptions":
      return { good: 0.004, elite: 0.014, minSnaps: 20 };
    case "receiving_yards":
      return { good: 1.4, elite: 2.5, minSnaps: 25 };
    case "receptions":
      return { good: 0.09, elite: 0.18, minSnaps: 25 };
    case "rushing_yards":
      return { good: 1.8, elite: 3.5, minSnaps: 20 };
    default:
      return null;
  }
}

function sampleAwarePriorityScore(player: Player, priority: AiProductionPriority): number | null {
  const value = getStatValue(player, priority.stat);
  const snaps = relevantSnapCount(player);
  const targets = flashRateTargets(priority.stat);
  if (value == null || value <= 0 || snaps == null || snaps <= 0 || !targets) return null;

  const rate = value / snaps;
  const efficiencyScore = forwardMetricScore(rate, targets.good, targets.elite);
  const sampleConfidence = clamp(35 + (Math.min(snaps, targets.minSnaps * 3) / (targets.minSnaps * 3)) * 65);
  return Math.round(efficiencyScore * 0.72 + sampleConfidence * 0.28);
}

function buildFlashProductionLine(criteria: AiSearchCriteria, player: Player): string | null {
  const snaps = relevantSnapCount(player);
  if (snaps == null || snaps <= 0) return null;

  const candidates = productionPriorities(criteria)
    .map((priority) => {
      const value = getStatValue(player, priority.stat);
      const score = sampleAwarePriorityScore(player, priority);
      return value != null && value > 0 && score != null
        ? {
            label: priority.label,
            value,
            score,
          }
        : null;
    })
    .filter(Boolean) as Array<{ label: string; value: number; score: number }>;

  const best = candidates.sort((a, b) => b.score - a.score)[0];
  if (!best || best.score < 76 || snaps > 140) return null;

  return `${best.label} ${formatStatValue(best.value)} on ${Math.round(snaps)} snaps`;
}

function productionPriorities(criteria: AiSearchCriteria): AiProductionPriority[] {
  if (criteria.production_priorities.length > 0) return criteria.production_priorities;
  const positions = criteria.positions.length > 0 ? criteria.positions : [];
  if (!positions.length) return [];
  return positions.flatMap((position) => DEFAULT_PRODUCTION_PRIORITIES[position] ?? []);
}

function scoreProductionFit(criteria: AiSearchCriteria, player: Player): number {
  if (!player.latest_stats) return 62;

  const priorities = productionPriorities(criteria);
  if (!priorities.length) {
    const starts = getStatValue(player, "starts");
    const games = getStatValue(player, "games_played");
    return Math.round((Math.max(ratioScore(starts, 5), 62) + Math.max(ratioScore(games, 8), 62)) / 2);
  }

  const weighted: number[] = [];
  const weights: number[] = [];
  for (const priority of priorities) {
    const value = getStatValue(player, priority.stat);
    const target = priority.min_value ?? 1;
    const volumeScore = ratioScore(value, target);
    const flashScore = sampleAwarePriorityScore(player, priority);
    weighted.push(Math.max(volumeScore, flashScore ?? 0) * priority.weight);
    weights.push(priority.weight);
  }

  return Math.round(weighted.reduce((sum, score) => sum + score, 0) / Math.max(1, weights.reduce((sum, value) => sum + value, 0)));
}

function scorePositionFit(criteria: AiSearchCriteria, player: Player): number {
  if (!criteria.positions.length) return 80;
  return criteria.positions.includes(player.position) ? 100 : 0;
}

function evidencePenalty(criteria: AiSearchCriteria, hasPffData: boolean): number {
  if (hasPffData) return 1;
  if (criteria.roles.length > 0 || criteria.pff_criteria.length > 0) return 0.9;
  return 0.95;
}

function compactProductionBadge(criteria: AiSearchCriteria, player: Player): string | null {
  const priorities = productionPriorities(criteria);
  for (const priority of priorities) {
    const value = getStatValue(player, priority.stat);
    if (value != null && value > 0) {
      const rounded = Number.isInteger(value) ? value.toString() : value.toFixed(1);
      return `${priority.label} ${rounded}`;
    }
  }
  return null;
}

function compactEligibilityBadge(criteria: AiSearchCriteria, player: Player): string | null {
  if (criteria.min_years_remaining == null) return null;
  if (player.eligibility_remaining < criteria.min_years_remaining) return null;
  return `${player.eligibility_remaining} yr${player.eligibility_remaining === 1 ? "" : "s"} left`;
}

function formatStatValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function pushFeaturedStat(
  stats: Array<{ label: string; value: string; score: number }>,
  label: string,
  value: string | null,
  score: number
) {
  if (!value) return;
  stats.push({ label, value, score });
}

function formatPhysicalProfile(player: Player): string | null {
  const parts = [
    formatHeightInFeetInches(player.measurements?.height_in),
    player.measurements?.weight_lbs ? `${player.measurements.weight_lbs} lbs` : null,
    player.measurements?.arm_length_in ? `${player.measurements.arm_length_in}" arms` : null,
    player.measurements?.forty_time ? `${player.measurements.forty_time}s 40` : null,
  ].filter(Boolean) as string[];

  if (!parts.length) return null;
  return parts.join(" • ");
}

function preferredGradeEvidence(
  criteria: AiSearchCriteria,
  player: Player,
  pffStats: Record<string, unknown> | null
): string | null {
  if (!pffStats) return null;

  const gradeCandidates: Array<{ label: string; value: number | null }> = [];
  const addCandidate = (label: string, value: unknown) => {
    const parsed = toNumber(value);
    if (parsed != null) gradeCandidates.push({ label, value: parsed });
  };

  if (criteria.roles.some((role) => role.key === "interior_dl")) addCandidate("Run defense", pffStats.grades_run_defense_dl);
  if (criteria.roles.some((role) => role.key === "slot_cb" || role.key === "outside_cb")) {
    addCandidate("Coverage", pffStats.grades_coverage_db);
    addCandidate("Tackle", pffStats.grades_tackle_db);
  }
  if (criteria.roles.some((role) => role.key === "box_safety" || role.key === "free_safety" || role.key === "strong_safety")) {
    addCandidate("Coverage", pffStats.grades_coverage_db);
    addCandidate("Tackle", pffStats.grades_tackle_db);
  }

  for (const trait of criteria.traits) {
    switch (trait.key) {
      case "run_support":
        addCandidate("Run defense", pffStats.grades_run_defense_lb ?? pffStats.grades_run_defense_dl);
        addCandidate("Tackle", pffStats.grades_tackle_db ?? pffStats.grades_tackle);
        break;
      case "coverage":
        addCandidate("Coverage", pffStats.grades_coverage_db ?? pffStats.grades_coverage_lb);
        break;
      case "pass_rush":
        addCandidate("Pass rush", pffStats.grades_pass_rush ?? pffStats.grades_pass_rush_lb);
        break;
      case "pass_blocking":
        addCandidate("Pass Block", pffStats.grades_pass_block ?? pffStats.grades_pass_block_rb);
        break;
      case "run_blocking":
        addCandidate("Run Block", pffStats.grades_run_block ?? pffStats.grades_run_block_rb);
        break;
      case "route_running":
      case "receiving":
        addCandidate("Route grade", pffStats.grades_pass_route);
        addCandidate("Offense", pffStats.grades_offense);
        break;
      case "tackling":
        addCandidate("Tackle", pffStats.grades_tackle_db ?? pffStats.grades_tackle);
        break;
      case "ball_skills":
        addCandidate("Coverage", pffStats.grades_coverage_db ?? pffStats.grades_coverage_lb);
        break;
      case "explosive":
      case "big_body":
        break;
    }
  }

  const primary = getPffPrimaryGrade(pffStats, player.position);
  if (primary) {
    gradeCandidates.push({ label: primary.label, value: primary.value });
  }

  const best = gradeCandidates
    .filter((candidate) => candidate.value != null)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0];

  if (!best?.value) return null;
  return `${best.label} ${best.value.toFixed(1)}`;
}

function preferredProductionEvidence(criteria: AiSearchCriteria, player: Player): string | null {
  const flashLine = buildFlashProductionLine(criteria, player);
  if (flashLine) return flashLine;

  const priorities = productionPriorities(criteria);
  const candidates = priorities
    .map((priority) => {
      const value = getStatValue(player, priority.stat);
      return value != null && value > 0
        ? {
            label: priority.label,
            value,
            score: ratioScore(value, priority.min_value ?? 1),
          }
        : null;
    })
    .filter(Boolean) as Array<{ label: string; value: number; score: number }>;

  const best = candidates.sort((a, b) => b.score - a.score)[0];
  if (best) {
    const value = Number.isInteger(best.value) ? `${best.value}` : best.value.toFixed(1);
    return `${best.label} ${value}`;
  }

  return compactProductionBadge(criteria, player);
}

function preferredWeightedFieldEvidence(
  criteria: AiSearchCriteria,
  pffStats: Record<string, unknown> | null
): string | null {
  if (!pffStats || criteria.pff_criteria.length === 0) return null;

  const candidates = criteria.pff_criteria
    .map((criterion) => {
      const value = toNumber(pffStats[criterion.column]);
      if (value == null) return null;
      const rendered = criterion.preference === "low" ? value.toFixed(Number.isInteger(value) ? 0 : 1) : value.toFixed(Number.isInteger(value) ? 0 : 1);
      const score =
        criterion.preference === "low"
          ? inverseMetricScore(value, criterion.target_value, Math.max(0, criterion.target_value * 0.45))
          : criterion.column.startsWith("grades_")
            ? Math.max(gradeToScore(value), ratioScore(value, criterion.target_value))
            : ratioScore(value, criterion.target_value);
      return {
        label: criterion.label,
        value: rendered,
        score: score * criterion.weight,
      };
    })
    .filter(Boolean) as Array<{ label: string; value: string; score: number }>;

  return candidates.sort((a, b) => b.score - a.score)[0]
    ? `${candidates.sort((a, b) => b.score - a.score)[0]!.label} ${candidates.sort((a, b) => b.score - a.score)[0]!.value}`
    : null;
}

function buildSearchExplanation(
  criteria: AiSearchCriteria,
  player: Player,
  pffStats: Record<string, unknown> | null,
  roleExplanation: string | null
): string[] {
  const explanation: string[] = [];

  if (roleExplanation) {
    explanation.push(`Role match: ${roleExplanation}.`);
  }

  const profile = formatPhysicalProfile(player);
  if (profile) {
    explanation.push(`Profile fit: ${profile}.`);
  }

  const flashLine = buildFlashProductionLine(criteria, player);
  if (flashLine) {
    explanation.push(`Flash production: ${flashLine}.`);
  }

  const evidenceParts = [
    preferredWeightedFieldEvidence(criteria, pffStats),
    preferredGradeEvidence(criteria, player, pffStats),
    flashLine ? null : preferredProductionEvidence(criteria, player),
  ].filter(Boolean) as string[];

  if (evidenceParts.length > 0) {
    explanation.push(`Evidence: ${evidenceParts.slice(0, 2).join(" • ")}.`);
  } else if (!pffStats && !player.latest_stats) {
    explanation.push("Evidence: projection-based match from frame, eligibility, and position profile.");
  }

  return explanation.slice(0, 3);
}

function buildFeaturedStats(
  criteria: AiSearchCriteria,
  player: Player,
  pffStats: Record<string, unknown> | null
): Array<{ label: string; value: string }> {
  const featured: Array<{ label: string; value: string; score: number }> = [];
  const flashLine = buildFlashProductionLine(criteria, player);

  for (const role of criteria.roles) {
    const snaps = roleAlignmentValue(role.key, pffStats);
    if (snaps != null && snaps > 0) {
      pushFeaturedStat(featured, ROLE_LABELS[role.key], `${Math.round(snaps)} snaps`, ratioScore(snaps, roleAlignmentTarget(role.key)) + 12);
    }
  }

  for (const trait of criteria.traits) {
    switch (trait.key) {
      case "run_support":
        pushFeaturedStat(featured, "Run Defense", toNumber(pffStats?.grades_run_defense_lb ?? pffStats?.grades_run_defense_dl)?.toFixed(1) ?? null, gradeToScore(toNumber(pffStats?.grades_run_defense_lb ?? pffStats?.grades_run_defense_dl ?? null)));
        pushFeaturedStat(featured, "Tackles", getStatValue(player, "tackles") != null ? formatStatValue(getStatValue(player, "tackles")!) : null, ratioScore(getStatValue(player, "tackles"), 35));
        break;
      case "coverage":
        pushFeaturedStat(featured, "Coverage", toNumber(pffStats?.grades_coverage_db ?? pffStats?.grades_coverage_lb)?.toFixed(1) ?? null, gradeToScore(toNumber(pffStats?.grades_coverage_db ?? pffStats?.grades_coverage_lb ?? null)));
        pushFeaturedStat(featured, "PBUs", getStatValue(player, "passes_defended") != null ? formatStatValue(getStatValue(player, "passes_defended")!) : null, ratioScore(getStatValue(player, "passes_defended"), 4));
        break;
      case "pass_rush":
        pushFeaturedStat(featured, "Pass Rush", toNumber(pffStats?.grades_pass_rush ?? pffStats?.grades_pass_rush_lb)?.toFixed(1) ?? null, gradeToScore(toNumber(pffStats?.grades_pass_rush ?? pffStats?.grades_pass_rush_lb ?? null)));
        pushFeaturedStat(featured, "Sacks", getStatValue(player, "sacks") != null ? formatStatValue(getStatValue(player, "sacks")!) : null, ratioScore(getStatValue(player, "sacks"), 4));
        break;
      case "pass_blocking":
        pushFeaturedStat(featured, "Pass Block", toNumber(pffStats?.grades_pass_block ?? pffStats?.grades_pass_block_rb)?.toFixed(1) ?? null, gradeToScore(toNumber(pffStats?.grades_pass_block ?? pffStats?.grades_pass_block_rb ?? null)));
        pushFeaturedStat(featured, "Press Allowed", toNumber(pffStats?.stats_pressures_allowed ?? pffStats?.stats_pressures_allowed_rb) != null ? formatStatValue(toNumber(pffStats?.stats_pressures_allowed ?? pffStats?.stats_pressures_allowed_rb)!) : null, inverseMetricScore(toNumber(pffStats?.stats_pressures_allowed ?? pffStats?.stats_pressures_allowed_rb ?? null), 10, 4));
        pushFeaturedStat(featured, "Sacks Allowed", toNumber(pffStats?.stats_sacks_allowed) != null ? formatStatValue(toNumber(pffStats?.stats_sacks_allowed)!) : null, inverseMetricScore(toNumber(pffStats?.stats_sacks_allowed ?? null), 2, 0));
        break;
      case "run_blocking":
        pushFeaturedStat(featured, "Run Block", toNumber(pffStats?.grades_run_block ?? pffStats?.grades_run_block_rb)?.toFixed(1) ?? null, gradeToScore(toNumber(pffStats?.grades_run_block ?? pffStats?.grades_run_block_rb ?? null)));
        break;
      case "route_running":
        pushFeaturedStat(featured, "Route Grade", toNumber(pffStats?.grades_pass_route)?.toFixed(1) ?? null, gradeToScore(toNumber(pffStats?.grades_pass_route ?? null)));
        pushFeaturedStat(featured, "YPRR", toNumber(pffStats?.stats_yards_per_route_run)?.toFixed(1) ?? null, ratioScore(toNumber(pffStats?.stats_yards_per_route_run), 1.75));
        break;
      case "big_body":
        pushFeaturedStat(featured, "Size", formatPhysicalProfile(player), scoreBodyTypeHint(player, "big"));
        break;
      case "explosive":
        pushFeaturedStat(featured, "Forty", player.measurements?.forty_time ? `${player.measurements.forty_time}s` : null, inverseMetricScore(player.measurements?.forty_time ?? null, 4.65, 4.45));
        pushFeaturedStat(featured, "Vertical", player.measurements?.vertical_jump ? `${player.measurements.vertical_jump}"` : null, forwardMetricScore(player.measurements?.vertical_jump ?? null, 32, 37));
        break;
      case "receiving":
        pushFeaturedStat(featured, "Receiving Yards", getStatValue(player, "receiving_yards") != null ? formatStatValue(getStatValue(player, "receiving_yards")!) : null, ratioScore(getStatValue(player, "receiving_yards"), 300));
        break;
      case "tackling":
        pushFeaturedStat(featured, "Tackle Grade", toNumber(pffStats?.grades_tackle_db ?? pffStats?.grades_tackle)?.toFixed(1) ?? null, gradeToScore(toNumber(pffStats?.grades_tackle_db ?? pffStats?.grades_tackle ?? null)));
        pushFeaturedStat(featured, "Tackles", getStatValue(player, "tackles") != null ? formatStatValue(getStatValue(player, "tackles")!) : null, ratioScore(getStatValue(player, "tackles"), 35));
        break;
      case "ball_skills":
        pushFeaturedStat(featured, "INTs", getStatValue(player, "interceptions") != null ? formatStatValue(getStatValue(player, "interceptions")!) : null, ratioScore(getStatValue(player, "interceptions"), 2));
        pushFeaturedStat(featured, "PBUs", getStatValue(player, "passes_defended") != null ? formatStatValue(getStatValue(player, "passes_defended")!) : null, ratioScore(getStatValue(player, "passes_defended"), 5));
        break;
    }
  }

  const priorities = productionPriorities(criteria);
  for (const priority of priorities) {
    const value = getStatValue(player, priority.stat);
    if (value != null && value > 0) {
      pushFeaturedStat(featured, priority.label, formatStatValue(value), ratioScore(value, priority.min_value ?? 1) * priority.weight);
    }
  }

  const primaryGrade = getPffPrimaryGrade(pffStats, player.position);
  if (primaryGrade) {
    pushFeaturedStat(featured, primaryGrade.label, primaryGrade.value.toFixed(1), gradeToScore(primaryGrade.value));
  }

  if (criteria.min_weight_lbs != null || criteria.min_height_in != null || criteria.body_type_hint) {
    pushFeaturedStat(featured, "Frame", formatPhysicalProfile(player), scoreProfileFit(criteria, player));
  }

  if (flashLine) {
    pushFeaturedStat(featured, "Flash", flashLine, 92);
  }

  const deduped = new Map<string, { label: string; value: string; score: number }>();
  for (const item of featured) {
    const existing = deduped.get(item.label);
    if (!existing || item.score > existing.score) {
      deduped.set(item.label, item);
    }
  }

  return Array.from(deduped.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(({ label, value }) => ({ label, value }));
}

function hasRoleFlashCase(
  criteria: AiSearchCriteria,
  pffStats: Record<string, unknown> | null,
  productionScore: number,
  traitScore: number,
  pffQualityScore: number
): boolean {
  if (!pffStats) return false;

  return criteria.roles.some((role) => {
    if (role.strength !== "required") return false;
    const snaps = roleAlignmentValue(role.key, pffStats);
    const gate = roleAlignmentGate(role.key);
    if (snaps == null) return false;
    if (snaps >= gate || snaps < Math.max(10, Math.round(gate * 0.2))) return false;
    return Math.max(productionScore, traitScore, pffQualityScore) >= 76;
  });
}

function buildReasonBadges(
  criteria: AiSearchCriteria,
  player: Player,
  pffStats: Record<string, unknown> | null,
  roleBadges: string[]
): string[] {
  const badges: string[] = [];
  badges.push(...roleBadges);

  const eligibilityBadge = compactEligibilityBadge(criteria, player);
  if (eligibilityBadge) badges.push(eligibilityBadge);

  const primaryGrade = getPffPrimaryGrade(pffStats, player.position);
  if (primaryGrade) badges.push(`${primaryGrade.label} ${primaryGrade.value.toFixed(1)}`);

  const productionBadge = compactProductionBadge(criteria, player);
  if (productionBadge) badges.push(productionBadge);

  if (!pffStats) badges.push("No PFF data available");
  if (!player.latest_stats && badges.length < 4) badges.push("Projection fit");
  if (criteria.body_type_hint && badges.length < 4) badges.push(criteria.body_type_hint);

  return Array.from(new Set(badges)).slice(0, 4);
}

export function filterPlayersByAiCriteria(criteria: AiSearchCriteria, players: Player[]): Player[] {
  return players.filter((player) => {
    if (criteria.filters.active_in_portal && player.active_in_portal === false) return false;
    if (criteria.positions.length > 0 && !criteria.positions.includes(player.position)) return false;
    if (criteria.min_years_remaining != null && player.eligibility_remaining < criteria.min_years_remaining) return false;
    if (criteria.min_weight_lbs != null && player.measurements?.weight_lbs != null && player.measurements.weight_lbs < criteria.min_weight_lbs) return false;
    if (criteria.max_weight_lbs != null && player.measurements?.weight_lbs != null && player.measurements.weight_lbs > criteria.max_weight_lbs) return false;
    if (criteria.min_height_in != null && player.measurements?.height_in != null && player.measurements.height_in < criteria.min_height_in) return false;
    if (criteria.max_height_in != null && player.measurements?.height_in != null && player.measurements.height_in > criteria.max_height_in) return false;
    return true;
  });
}

export function scorePlayer(
  player: Player,
  pffStats: Record<string, unknown> | null,
  criteria: AiSearchCriteria
): {
  matchScore: number;
  fitScore: number;
  pffScore: number;
  productionScore: number;
  profileScore: number;
  reasonBadges: string[];
  searchExplanation: string[];
  featuredStats: Array<{ label: string; value: string }>;
  hasPffData: boolean;
} {
  const hasPffData = pffStats !== null;
  const positionScore = scorePositionFit(criteria, player);
  if (positionScore === 0) {
    return {
      matchScore: 0,
      fitScore: 0,
      pffScore: 0,
      productionScore: 0,
      profileScore: 0,
      reasonBadges: [],
      searchExplanation: [],
      featuredStats: [],
      hasPffData,
    };
  }

  const eligibilityScore = scoreEligibility(criteria, player);
  if (criteria.min_years_remaining != null && eligibilityScore === 0) {
    return {
      matchScore: 0,
      fitScore: 0,
      pffScore: 0,
      productionScore: 0,
      profileScore: 0,
      reasonBadges: [],
      searchExplanation: [],
      featuredStats: [],
      hasPffData,
    };
  }

  const profileScore = scoreProfileFit(criteria, player);
  const productionScore = scoreProductionFit(criteria, player);
  const pffQualityScore = scorePffCriteria(criteria, pffStats);
  const roleFit = scoreRoleFit(criteria, pffStats);
  const traitScore =
    criteria.traits.length > 0
      ? Math.round(
          criteria.traits.reduce((sum, trait) => sum + scoreTraitFit(trait, player, pffStats), 0) /
            Math.max(1, criteria.traits.length)
        )
      : 65;

  const pffScore = Math.round(
    criteria.roles.length > 0
      ? pffQualityScore * 0.45 + roleFit.score * 0.55
      : pffQualityScore * 0.65 + roleFit.score * 0.35
  );
  const fitScore = Math.round(
    positionScore * 0.14 +
      eligibilityScore * 0.14 +
      profileScore * 0.22 +
      productionScore * 0.2 +
      pffScore * 0.18 +
      traitScore * 0.12
  );
  const roleFlashCase = hasRoleFlashCase(criteria, pffStats, productionScore, traitScore, pffQualityScore);
  const rolePenalty = roleFit.requiredMissed && hasPffData ? (roleFlashCase ? 0.86 : 0.62) : 1;
  const matchScore = Math.round(clamp(fitScore * evidencePenalty(criteria, hasPffData) * rolePenalty));

  return {
    matchScore,
    fitScore,
    pffScore,
    productionScore,
    profileScore,
    reasonBadges: buildReasonBadges(criteria, player, pffStats, roleFit.badges),
    searchExplanation: buildSearchExplanation(criteria, player, pffStats, roleFit.explanation),
    featuredStats: buildFeaturedStats(criteria, player, pffStats),
    hasPffData,
  };
}

export function searchPlayersByAiCriteria(
  criteria: AiSearchCriteria,
  players: Player[],
  pffStatsMap: Record<string, Record<string, unknown> | null>
): AiPlayerSearchResult[] {
  const inferredPositions = positionFamily(players, criteria);

  return players
    .map((player) => {
      const effectiveCriteria =
        criteria.positions.length > 0 ? criteria : { ...criteria, positions: inferredPositions };
      const pffStats = pffStatsMap[player.id] ?? null;
      const scored = scorePlayer(player, pffStats, effectiveCriteria);
      return {
        playerId: player.id,
        matchScore: scored.matchScore,
        fitScore: scored.fitScore,
        pffScore: scored.pffScore,
        productionScore: scored.productionScore,
        profileScore: scored.profileScore,
        reasonBadges: scored.reasonBadges,
        searchExplanation: scored.searchExplanation,
        featuredStats: scored.featuredStats,
        hasPffData: scored.hasPffData,
      };
    })
    .filter((result) => result.matchScore > 0)
    .sort((a, b) => {
      if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
      if (b.fitScore !== a.fitScore) return b.fitScore - a.fitScore;
      if (b.hasPffData !== a.hasPffData) return b.hasPffData ? 1 : -1;
      if (b.pffScore !== a.pffScore) return b.pffScore - a.pffScore;
      return b.productionScore - a.productionScore;
    });
}

export function boardFilterBadges(filters: AiBoardFilters | undefined): string[] {
  if (!filters) return [];
  const badges = [
    filters.position && filters.position !== "ALL" ? filters.position : null,
    filters.classYear && filters.classYear !== "ALL" ? filters.classYear : null,
    filters.yearsRemaining && filters.yearsRemaining !== "ALL" ? `${filters.yearsRemaining}+ yrs` : null,
    filters.heightMin ? `Ht ${filters.heightMin}+` : null,
    filters.weightMin ? `Wt ${filters.weightMin}+` : null,
    filters.school ? `School: ${filters.school}` : null,
    filters.conference && filters.conference !== "ALL" ? filters.conference : null,
    filters.archetype && filters.archetype !== "ALL" ? filters.archetype : null,
    filters.search ? `Board search: ${filters.search}` : null,
  ].filter(Boolean) as string[];

  return badges;
}

export function describeArchetypeHint(player: Player): string | null {
  const archetype = detectArchetype(player.position, player.measurements?.height_in, player.measurements?.weight_lbs);
  return archetype ?? null;
}

export type AiSupportedProductionStat = ProductionStatKey | "passing_tds" | "rushing_tds" | "receiving_tds" | "tackles_for_loss" | "receptions";
