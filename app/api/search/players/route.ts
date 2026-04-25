/**
 * POST /api/search/players
 *
 * Football-aware natural language player search.
 *
 * Converts a plain-English query into structured football criteria using
 * Claude Haiku (with a regex/heuristic fallback when no API key is set),
 * then scores every player in the database against those criteria using:
 *   - Position fit (hard gate — wrong position scores 0)
 *   - Eligibility runway
 *   - Physical profile vs. position norms
 *   - Production stats (volume + per-snap efficiency)
 *   - PFF grades (position-specific primary grade)
 *   - Alignment usage (snap counts by role, e.g. guard snaps for guards)
 *   - Trait scoring (pass_block uses negative weighting for pressures/sacks allowed)
 *
 * Request body:
 *   query        string   Plain-English recruiting query (required)
 *   limit        number   Max results to return (default 15, max 30)
 *   boardFilters object   Optional: scope search within existing filter state
 *
 * Response:
 *   {
 *     query: string
 *     criteria: AiSearchCriteria   — structured interpretation of the query
 *     results: Array<{
 *       rank:              number
 *       player:            Player        — full player object with pffStats
 *       matchScore:        number        — 0-100 composite match score
 *       fitScore:          number        — weighted sub-component fit
 *       pffScore:          number        — PFF grade + alignment score
 *       productionScore:   number        — stat-based production score
 *       profileScore:      number        — physical profile score
 *       hasPffData:        boolean
 *       reasonBadges:      string[]      — up to 4 compact match reason chips
 *       explanation:       string[]      — 1-3 football-language explanation lines
 *       featuredStats:     Array<{ label, value }>  — top relevant stats to display
 *     }>
 *   }
 */

import { NextResponse } from "next/server";
import {
  extractSearchCriteria,
  filterPlayersByAiCriteria,
  searchPlayersByAiCriteria,
  type AiBoardFilters,
} from "@/lib/ai/player-search";
import { getPlayersFromSupabaseForAI, getBatchPffStatsForPlayers } from "@/lib/data/queries";
import type { Player } from "@/lib/types";

export const dynamic = "force-dynamic";

interface SearchRequestBody {
  query?: unknown;
  limit?: unknown;
  boardFilters?: unknown;
}

function normalizeString(v: unknown): string | undefined {
  if (typeof v === "string" && v.trim()) return v.trim();
  return undefined;
}

function normalizeNumber(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export async function POST(request: Request) {
  let body: SearchRequestBody;
  try {
    body = (await request.json()) as SearchRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const query = normalizeString(body.query);
  if (!query) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }

  const limit = Math.min(normalizeNumber(body.limit) ?? 15, 30);
  const rawFilters = (body.boardFilters ?? {}) as Record<string, unknown>;

  const boardFilters: AiBoardFilters = {
    position: normalizeString(rawFilters.position),
    classYear: normalizeString(rawFilters.classYear),
    yearsRemaining: normalizeString(rawFilters.yearsRemaining),
    heightMin: normalizeString(rawFilters.heightMin),
    heightMax: normalizeString(rawFilters.heightMax),
    weightMin: normalizeString(rawFilters.weightMin),
    weightMax: normalizeString(rawFilters.weightMax),
    armLengthMin: normalizeString(rawFilters.armLengthMin),
    fortyMax: normalizeString(rawFilters.fortyMax),
    school: normalizeString(rawFilters.school),
    conference: normalizeString(rawFilters.conference),
    archetype: normalizeString(rawFilters.archetype),
    search: normalizeString(rawFilters.search),
  };

  // Phase 1: parse the query into structured football criteria
  const criteria = await extractSearchCriteria(query);

  // Phase 2: fetch players scoped to the board filters
  const allPlayers = (await getPlayersFromSupabaseForAI({
    positions: criteria.positions.length > 0 ? criteria.positions : undefined,
    minWeightLbs: normalizeNumber(boardFilters.weightMin) ?? (criteria.min_weight_lbs ?? undefined),
    maxWeightLbs: normalizeNumber(boardFilters.weightMax) ?? (criteria.max_weight_lbs ?? undefined),
    minHeightIn: normalizeNumber(boardFilters.heightMin) ?? (criteria.min_height_in ?? undefined),
    maxHeightIn: normalizeNumber(boardFilters.heightMax) ?? (criteria.max_height_in ?? undefined),
    minYearsRemaining: normalizeNumber(boardFilters.yearsRemaining) ?? (criteria.min_years_remaining ?? undefined),
  })) as Player[];

  // Phase 3: apply AI hard filters (position, eligibility, weight/height bounds)
  const players = filterPlayersByAiCriteria(criteria, allPlayers);

  // Phase 4: batch-fetch PFF stats
  const pffStatsMap = await getBatchPffStatsForPlayers(players);

  // Phase 5: score + rank
  const ranked = searchPlayersByAiCriteria(criteria, players, pffStatsMap);

  // Phase 6: shape response — attach player + pff data, add rank
  const playerById = new Map(players.map((p) => [p.id, p]));

  const results = ranked.slice(0, limit).map((result, index) => {
    const player = {
      ...playerById.get(result.playerId)!,
      pffStats: (pffStatsMap[result.playerId] as Player["pffStats"]) ?? null,
    };
    return {
      rank: index + 1,
      player,
      matchScore: result.matchScore,
      fitScore: result.fitScore,
      pffScore: result.pffScore,
      productionScore: result.productionScore,
      profileScore: result.profileScore,
      hasPffData: result.hasPffData,
      reasonBadges: result.reasonBadges,
      explanation: result.searchExplanation,
      featuredStats: result.featuredStats,
    };
  });

  return NextResponse.json({ query, criteria, results });
}
