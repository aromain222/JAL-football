export type RosterMappedStats = {
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

type FetchRosterOptions = {
  season: number;
  timeoutMs?: number;
};

type ParsedTable = {
  heading: string;
  headers: string[];
  rows: string[][];
};

export async function fetchRosterPlayerStats(
  rosterUrl: string,
  options: FetchRosterOptions
): Promise<RosterMappedStats | null> {
  const html = await fetchHtml(rosterUrl, options.timeoutMs ?? 15_000);
  if (!html) return null;

  const tables = parseHtmlTables(html);
  if (!tables.length) return null;

  const seasonRows = tables
    .map((table) => ({ table, row: pickSeasonRow(table, options.season) }))
    .filter((entry): entry is { table: ParsedTable; row: string[] } => Boolean(entry.row));

  if (!seasonRows.length) return null;

  const mapped = seasonRows.reduce<RosterMappedStats>(
    (acc, entry) => mergeStats(acc, mapTableRow(entry.table, entry.row, options.season)),
    emptyStats(options.season)
  );

  const hasAny = Object.entries(mapped).some(([key, value]) => key !== "season" && value !== null);
  return hasAny ? mapped : null;
}

async function fetchHtml(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
      },
      signal: controller.signal
    });

    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function parseHtmlTables(html: string): ParsedTable[] {
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "");

  const tableMatches = [...cleaned.matchAll(/<table[\s\S]*?<\/table>/gi)];
  return tableMatches
    .map((match) => {
      const tableHtml = match[0];
      const heading = getNearestHeading(cleaned, match.index ?? 0);
      const rows = [...tableHtml.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((rowMatch) =>
        [...rowMatch[0].matchAll(/<(th|td)[^>]*>([\s\S]*?)<\/\1>/gi)].map((cellMatch) =>
          cleanCell(cellMatch[2])
        )
      );

      const nonEmptyRows = rows.filter((row) => row.some(Boolean));
      if (nonEmptyRows.length < 2) return null;

      const headers = normalizeHeaders(nonEmptyRows[0]);
      const dataRows = nonEmptyRows.slice(1).filter((row) => row.length > 1);

      if (!headers.length || !dataRows.length) return null;

      return {
        heading,
        headers,
        rows: dataRows
      };
    })
    .filter((table): table is ParsedTable => Boolean(table));
}

function getNearestHeading(html: string, tableIndex: number) {
  const slice = html.slice(Math.max(0, tableIndex - 4000), tableIndex);
  const headings = [...slice.matchAll(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi)];
  const last = headings[headings.length - 1];
  return last ? cleanCell(last[1]) : "";
}

function cleanCell(value: string) {
  return decodeEntities(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function decodeEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&ndash;/g, "-")
    .replace(/&mdash;/g, "-");
}

function normalizeHeaders(headers: string[]) {
  return headers.map((header) =>
    header
      .toLowerCase()
      .replace(/[^a-z0-9]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function pickSeasonRow(table: ParsedTable, targetSeason: number) {
  const seasonIndex = table.headers.findIndex((header) => /season|year/.test(header));

  if (seasonIndex >= 0) {
    const exact = table.rows.find((row) => row[seasonIndex]?.includes(String(targetSeason)));
    if (exact) return exact;

    const numericRows = table.rows
      .map((row) => ({ row, season: parseInt(row[seasonIndex] ?? "", 10) }))
      .filter((entry) => Number.isFinite(entry.season))
      .sort((a, b) => b.season - a.season);

    return numericRows[0]?.row ?? null;
  }

  const latestYearMatch = table.heading.match(/20\d{2}/g);
  if (latestYearMatch?.includes(String(targetSeason))) {
    return table.rows[0] ?? null;
  }

  return table.rows[0] ?? null;
}

function mapTableRow(table: ParsedTable, row: string[], season: number): RosterMappedStats {
  const out = emptyStats(season);
  const context = `${table.heading} ${table.headers.join(" ")}`.toLowerCase();
  const values = table.headers.map((header, index) => ({ header, value: row[index] ?? "" }));

  for (const entry of values) {
    const key = entry.header;
    const value = toNumber(entry.value);
    if (value === null) continue;

    if (matches(key, ["gp", "games", "games played"])) {
      out.games_played = value;
      continue;
    }

    if (matches(key, ["gs", "starts"])) {
      out.starts = value;
      continue;
    }

    if (contextIncludes(context, ["passing", "pass", "cmp", "att"])) {
      if (matches(key, ["yds", "yards", "pass yds", "passing yards"])) out.passing_yards = value;
      if (matches(key, ["td", "pass td", "passing touchdowns"])) out.passing_tds = value;
      if (matches(key, ["int", "interceptions"])) out.interceptions_thrown = value;
      continue;
    }

    if (contextIncludes(context, ["rushing", "rush", "carries"])) {
      if (matches(key, ["att", "carries"])) out.rushing_attempts = value;
      if (matches(key, ["yds", "yards", "rush yds", "rushing yards"])) out.rushing_yards = value;
      if (matches(key, ["td", "rush td", "rushing touchdowns"])) out.rushing_tds = value;
      continue;
    }

    if (contextIncludes(context, ["receiving", "rec", "receptions"])) {
      if (matches(key, ["rec", "receptions"])) out.receptions = value;
      if (matches(key, ["yds", "yards", "rec yds", "receiving yards"])) out.receiving_yards = value;
      if (matches(key, ["td", "rec td", "receiving touchdowns"])) out.receiving_tds = value;
      continue;
    }

    if (contextIncludes(context, ["defensive", "defense", "tackles", "pbu", "pd", "sacks"])) {
      if (matches(key, ["tkl", "tkls", "tot", "total tackles", "tackles"])) out.tackles = value;
      if (matches(key, ["sack", "sacks"])) out.sacks = value;
      if (matches(key, ["int", "ints", "interceptions"])) out.interceptions = value;
      if (matches(key, ["pbu", "pd", "passes defended", "pass breakups"])) out.passes_defended = value;
      if (matches(key, ["tfl", "tackles for loss"])) out.tackles_for_loss = value;
      if (matches(key, ["ff", "forced fumbles"])) out.forced_fumbles = value;
      continue;
    }
  }

  if (out.total_touchdowns === null) {
    const parts = [out.passing_tds, out.rushing_tds, out.receiving_tds].filter(
      (value): value is number => value !== null
    );
    out.total_touchdowns = parts.length ? parts.reduce((sum, value) => sum + value, 0) : null;
  }

  return out;
}

function emptyStats(season: number): RosterMappedStats {
  return {
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
}

function mergeStats(base: RosterMappedStats, patch: RosterMappedStats) {
  const merged = { ...base };

  for (const [key, value] of Object.entries(patch) as Array<[keyof RosterMappedStats, number | null]>) {
    if (key === "season") continue;
    if (value !== null && merged[key] === null) {
      merged[key] = value as never;
    }
  }

  if (merged.total_touchdowns === null) {
    const parts = [merged.passing_tds, merged.rushing_tds, merged.receiving_tds].filter(
      (value): value is number => value !== null
    );
    merged.total_touchdowns = parts.length ? parts.reduce((sum, value) => sum + value, 0) : null;
  }

  return merged;
}

function contextIncludes(context: string, terms: string[]) {
  return terms.some((term) => context.includes(term));
}

function matches(header: string, aliases: string[]) {
  return aliases.some((alias) => header === alias || header.includes(alias));
}

function toNumber(value: string) {
  const cleaned = value.replace(/,/g, "").trim();
  if (!cleaned || cleaned === "--") return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}
