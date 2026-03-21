type EspnFetchOptions = {
  season: number;
  timeoutMs?: number;
};

export type EspnMappedStats = {
  season: number;
  games_played: number | null;
  starts: number | null;
  passing_yards: number | null;
  passing_tds: number | null;
  interceptions_thrown: number | null;
  rushing_attempts: number | null;
  rushing_yards: number | null;
  rushing_tds: number | null;
  receptions: number | null;
  receiving_yards: number | null;
  receiving_tds: number | null;
  total_touchdowns: number | null;
  tackles: number | null;
  sacks: number | null;
  interceptions: number | null;
  passes_defended: number | null;
  tackles_for_loss: number | null;
  forced_fumbles: number | null;
};

type CollectedStat = {
  path: string[];
  name: string;
  displayName?: string;
  shortDisplayName?: string;
  value: string | number | null;
};

const ENDPOINT_BUILDERS = [
  (athleteId: string, season: number) =>
    `https://site.api.espn.com/apis/site/v2/sports/football/college-football/athletes/${athleteId}/stats?season=${season}`,
  (athleteId: string, season: number) =>
    `https://site.web.api.espn.com/apis/common/v3/sports/football/college-football/athletes/${athleteId}/stats?season=${season}&lang=en&region=us`
] as const;

export async function fetchEspnPlayerStats(
  espnUrl: string,
  options: EspnFetchOptions
): Promise<EspnMappedStats | null> {
  const athleteId = parseEspnAthleteId(espnUrl);
  if (!athleteId) return null;

  let payload: unknown = null;

  for (const buildUrl of ENDPOINT_BUILDERS) {
    const response = await fetchJson(buildUrl(athleteId, options.season), options.timeoutMs ?? 15_000);
    if (response) {
      payload = response;
      break;
    }
  }

  if (!payload) return null;

  const stats = collectStats(payload);
  if (!stats.length) return null;

  const mapped = mapEspnStats(stats, options.season);
  const hasAnyValue = Object.entries(mapped).some(([key, value]) => key !== "season" && value !== null);

  return hasAnyValue ? mapped : null;
}

export function parseEspnAthleteId(espnUrl: string) {
  const match = espnUrl.match(/\/id\/(\d+)/);
  return match?.[1] ?? null;
}

async function fetchJson(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
      },
      signal: controller.signal
    });

    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function collectStats(input: unknown, path: string[] = []): CollectedStat[] {
  if (!input || typeof input !== "object") return [];

  if (Array.isArray(input)) {
    return input.flatMap((item) => collectStats(item, path));
  }

  const object = input as Record<string, unknown>;
  const currentPath = [...path];
  const pathLabel = getNodeLabel(object);
  if (pathLabel) currentPath.push(pathLabel);

  const isLeafStat =
    typeof object.name === "string" &&
    ("value" in object || "displayValue" in object || "displayValue" in object);

  const out: CollectedStat[] = [];

  if (isLeafStat) {
    const value =
      typeof object.value === "number" || typeof object.value === "string"
        ? object.value
        : typeof object.displayValue === "string"
          ? object.displayValue
          : null;

    out.push({
      path: currentPath,
      name: String(object.name),
      displayName: typeof object.displayName === "string" ? object.displayName : undefined,
      shortDisplayName: typeof object.shortDisplayName === "string" ? object.shortDisplayName : undefined,
      value
    });
  }

  for (const [key, value] of Object.entries(object)) {
    if (key === "value" || key === "displayValue" || key === "name" || key === "displayName" || key === "shortDisplayName") {
      continue;
    }

    if (value && typeof value === "object") {
      out.push(...collectStats(value, currentPath));
    }
  }

  return out;
}

function getNodeLabel(node: Record<string, unknown>) {
  for (const key of ["name", "displayName", "shortDisplayName", "label", "title"]) {
    if (typeof node[key] === "string" && node[key]) return String(node[key]);
  }
  return null;
}

function mapEspnStats(stats: CollectedStat[], season: number): EspnMappedStats {
  const mapped: EspnMappedStats = {
    season,
    games_played: null,
    starts: null,
    passing_yards: null,
    passing_tds: null,
    interceptions_thrown: null,
    rushing_attempts: null,
    rushing_yards: null,
    rushing_tds: null,
    receptions: null,
    receiving_yards: null,
    receiving_tds: null,
    total_touchdowns: null,
    tackles: null,
    sacks: null,
    interceptions: null,
    passes_defended: null,
    tackles_for_loss: null,
    forced_fumbles: null
  };

  for (const stat of stats) {
    const context = stat.path.map(normalizeKey).join(" ");
    const statName = [stat.name, stat.displayName, stat.shortDisplayName]
      .filter((value): value is string => typeof value === "string" && Boolean(value))
      .map(normalizeKey)
      .join(" ");
    const numericValue = toNumber(stat.value);
    if (numericValue === null) continue;

    if (matches(statName, ["gamesplayed", "games"]) && mapped.games_played === null) {
      mapped.games_played = numericValue;
      continue;
    }

    if (matches(statName, ["starts"]) && mapped.starts === null) {
      mapped.starts = numericValue;
      continue;
    }

    if (matches(statName, ["passingyards", "passyards"])) {
      mapped.passing_yards = numericValue;
      continue;
    }

    if (matches(statName, ["passingtouchdowns", "passtds", "tdpasses"])) {
      mapped.passing_tds = numericValue;
      continue;
    }

    if ((context.includes("passing") || statName.includes("passing")) && statName.includes("interception")) {
      mapped.interceptions_thrown = numericValue;
      continue;
    }

    if (matches(statName, ["rushingattempts", "carries"])) {
      mapped.rushing_attempts = numericValue;
      continue;
    }

    if (matches(statName, ["rushingyards", "rushyards"])) {
      mapped.rushing_yards = numericValue;
      continue;
    }

    if (matches(statName, ["rushingtouchdowns", "rushtds"])) {
      mapped.rushing_tds = numericValue;
      continue;
    }

    if (matches(statName, ["receptions"])) {
      mapped.receptions = numericValue;
      continue;
    }

    if (matches(statName, ["receivingyards", "recyards"])) {
      mapped.receiving_yards = numericValue;
      continue;
    }

    if (matches(statName, ["receivingtouchdowns", "rectds"])) {
      mapped.receiving_tds = numericValue;
      continue;
    }

    if (matches(statName, ["touchdowns", "totaltouchdowns", "totaltd"])) {
      mapped.total_touchdowns = numericValue;
      continue;
    }

    if (matches(statName, ["totaltackles", "tackles"])) {
      mapped.tackles = numericValue;
      continue;
    }

    if (matches(statName, ["sacks"])) {
      mapped.sacks = numericValue;
      continue;
    }

    if (!(context.includes("passing") || statName.includes("passing")) && matches(statName, ["interceptions", "ints"])) {
      mapped.interceptions = numericValue;
      continue;
    }

    if (matches(statName, ["passesdefended", "passesdefensed", "pd"])) {
      mapped.passes_defended = numericValue;
      continue;
    }

    if (matches(statName, ["tacklesforloss", "tfl"])) {
      mapped.tackles_for_loss = numericValue;
      continue;
    }

    if (matches(statName, ["forcedfumbles"])) {
      mapped.forced_fumbles = numericValue;
      continue;
    }
  }

  if (mapped.total_touchdowns === null) {
    const parts = [mapped.passing_tds, mapped.rushing_tds, mapped.receiving_tds].filter(
      (value): value is number => value !== null
    );
    mapped.total_touchdowns = parts.length ? parts.reduce((sum, value) => sum + value, 0) : null;
  }

  return mapped;
}

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function matches(statName: string, candidates: string[]) {
  return candidates.some((candidate) => statName.includes(candidate));
}

function toNumber(value: string | number | null) {
  if (value === null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  const trimmed = value.trim();
  if (!trimmed || trimmed === "--") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}
