import Anthropic from "@anthropic-ai/sdk";
import type { Player } from "@/lib/types";

export type PffCriterion = {
  column: string;    // PFF column name e.g. "grades_run_defense_dl"
  min_value: number; // minimum acceptable value
  weight: number;    // 0–1 importance multiplier
  label: string;     // human-readable description
};

export type AiSearchCriteria = {
  positions: string[];           // position codes to match e.g. ["DT", "NT"]
  min_years_remaining?: number;
  min_weight_lbs?: number;
  max_weight_lbs?: number;
  min_height_in?: number;
  max_height_in?: number;
  pff_criteria: PffCriterion[];
  reasoning: string;             // why these criteria were chosen
};

export type AiPlayerSearchResult = {
  playerId: string;
  matchScore: number;      // 0–100
  matchReasons: string[];
  pffHighlights: string[];
};

const SYSTEM_PROMPT = `You are a college football recruiting analyst. Convert a coach's plain-English player description into structured JSON search criteria.

POSITION CODES:
- Defensive line: DT (interior), DE (edge), EDGE, DL
- "Nose tackle" or "NT" → use positions: ["DT"]
- "Edge rusher" or "pass rusher" → use positions: ["EDGE", "DE"]
- Linebacker: LB, ILB, OLB, MLB
- Cornerback: CB (use for slot corner too)
- Safety: S, FS, SS
- Wide receiver: WR
- Tight end: TE
- Offensive line: OL, OT, OG, C
- Running back: RB
- Quarterback: QB

KEY PFF GRADE COLUMNS (0–100 scale; 60=average, 70=good, 80=elite):
- grades_overall — overall grade any position
- grades_pass_rush — pass rush effectiveness (DL/EDGE)
- grades_run_defense_dl — run stop grade (DL)
- grades_run_defense_lb — run stop grade (LB)
- grades_coverage_db — coverage grade (CB/S)
- grades_coverage_lb — coverage grade (LB)
- grades_tackle — tackling grade (LB/S/CB)
- grades_pass_route — route running (WR/TE)
- grades_recv_ability — receiving ability (WR/TE/RB)
- grades_run_block — run blocking (OL/TE)
- grades_pass_block — pass blocking (OL)
- grades_pass — passer grade (QB)
- grades_run — rushing grade (RB/QB)

KEY PFF SNAP COUNT COLUMNS (raw snap counts; use these to identify role/alignment):
- snaps_interior_dl — nose tackle / interior DL snaps (high = true NT role)
- snaps_at_left_end, snaps_at_right_end — DE/edge snaps
- snaps_slot_cb — slot cornerback snaps (high = true slot corner)
- snaps_outside_cb — outside corner snaps
- snaps_in_box_db — safety played in the box
- snaps_free_safety, snaps_strong_safety — safety alignment snaps
- snaps_slot — slot receiver snaps (WR/TE)
- snaps_backfield — backfield alignment (RB)
- snaps_pass_rush — total pass rush snaps

BODY TYPE KEYWORDS:
- "big", "large", "heavy" → min_weight_lbs (DT: 295, LB: 225, WR: 210 etc.)
- "athletic", "fast", "quick" → no weight constraint but note in reasoning
- Specific weights/heights should be extracted exactly

ELIGIBILITY:
- "X years eligibility left", "X years remaining" → min_years_remaining: X
- "graduate transfer", "senior" → min_years_remaining: 1

Return ONLY valid JSON matching this exact shape:
{
  "positions": ["string"],
  "min_years_remaining": number | null,
  "min_weight_lbs": number | null,
  "max_weight_lbs": number | null,
  "min_height_in": number | null,
  "max_height_in": number | null,
  "pff_criteria": [
    {
      "column": "string",
      "min_value": number,
      "weight": number,
      "label": "string"
    }
  ],
  "reasoning": "string explaining what criteria were chosen and why"
}

EXAMPLES:
Query: "big nose tackle who has 2 years of eligibility left"
→ positions: ["DT"], min_weight_lbs: 290, min_years_remaining: 2
→ pff_criteria: [{column:"snaps_interior_dl", min_value:50, weight:0.8, label:"Interior DL snaps (NT role)"}, {column:"grades_run_defense_dl", min_value:60, weight:1.0, label:"Run defense grade"}]

Query: "slot corner who is good in the run"
→ positions: ["CB"], no weight constraint
→ pff_criteria: [{column:"snaps_slot_cb", min_value:100, weight:0.8, label:"Slot CB snaps"}, {column:"grades_coverage_db", min_value:60, weight:0.7, label:"Coverage grade"}, {column:"grades_tackle", min_value:60, weight:0.9, label:"Tackle grade (run support)"}]

Query: "pass rushing defensive end"
→ positions: ["EDGE","DE"], no weight constraint
→ pff_criteria: [{column:"grades_pass_rush", min_value:65, weight:1.0, label:"Pass rush grade"}, {column:"snaps_pass_rush", min_value:100, weight:0.6, label:"Pass rush snap volume"}]`;

export async function extractSearchCriteria(query: string): Promise<AiSearchCriteria> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: query }]
  });

  const rawText = message.content[0].type === "text" ? message.content[0].text : "";

  // Strip markdown code fences if present
  const jsonText = rawText.replace(/^```(?:json)?\n?/m, "").replace(/```\s*$/m, "").trim();

  const parsed = JSON.parse(jsonText) as {
    positions: string[];
    min_years_remaining: number | null;
    min_weight_lbs: number | null;
    max_weight_lbs: number | null;
    min_height_in: number | null;
    max_height_in: number | null;
    pff_criteria: PffCriterion[];
    reasoning: string;
  };

  return {
    positions: parsed.positions ?? [],
    min_years_remaining: parsed.min_years_remaining ?? undefined,
    min_weight_lbs: parsed.min_weight_lbs ?? undefined,
    max_weight_lbs: parsed.max_weight_lbs ?? undefined,
    min_height_in: parsed.min_height_in ?? undefined,
    max_height_in: parsed.max_height_in ?? undefined,
    pff_criteria: parsed.pff_criteria ?? [],
    reasoning: parsed.reasoning ?? ""
  };
}

export function scorePlayer(
  player: Player,
  pffStats: Record<string, unknown> | null,
  criteria: AiSearchCriteria
): { score: number; reasons: string[]; highlights: string[] } {
  const reasons: string[] = [];
  const highlights: string[] = [];
  let totalWeight = 0;
  let earnedWeight = 0;

  // Measurement scoring
  const w = player.measurements;
  if (criteria.min_weight_lbs && w?.weight_lbs) {
    const diff = w.weight_lbs - criteria.min_weight_lbs;
    if (diff >= 0) {
      const bonus = Math.min(0.3, diff / 50);
      earnedWeight += 0.3 + bonus;
      totalWeight += 0.3;
      reasons.push(`${w.weight_lbs} lbs (target ≥ ${criteria.min_weight_lbs})`);
    } else {
      // Under target weight — partial credit if within 10 lbs
      if (diff >= -10) {
        earnedWeight += 0.15;
        totalWeight += 0.3;
        reasons.push(`${w.weight_lbs} lbs (slightly under target ${criteria.min_weight_lbs})`);
      } else {
        totalWeight += 0.3;
      }
    }
  }

  if (criteria.min_height_in && w?.height_in) {
    const diff = w.height_in - criteria.min_height_in;
    totalWeight += 0.2;
    if (diff >= 0) {
      earnedWeight += 0.2;
      const feet = Math.floor(w.height_in / 12);
      const inches = w.height_in % 12;
      reasons.push(`${feet}'${inches}" height`);
    }
  }

  // Eligibility scoring
  if (criteria.min_years_remaining != null) {
    totalWeight += 0.2;
    if (player.eligibility_remaining >= criteria.min_years_remaining) {
      earnedWeight += 0.2;
      reasons.push(`${player.eligibility_remaining} yr eligibility remaining`);
    }
  }

  // PFF criteria scoring
  for (const criterion of criteria.pff_criteria) {
    totalWeight += criterion.weight;
    if (!pffStats) continue;

    const value = Number(pffStats[criterion.column] ?? 0);
    if (value > 0) {
      if (value >= criterion.min_value) {
        // Full credit + bonus for exceeding
        const excess = Math.min(20, value - criterion.min_value);
        earnedWeight += criterion.weight * (1 + excess / 100);
        highlights.push(`${criterion.label}: ${Math.round(value)}`);
      } else if (value >= criterion.min_value * 0.85) {
        // Close — partial credit
        earnedWeight += criterion.weight * 0.5;
        highlights.push(`${criterion.label}: ${Math.round(value)} (near threshold)`);
      }
    }
  }

  if (totalWeight === 0) return { score: 0, reasons, highlights };

  const rawScore = earnedWeight / totalWeight;
  const score = Math.round(Math.min(100, rawScore * 100));
  return { score, reasons, highlights };
}

export function searchPlayersByAiCriteria(
  criteria: AiSearchCriteria,
  players: Player[],
  pffStatsMap: Record<string, Record<string, unknown> | null>
): AiPlayerSearchResult[] {
  return players
    .map((player) => {
      const pffStats = pffStatsMap[player.id] ?? null;
      const { score, reasons, highlights } = scorePlayer(player, pffStats, criteria);
      return { playerId: player.id, matchScore: score, matchReasons: reasons, pffHighlights: highlights };
    })
    .filter((r) => r.matchScore > 0)
    .sort((a, b) => b.matchScore - a.matchScore);
}
