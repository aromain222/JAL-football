/**
 * Parse pro day result pages (e.g. On3 articles) for 40 time, arm length, vertical, shuttle.
 * Pages often have markdown or HTML tables: Athlete | HT | WT | 40 | VJ | ...
 *
 * Use with a curated list of URLs (see pro-day-urls.ts) since there's no single index.
 */

export interface ProDayRow {
  name: string;
  forty_time: number | null;
  arm_length_in: number | null;
  vertical_jump: number | null;
  shuttle_time: number | null;
  height_in: number | null;
  weight_lbs: number | null;
}

/** Normalize player name for matching: lowercase, collapse spaces, remove suffix. */
export function normalizeNameForMatch(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\s+(jr\.?|sr\.?|iii?|iv|ii)$/i, "")
    .replace(/[′'`]/g, "'")
    .trim();
}

/** Parse height string like "6′ 2.4″" or "6-2" to inches. */
function parseHeightIn(s: string): number | null {
  if (!s?.trim()) return null;
  const t = s.trim();
  const feetInch = t.match(/(\d+)[′'\-]\s*(\d+(?:\.\d+)?)/);
  if (feetInch) {
    const feet = parseInt(feetInch[1], 10);
    const inch = parseFloat(feetInch[2]);
    return feet * 12 + inch;
  }
  const totalInch = t.match(/(\d+(?:\.\d+)?)\s*["″]/);
  if (totalInch) return parseFloat(totalInch[1]);
  return null;
}

/** Parse weight string like "216lbs" or "216" to number. */
function parseWeightLbs(s: string): number | null {
  if (!s?.trim()) return null;
  const m = s.replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}

/** Parse 40 time "4.86" or "4.41". */
function parseForty(s: string): number | null {
  if (!s?.trim() || s === "–" || s === "-") return null;
  const m = s.match(/(\d)\.(\d{2})/);
  if (m) return parseFloat(`${m[1]}.${m[2]}`);
  return null;
}

/** Parse vertical jump "29 1/2″" or "42″" to inches. */
function parseVerticalIn(s: string): number | null {
  if (!s?.trim() || s === "–" || s === "-") return null;
  const half = s.match(/(\d+)\s*1\/2\s*["″]?/);
  if (half) return parseInt(half[1], 10) + 0.5;
  const m = s.match(/(\d+(?:\.\d+)?)\s*["″]?/);
  return m ? parseFloat(m[1]) : null;
}

/** Parse shuttle "4.20" or "3.98". */
function parseShuttle(s: string): number | null {
  if (!s?.trim() || s === "–" || s === "-") return null;
  const m = s.match(/(\d\.\d{2})/);
  return m ? parseFloat(m[1]) : null;
}

/** Parse arm length "33 1/2" or "33.5" to inches. */
function parseArmIn(s: string): number | null {
  if (!s?.trim() || s === "–" || s === "-") return null;
  const half = s.match(/(\d+)\s*1\/2/);
  if (half) return parseInt(half[1], 10) + 0.5;
  const m = s.match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}

/**
 * Parse markdown-style table text (e.g. from On3 article). Detects header row to find
 * column indices for Athlete/Name, 40, Arm, VJ, 20SH/shuttle, HT, WT.
 */
export function parseProDayTableFromMarkdown(markdownOrHtml: string): ProDayRow[] {
  const lines = markdownOrHtml.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const rows: ProDayRow[] = [];
  let nameIdx = -1;
  let fortyIdx = -1;
  let armIdx = -1;
  let vjIdx = -1;
  let shuttleIdx = -1;
  let htIdx = -1;
  let wtIdx = -1;
  let headerDone = false;

  for (const line of lines) {
    const cells = line.split(/\|/).map((c) => c.trim()).filter((c) => c.length > 0);
    if (cells.length < 2) continue;

    const isHeader = cells.some((c) => /^\s*[-–—]+\s*$/.test(c)) || !headerDone;
    if (isHeader && !headerDone) {
      const lower = cells.map((c) => c.toLowerCase());
      nameIdx = lower.findIndex((c) => c.includes("athlete") || c === "name" || c === "player");
      fortyIdx = lower.findIndex((c) => c === "40" || c.includes("40"));
      armIdx = lower.findIndex((c) => c.includes("arm"));
      vjIdx = lower.findIndex((c) => c === "vj" || c.includes("vertical"));
      shuttleIdx = lower.findIndex((c) => c === "20sh" || c.includes("shuttle") || c === "20");
      htIdx = lower.findIndex((c) => c === "ht" || c.includes("height"));
      wtIdx = lower.findIndex((c) => c === "wt" || c.includes("weight"));
      if (nameIdx >= 0) headerDone = true;
      continue;
    }

    if (nameIdx < 0) continue;
    const nameRaw = cells[nameIdx] ?? "";
    const name = nameRaw.replace(/\[.*?\]\(.*?\)/g, "").trim();
    if (!name || name.length < 2) continue;

    rows.push({
      name,
      forty_time: fortyIdx >= 0 ? parseForty(cells[fortyIdx] ?? "") : null,
      arm_length_in: armIdx >= 0 ? parseArmIn(cells[armIdx] ?? "") : null,
      vertical_jump: vjIdx >= 0 ? parseVerticalIn(cells[vjIdx] ?? "") : null,
      shuttle_time: shuttleIdx >= 0 ? parseShuttle(cells[shuttleIdx] ?? "") : null,
      height_in: htIdx >= 0 ? parseHeightIn(cells[htIdx] ?? "") : null,
      weight_lbs: wtIdx >= 0 ? parseWeightLbs(cells[wtIdx] ?? "") : null
    });
  }

  return rows;
}

/**
 * Parse HTML table: find <table>, <tr>, <td>/<th>, build rows of cell text.
 */
function parseHtmlTableToRows(html: string): string[][] {
  const rows: string[][] = [];
  const tableMatch = html.match(/<table[^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch) return rows;
  const tableBody = tableMatch[1];
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let tr: RegExpExecArray | null;
  while ((tr = trRegex.exec(tableBody)) !== null) {
    const cellRegex = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi;
    const cells: string[] = [];
    let cell: RegExpExecArray | null;
    while ((cell = cellRegex.exec(tr[1])) !== null) {
      cells.push(cell[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim());
    }
    if (cells.length) rows.push(cells);
  }
  return rows;
}

/**
 * Parse table (markdown or HTML) into ProDayRow[].
 */
function parseTableToProDayRows(text: string): ProDayRow[] {
  if (text.includes("<table") && text.includes("</table>")) {
    const rows = parseHtmlTableToRows(text);
    if (rows.length >= 2) {
      const header = rows[0].map((c) => c.toLowerCase());
      const nameIdx = header.findIndex((c) => c.includes("athlete") || c === "name" || c.includes("player"));
      const fortyIdx = header.findIndex((c) => c === "40" || c.includes("40"));
      const armIdx = header.findIndex((c) => c.includes("arm"));
      const vjIdx = header.findIndex((c) => c === "vj" || c.includes("vertical"));
      const shuttleIdx = header.findIndex((c) => c === "20sh" || c.includes("shuttle"));
      const htIdx = header.findIndex((c) => c === "ht" || c.includes("height"));
      const wtIdx = header.findIndex((c) => c === "wt" || c.includes("weight"));
      if (nameIdx >= 0) {
        const out: ProDayRow[] = [];
        for (let i = 1; i < rows.length; i++) {
          const c = rows[i];
          const name = (c[nameIdx] ?? "").trim();
          if (name.length < 2) continue;
          out.push({
            name,
            forty_time: fortyIdx >= 0 ? parseForty(c[fortyIdx] ?? "") : null,
            arm_length_in: armIdx >= 0 ? parseArmIn(c[armIdx] ?? "") : null,
            vertical_jump: vjIdx >= 0 ? parseVerticalIn(c[vjIdx] ?? "") : null,
            shuttle_time: shuttleIdx >= 0 ? parseShuttle(c[shuttleIdx] ?? "") : null,
            height_in: htIdx >= 0 ? parseHeightIn(c[htIdx] ?? "") : null,
            weight_lbs: wtIdx >= 0 ? parseWeightLbs(c[wtIdx] ?? "") : null
          });
        }
        return out;
      }
    }
  }
  return parseProDayTableFromMarkdown(text);
}

/**
 * Fetch a pro day article URL and parse table from the response.
 */
export async function fetchAndParseProDayPage(url: string): Promise<ProDayRow[]> {
  const res = await fetch(url, {
    headers: { "User-Agent": "JAL-Football-Enrich/1.0 (measurables)" }
  });
  if (!res.ok) throw new Error(`Pro day fetch failed ${res.status}: ${url}`);
  const text = await res.text();
  return parseTableToProDayRows(text);
}
