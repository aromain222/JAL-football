/**
 * Sportradar NCAA Football API – Player Profile
 * https://developer.sportradar.com/football/reference/ncaafb-player-profile
 *
 * Returns player bio (height, weight, position, etc.) and seasonal statistics per team.
 * Note: Arm length / wing span are not in this API (combine/pro day data would need another source).
 */

export interface SportradarTeamRef {
  id: string;
  name: string;
  market: string;
  alias: string;
}

export interface SportradarSeasonStats {
  games_played?: number;
  games_started?: number;
  rushing?: {
    attempts?: number;
    yards?: number;
    touchdowns?: number;
  };
  receiving?: {
    receptions?: number;
    yards?: number;
    touchdowns?: number;
  };
  passing?: {
    attempts?: number;
    completions?: number;
    yards?: number;
    touchdowns?: number;
    interceptions?: number;
  };
  defense?: {
    tackles?: number;
    assists?: number;
    combined?: number;
    sacks?: number;
    interceptions?: number;
    passes_defended?: number;
  };
  fumbles?: Record<string, number>;
}

export interface SportradarSeason {
  id: string;
  year: number;
  type: string;
  name: string;
  teams: Array<{
    id: string;
    name: string;
    market: string;
    alias: string;
    statistics?: SportradarSeasonStats;
  }>;
}

export interface SportradarPlayerProfile {
  id: string;
  first_name: string;
  last_name: string;
  name: string;
  abbr_name?: string;
  jersey?: string;
  position: string;
  height?: number;
  weight?: number;
  birth_place?: string;
  eligibility?: string;
  status?: string;
  team?: SportradarTeamRef;
  seasons?: SportradarSeason[];
  _comment?: string;
}

const DEFAULT_BASE_URL = "https://api.sportradar.us/ncaafb";

export interface PlayerProfileConfig {
  apiKey: string;
  accessLevel?: "trial" | "production";
  baseUrl?: string;
}

export async function fetchPlayerProfile(
  playerId: string,
  config: PlayerProfileConfig
): Promise<SportradarPlayerProfile | null> {
  const { apiKey, accessLevel = "trial", baseUrl = DEFAULT_BASE_URL } = config;
  const url = `${baseUrl}/${accessLevel}/v7/en/players/${playerId}/profile.json`;
  const res = await fetch(url, {
    headers: {
      "x-api-key": apiKey,
      Accept: "application/json"
    }
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sportradar player profile API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<SportradarPlayerProfile>;
}

/** Map one season's team statistics to our player_stats row shape (no id or player_id). */
export function mapProfileStatsToOurSchema(
  stats: SportradarSeasonStats | undefined,
  seasonYear: number
): {
  season: number;
  games_played: number | null;
  starts: number | null;
  passing_yards: number | null;
  rushing_yards: number | null;
  receiving_yards: number | null;
  total_touchdowns: number | null;
  tackles: number | null;
  sacks: number | null;
  interceptions: number | null;
  passes_defended: number | null;
} {
  if (!stats) {
    return {
      season: seasonYear,
      games_played: null,
      starts: null,
      passing_yards: null,
      rushing_yards: null,
      receiving_yards: null,
      total_touchdowns: null,
      tackles: null,
      sacks: null,
      interceptions: null,
      passes_defended: null
    };
  }
  const passing = stats.passing;
  const rushing = stats.rushing;
  const receiving = stats.receiving;
  const defense = stats.defense;
  const totalTds =
    (passing?.touchdowns ?? 0) + (rushing?.touchdowns ?? 0) + (receiving?.touchdowns ?? 0);
  const tackles = defense?.combined ?? defense?.tackles ?? null;
  const sacks = defense?.sacks != null ? Number(defense.sacks) : null;
  return {
    season: seasonYear,
    games_played: stats.games_played ?? null,
    starts: stats.games_started ?? null,
    passing_yards: passing?.yards ?? null,
    rushing_yards: rushing?.yards ?? null,
    receiving_yards: receiving?.yards ?? null,
    total_touchdowns: totalTds || null,
    tackles: tackles ?? null,
    sacks: sacks ?? null,
    interceptions: defense?.interceptions ?? null,
    passes_defended: defense?.passes_defended ?? null
  };
}
