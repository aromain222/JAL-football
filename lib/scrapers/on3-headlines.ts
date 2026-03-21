/**
 * Parse On3 transfer portal "Update" headlines to extract previous school and player name.
 * Used to enrich Sportradar-synced players (who don't have previous_school from the API).
 *
 * Headlines are scraped from the wire page; link text looks like:
 * - "Washington signs former Troy running back Trey Cooley"
 * - "Rutgers Football lands Drake transfer linebacker Sean Allison"
 * - "Coastal Carolina transfer QB Tad Hudson commits to NC State"
 *
 * Respect On3's ToS and robots.txt; use sparingly (e.g. daily enrichment).
 */

export interface ParsedHeadline {
  /** Previous school (where they transferred from) */
  previousSchool: string;
  /** New school (where they committed), if in headline */
  newSchool?: string;
  /** Player name as extracted from headline */
  playerName: string;
}

const TEAM_SUFFIXES = / (Football|Basketball|Athletics|Sports)$/i;

/**
 * Normalize school name: remove " Football" etc., trim.
 */
function normalizeSchool(s: string): string {
  return s.replace(TEAM_SUFFIXES, "").trim();
}

/**
 * Parse headline text into previous school, optional new school, and player name.
 * Returns null if the headline doesn't match known patterns.
 */
export function parseTransferHeadline(headline: string): ParsedHeadline | null {
  const t = headline.trim();
  if (!t || t.length < 10) return null;

  // "X signs former Y ... Z" (player Z, previous Y, new X)
  const signsFormer = t.match(
    /^(.+?)\s+signs?\s+former\s+(.+?)\s+(?:running back|linebacker|quarterback|QB|RB|WR|TE|OL|OT|G|C|IOL|EDGE|DL|DT|DE|CB|S|SAF|DB|K|P|punter|kicker)\s+(.+)$/i
  );
  if (signsFormer) {
    const [, newSchool, previousSchool, playerName] = signsFormer;
    return {
      previousSchool: normalizeSchool(previousSchool),
      newSchool: normalizeSchool(newSchool),
      playerName: playerName.trim()
    };
  }

  // "X lands Y transfer ... Z" (player Z, previous Y, new X)
  const landsTransfer = t.match(
    /^(.+?)\s+lands?\s+(.+?)\s+transfer\s+(?:linebacker|running back|quarterback|QB|RB|WR|TE|OL|EDGE|DL|CB|S|DB|defensive back|etc\.?)\s+(.+)$/i
  );
  if (landsTransfer) {
    const [, newSchool, previousSchool, playerName] = landsTransfer;
    return {
      previousSchool: normalizeSchool(previousSchool),
      newSchool: normalizeSchool(newSchool),
      playerName: playerName.trim()
    };
  }

  // "Y transfer QB/RB/... Z commits to X"
  const commitsTo = t.match(
    /^(.+?)\s+transfer\s+(?:QB|RB|WR|TE|OL|OT|IOL|EDGE|DL|LB|CB|S|DB|defensive back|linebacker|running back|quarterback)\s+(.+?)\s+commits?\s+to\s+(.+)$/i
  );
  if (commitsTo) {
    const [, previousSchool, playerName, newSchool] = commitsTo;
    return {
      previousSchool: normalizeSchool(previousSchool),
      newSchool: normalizeSchool(newSchool),
      playerName: playerName.trim()
    };
  }

  // "Former Y ... Z signs with X" or "Y transfer Z commits to X" (shorter)
  const formerSigns = t.match(
    /^Former\s+(.+?)\s+(?:running back|linebacker|QB|RB|WR|TE|OL|EDGE|DL|CB|S|DB)\s+(.+?)\s+signs?\s+with\s+(.+)$/i
  );
  if (formerSigns) {
    const [, previousSchool, playerName, newSchool] = formerSigns;
    return {
      previousSchool: normalizeSchool(previousSchool),
      newSchool: normalizeSchool(newSchool),
      playerName: playerName.trim()
    };
  }

  return null;
}

/** Normalize for matching: lowercase, collapse spaces, remove Jr./II/III/Sr. */
export function normalizeNameForMatch(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\s+(jr\.?|sr\.?|iii?|iv|ii)$/i, "")
    .trim();
}

const WIRE_URL = "https://www.on3.com/transfer-portal/wire/football/2026/";
// On3 article link class (may change; fallback matches any transfer-related link text)
const LINK_TEXT_REGEX =
  /<a\s+[^>]*class="[^"]*TransferPortalArticle_articleLink__[^"]*"[^>]*>([^<]+)<\/a>/gi;
const FALLBACK_LINK_REGEX = /<a\s+[^>]*href="[^"]*\/news\/[^"]*"[^>]*>([^<]{20,120})<\/a>/gi;

/**
 * Fetch wire page HTML and extract transfer headline link texts.
 */
export async function fetchOn3WireHeadlines(): Promise<string[]> {
  const res = await fetch(WIRE_URL, {
    headers: { "User-Agent": "JAL-Football-Enrich/1.0 (transfer portal enrichment)" }
  });
  if (!res.ok) throw new Error(`On3 wire fetch failed: ${res.status}`);
  const html = await res.text();
  const headlines: string[] = [];
  const seen = new Set<string>();
  const add = (text: string) => {
    const t = text.trim();
    if (t.length > 15 && t.length < 200 && (t.includes("transfer") || t.includes("former") || t.includes("signs") || t.includes("commits")) && !seen.has(t)) {
      seen.add(t);
      headlines.push(t);
    }
  };
  let m: RegExpExecArray | null;
  LINK_TEXT_REGEX.lastIndex = 0;
  while ((m = LINK_TEXT_REGEX.exec(html)) !== null) add(m[1]);
  if (headlines.length === 0) {
    FALLBACK_LINK_REGEX.lastIndex = 0;
    while ((m = FALLBACK_LINK_REGEX.exec(html)) !== null) add(m[1]);
  }
  return headlines;
}
