export interface CfbdPlayerStatRow {
  season: number;
  playerId: string;
  player: string;
  position: string;
  team: string;
  conference: string;
  category: string;
  statType: string;
  stat: string;
}

export interface CfbdClientConfig {
  apiKey: string;
  baseUrl?: string;
}

const DEFAULT_BASE_URL = "https://api.collegefootballdata.com";

function toNumber(val: string | null | undefined): number | null {
  if (!val) return null;
  const cleaned = val.replace(/,/g, "").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function normName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchCfbdPlayerSeasonStats(input: {
  year: number;
  team?: string;
  conference?: string;
  seasonType?: "regular" | "postseason" | "both" | "allstar" | "spring_regular" | "spring_postseason";
  category?: string;
  startWeek?: number;
  endWeek?: number;
  config: CfbdClientConfig;
}): Promise<CfbdPlayerStatRow[]> {
  const { year, team, conference, seasonType, category, startWeek, endWeek, config } = input;
  const baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
  const url = new URL(`${baseUrl}/stats/player/season`);
  url.searchParams.set("year", String(year));
  if (team) url.searchParams.set("team", team);
  if (conference) url.searchParams.set("conference", conference);
  if (seasonType) url.searchParams.set("seasonType", seasonType);
  if (category) url.searchParams.set("category", category);
  if (typeof startWeek === "number") url.searchParams.set("startWeek", String(startWeek));
  if (typeof endWeek === "number") url.searchParams.set("endWeek", String(endWeek));

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      Accept: "application/json"
    }
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`CFBD player season stats API error ${res.status}: ${text}`);
  }

  return res.json() as Promise<CfbdPlayerStatRow[]>;
}

export interface CfbdPlayerTransfer {
  season: number;
  firstName: string;
  lastName: string;
  position: string;
  origin: string;
  destination: string | null;
  transferDate: string | null;
  rating: number | null;
  stars: number | null;
  eligibility: unknown | null;
}

export async function fetchCfbdTransferPortal(input: {
  year: number;
  config: CfbdClientConfig;
}): Promise<CfbdPlayerTransfer[]> {
  const { year, config } = input;
  const baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
  const url = new URL(`${baseUrl}/player/portal`);
  url.searchParams.set("year", String(year));

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      Accept: "application/json"
    }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`CFBD transfer portal API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<CfbdPlayerTransfer[]>;
}

export interface OurPlayerStatsFromCfbd {
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
}

/**
 * CFBD returns one row per (player, category, statType). We try to map common NCAA stat keys.
 * This is intentionally tolerant: if a key doesn't exist, we leave it null.
 */
export function mapCfbdRowsToOurSchema(input: {
  season: number;
  playerFullName: string;
  rows: CfbdPlayerStatRow[];
}): OurPlayerStatsFromCfbd {
  const { season, playerFullName, rows } = input;
  const target = normName(playerFullName);
  const playerRows = rows.filter((r) => normName(r.player) === target);

  const out: OurPlayerStatsFromCfbd = {
    season,
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

  // Accumulators for touchdowns by phase
  let passTds: number | null = null;
  let rushTds: number | null = null;
  let recTds: number | null = null;

  for (const r of playerRows) {
    const cat = (r.category || "").toLowerCase();
    const key = (r.statType || "").toLowerCase();
    const n = toNumber(r.stat);
    if (n == null) continue;

    // Games/starts show up in some categories; grab the first sensible value
    if (out.games_played == null && (key === "gp" || key.includes("games played"))) out.games_played = n;
    if (out.starts == null && (key === "gs" || key.includes("games started") || key.includes("starts"))) out.starts = n;

    if (cat === "passing") {
      if (out.passing_yards == null && (key === "yds" || key.includes("yards"))) out.passing_yards = n;
      if (key === "td" || key.includes("touchdown")) passTds = n;
      if (out.interceptions == null && (key === "int" || key.includes("interception"))) out.interceptions = n;
    }

    if (cat === "rushing") {
      if (out.rushing_yards == null && (key === "yds" || key.includes("yards"))) out.rushing_yards = n;
      if (key === "td" || key.includes("touchdown")) rushTds = n;
    }

    if (cat === "receiving") {
      if (out.receiving_yards == null && (key === "yds" || key.includes("yards"))) out.receiving_yards = n;
      if (key === "td" || key.includes("touchdown")) recTds = n;
    }

    if (cat === "defensive" || cat === "defense") {
      if (out.tackles == null && (key === "tot" || key.includes("tackles"))) out.tackles = n;
      if (out.sacks == null && key.includes("sack")) out.sacks = n;
      if (out.interceptions == null && (key === "int" || key.includes("interception"))) out.interceptions = n;
      if (out.passes_defended == null && (key === "pd" || key.includes("pass defended") || key.includes("passes defended"))) {
        out.passes_defended = n;
      }
    }
  }

  const tds = (passTds ?? 0) + (rushTds ?? 0) + (recTds ?? 0);
  out.total_touchdowns = tds > 0 ? tds : null;
  return out;
}

