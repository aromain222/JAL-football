export type ResolverSource = "espn" | "sports-reference" | "roster" | "unknown";

export interface PlayerIdentityInput {
  name: string;
  position: string;
  prev_school: string;
}

export interface ResolvedPlayerUrl {
  name: string;
  resolved_url: string | null;
  source?: ResolverSource;
  confidence: number;
  matched_team?: string | null;
  notes: string;
  // optional secondary url
  roster_url?: string | null;
  espn_url?: string | null;
}

export interface ResolverConfig {
  /** max search results to consider per query */
  maxCandidates?: number;
  /** sleep between network calls */
  delayMs?: number;
  /** User-Agent for fetches */
  userAgent?: string;
  /** log candidate count and top score (e.g. RESOLVE_DEBUG=1) */
  debug?: boolean;
  /** optional Brave Search API key; used when DuckDuckGo returns 0 results */
  braveApiKey?: string;
  /** confidence cutoffs for auto selection */
  espnMinConfidence?: number;
  rosterMinConfidence?: number;
}

/** Name safe for search (apostrophe → space so "Zah'eed" doesn't break queries). */
function searchName(name: string): string {
  return name.replace(/['']/g, " ").replace(/\s+/g, " ").trim();
}

export function buildSearchQueries(input: PlayerIdentityInput): string[] {
  const { name, position, prev_school } = input;
  const q = searchName(name);
  const base = [
    `${q} site:espn.com college football`,
    `${q} ${prev_school} football`,
    `${q} ${position} ${prev_school}`,
    `${q} ESPN`,
    `${q} college football stats`
  ];
  if (prev_school) base.push(`${q} ${prev_school} roster`);
  return base;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv|v)\b\.?/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSimilarity(a: string, b: string): number {
  const ta = new Set(norm(a).split(" ").filter(Boolean));
  const tb = new Set(norm(b).split(" ").filter(Boolean));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const union = ta.size + tb.size - inter;
  return union ? inter / union : 0;
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Last path segment with hyphens → spaces (e.g. "austin-bolt" → "austin bolt") for name matching. */
function getUrlPathSlug(url: string): string | null {
  try {
    const path = new URL(url).pathname;
    const segments = path.split("/").filter(Boolean);
    const last = segments[segments.length - 1];
    if (!last || last === "id" || /^\d+$/.test(last)) return null;
    return last.replace(/-/g, " ").trim();
  } catch {
    return null;
  }
}

export interface SearchCandidate {
  url: string;
  title: string;
  snippet?: string;
  domain: string;
}

/**
 * Fetch search candidates: try DuckDuckGo HTML, then Brave Search API if apiKey provided and DDG returns 0.
 */
export async function fetchSearchCandidates(query: string, cfg: ResolverConfig = {}): Promise<SearchCandidate[]> {
  let out: SearchCandidate[] = [];
  try {
    out = await fetchSearchCandidatesDuckDuckGo(query, cfg);
  } catch {
    out = [];
  }
  if (out.length === 0 && cfg.braveApiKey) {
    try {
      out = await fetchSearchCandidatesBrave(query, cfg);
    } catch {
      out = [];
    }
  }
  return out;
}

/**
 * DuckDuckGo HTML endpoint. Often returns 0 from server IPs (captcha/block).
 */
async function fetchSearchCandidatesDuckDuckGo(query: string, cfg: ResolverConfig = {}): Promise<SearchCandidate[]> {
  const max = cfg.maxCandidates ?? 10;
  const ua =
    cfg.userAgent ??
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

  const url = "https://html.duckduckgo.com/html/";
  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      "User-Agent": ua,
      Accept: "text/html,application/xhtml+xml",
      "Content-Type": "application/x-www-form-urlencoded",
      Referer: "https://html.duckduckgo.com/"
    },
    body: new URLSearchParams({ q: query })
  });
  if (!res) return [];
  if (!res.ok) return [];
  const html = await res.text();

  const out: SearchCandidate[] = [];
  const linkRe = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html)) && out.length < max) {
    const href = m[1];
    const title = stripHtml(m[2]);
    const decoded = decodeDuckDuckGoRedirect(href) ?? href;
    if (decoded.startsWith("http")) {
      out.push({ url: decoded, title, domain: domainOf(decoded) });
    }
  }

  if (out.length === 0) {
    const hrefRe = /<a[^>]+href="(https?:\/\/[^"]*(?:espn\.com|sports-reference\.com|\.edu\/[^"]*athletics[^"]*|sidearmsports\.com)[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    while ((m = hrefRe.exec(html)) && out.length < max) {
      const decoded = decodeDuckDuckGoRedirect(m[1]) ?? m[1];
      const domain = domainOf(decoded);
      if (domain && (domain.endsWith("espn.com") || domain.endsWith("sports-reference.com") || isLikelyRosterDomain(domain))) {
        out.push({ url: decoded, title: stripHtml(m[2]) || domain, domain });
      }
    }
  }

  return dedupeByUrl(out);
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number = 10000): Promise<Response | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Brave Search API (optional). Free tier ~2k/mo. Set BRAVE_API_KEY in .env.local. */
async function fetchSearchCandidatesBrave(query: string, cfg: ResolverConfig = {}): Promise<SearchCandidate[]> {
  const key = cfg.braveApiKey;
  if (!key) return [];
  const max = cfg.maxCandidates ?? 10;
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${max}`;
  const res = await fetchWithTimeout(
    url,
    { headers: { "X-Subscription-Token": key, Accept: "application/json" } },
    20000
  );
  if (!res) return [];
  if (!res.ok) return [];
  const data = (await res.json()) as { web?: { results?: Array<{ url: string; title: string; description?: string }> } };
  const results = data.web?.results ?? [];
  return results.slice(0, max).map((r) => ({
    url: r.url,
    title: r.title ?? "",
    snippet: r.description,
    domain: domainOf(r.url)
  }));
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeDuckDuckGoRedirect(href: string): string | null {
  try {
    const u = new URL(href);
    // DDG sometimes uses /l/?uddg=<encoded>
    const uddg = u.searchParams.get("uddg");
    if (uddg) return decodeURIComponent(uddg);
    return null;
  } catch {
    return null;
  }
}

function dedupeByUrl(items: SearchCandidate[]): SearchCandidate[] {
  const seen = new Set<string>();
  const out: SearchCandidate[] = [];
  for (const i of items) {
    const key = i.url.split("#")[0];
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(i);
  }
  return out;
}

export interface CandidateScore {
  candidate: SearchCandidate;
  confidence: number;
  notes: string[];
  source: ResolverSource;
}

export async function scoreCandidate(
  input: PlayerIdentityInput,
  candidate: SearchCandidate,
  cfg: ResolverConfig = {}
): Promise<CandidateScore> {
  const notes: string[] = [];
  let score = 0;

  // Domain weight
  const domain = candidate.domain;
  let source: ResolverSource = "unknown";
  if (domain.endsWith("espn.com")) {
    score += 0.2;
    source = "espn";
    notes.push("domain: espn (+0.2)");
  } else if (domain.endsWith("sports-reference.com")) {
    score += 0.15;
    source = "sports-reference";
    notes.push("domain: sports-reference (+0.15)");
  } else if (isLikelyRosterDomain(domain)) {
    score += 0.1;
    source = "roster";
    notes.push("domain: roster/athletics (+0.1)");
  }

  // ESPN/roster URL path often has name slug (e.g. /player/_/id/12345/austin-bolt)
  const pathSlug = getUrlPathSlug(candidate.url);
  if (pathSlug && (domain.endsWith("espn.com") || domain.endsWith("sports-reference.com"))) {
    const slugSim = tokenSimilarity(input.name, pathSlug);
    if (slugSim >= 0.9) {
      score += 0.35;
      notes.push("name: URL slug match (+0.35)");
    } else if (slugSim >= 0.7) {
      score += 0.2;
      notes.push("name: URL slug fuzzy (+0.2)");
    }
  }

  // Name match against title
  const simTitle = tokenSimilarity(input.name, candidate.title);
  if (simTitle >= 0.95) {
    score += 0.4;
    notes.push("name: exact-ish title (+0.4)");
  } else if (simTitle >= 0.6) {
    score += 0.2;
    notes.push("name: fuzzy title (+0.2)");
  } else if (simTitle >= 0.5) {
    score += 0.15;
    notes.push("name: weak title (+0.15)");
  }

  // School match against title/snippet (when we have prev_school)
  if (input.prev_school) {
    const schoolSim = Math.max(
      tokenSimilarity(input.prev_school, candidate.title),
      tokenSimilarity(input.prev_school, candidate.snippet ?? "")
    );
    if (schoolSim >= 0.8) {
      score += 0.3;
      notes.push("school: match (+0.3)");
    }
  }

  // Try to extract metadata from page (ESPN & roster are worth fetching)
  if (source === "espn" || source === "sports-reference" || source === "roster") {
    if (cfg.delayMs) await sleep(cfg.delayMs);
    const meta = await fetchAndExtractMetadata(candidate.url, cfg);
    if (meta.rejected) {
      score = Math.max(0, score - 0.3);
      notes.push(`rejected: ${meta.reason} (-0.3)`);
    } else {
      const nm = tokenSimilarity(input.name, meta.name ?? "");
      if (nm >= 0.95) {
        score += 0.4;
        notes.push("name: exact page (+0.4)");
      } else if (nm >= 0.6) {
        score += 0.2;
        notes.push("name: fuzzy page (+0.2)");
      }
      if (input.prev_school) {
        const sm = tokenSimilarity(input.prev_school, meta.team ?? "");
        if (sm >= 0.8) {
          score += 0.3;
          notes.push("school: page (+0.3)");
        } else if (meta.team && sm > 0 && sm < 0.4) {
          score = Math.max(0, score - 0.3);
          notes.push("school: mismatch (-0.3)");
        }
      }
      if (meta.position && tokenSimilarity(input.position, meta.position) >= 0.8) {
        score += 0.1;
        notes.push("position: page (+0.1)");
      }
    }
  }

  // Clamp
  score = Math.max(0, Math.min(1, score));
  return { candidate, confidence: score, notes, source };
}

function isLikelyRosterDomain(domain: string): boolean {
  return (
    domain.includes("athletics") ||
    domain.includes("sidearmsports.com") ||
    domain.endsWith(".edu") ||
    domain.includes("college") ||
    domain.includes("roster")
  );
}

export interface PageMetadata {
  name: string | null;
  team: string | null;
  position: string | null;
  class_year: string | null;
  rejected?: boolean;
  reason?: string;
}

export async function fetchAndExtractMetadata(url: string, cfg: ResolverConfig = {}): Promise<PageMetadata> {
  const ua =
    cfg.userAgent ??
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36";

  const res = await fetch(url, {
    headers: { "User-Agent": ua, Accept: "text/html,application/xhtml+xml" }
  });
  if (!res.ok) return { name: null, team: null, position: null, class_year: null, rejected: true, reason: `http ${res.status}` };
  const html = await res.text();

  // Reject obvious non-football
  const lower = html.toLowerCase();
  if (lower.includes("basketball") && !lower.includes("football")) {
    return { name: null, team: null, position: null, class_year: null, rejected: true, reason: "wrong sport" };
  }

  const ogTitle = matchMeta(html, "og:title");
  const title = ogTitle ?? matchTitle(html);
  const name = extractNameFromTitle(title);

  // ESPN pages often have team in og:description or in JSON scripts; keep best-effort
  const ogDesc = matchMeta(html, "og:description") ?? matchMeta(html, "description");
  const team = extractTeamFromText(ogDesc ?? title ?? "");
  const position = extractPositionFromText(ogDesc ?? "");
  const classYear = extractClassYearFromText(ogDesc ?? "");

  return {
    name,
    team,
    position,
    class_year: classYear
  };
}

function matchMeta(html: string, property: string): string | null {
  const re = new RegExp(`<meta[^>]+(?:property|name)=\"${escapeRe(property)}\"[^>]+content=\"([^\"]+)\"`, "i");
  const m = html.match(re);
  return m ? stripHtml(m[1]) : null;
}

function matchTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? stripHtml(m[1]) : null;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractNameFromTitle(title: string | null): string | null {
  if (!title) return null;
  // Common patterns: "Ajay Allen - College Football - ESPN" or "Ajay Allen - Football - Tulsa"
  const t = title.split("|")[0].trim();
  const parts = t.split(" - ").map((p) => p.trim());
  if (parts.length > 0 && parts[0].split(" ").length >= 2) return parts[0];
  return t;
}

function extractTeamFromText(text: string): string | null {
  const t = stripHtml(text);
  // Very heuristic; look for "Tulsa Golden Hurricane" or "Tulsa" near "college football"
  const m = t.match(/\b([A-Z][A-Za-z&.'-]+(?:\s+[A-Z][A-Za-z&.'-]+){0,3})\b/);
  return m ? m[1] : null;
}

function extractPositionFromText(text: string): string | null {
  const t = stripHtml(text).toLowerCase();
  const known = ["qb", "rb", "wr", "te", "ol", "dl", "de", "dt", "edge", "lb", "cb", "s", "k", "p"];
  for (const k of known) {
    const re = new RegExp(`\\b${k}\\b`, "i");
    if (re.test(t)) return k.toUpperCase();
  }
  return null;
}

function extractClassYearFromText(text: string): string | null {
  const t = stripHtml(text);
  const m = t.match(/\b(Freshman|Sophomore|Junior|Senior)\b/i);
  return m ? m[1] : null;
}

export async function resolvePlayerUrl(
  input: PlayerIdentityInput,
  cfg: ResolverConfig = {}
): Promise<ResolvedPlayerUrl> {
  const espnMin = cfg.espnMinConfidence ?? 0.55;
  const rosterMin = cfg.rosterMinConfidence ?? 0.5;
  const queries = buildSearchQueries(input);
  const candidates: SearchCandidate[] = [];
  // Run ESPN-focused query first when Brave is available so we get more ESPN links early
  const ordered =
    cfg.braveApiKey && queries[0].includes("site:espn.com")
      ? [queries[0], ...queries.slice(1)]
      : queries;
  for (const q of ordered) {
    if (cfg.delayMs) await sleep(cfg.delayMs);
    const results = await fetchSearchCandidates(q, cfg);
    for (const r of results) candidates.push(r);
  }

  // Prioritize preferred domains first
  const prioritized = dedupeByUrl(candidates).sort((a, b) => {
    const aw = domainWeight(a.domain);
    const bw = domainWeight(b.domain);
    return bw - aw;
  });

  const scored: CandidateScore[] = [];
  for (const c of prioritized.slice(0, cfg.maxCandidates ?? 20)) {
    const s = await scoreCandidate(input, c, cfg);
    scored.push(s);
  }
  scored.sort((a, b) => b.confidence - a.confidence);

  if (cfg.debug) {
    const best = scored[0];
    console.error(
      `[resolve] ${input.name}: candidates=${prioritized.length}, scored=${scored.length}, best=${best?.confidence.toFixed(2) ?? "none"} ${best?.candidate.domain ?? ""}`
    );
  }

  const best = scored[0];
  const espnBest = scored.find((s) => s.source === "espn") ?? null;
  const rosterBest = scored.find((s) => s.source === "roster") ?? null;

  // Selection rules from spec
  if (espnBest && espnBest.confidence >= espnMin) {
    return {
      name: input.name,
      resolved_url: espnBest.candidate.url,
      source: "espn",
      confidence: espnBest.confidence,
      matched_team: input.prev_school,
      notes: espnBest.notes.join("; "),
      espn_url: espnBest.candidate.url,
      roster_url: rosterBest?.candidate.url ?? null
    };
  }
  if (rosterBest && rosterBest.confidence >= rosterMin) {
    return {
      name: input.name,
      resolved_url: rosterBest.candidate.url,
      source: "roster",
      confidence: rosterBest.confidence,
      matched_team: input.prev_school,
      notes: rosterBest.notes.join("; "),
      espn_url: espnBest?.candidate.url ?? null,
      roster_url: rosterBest.candidate.url
    };
  }

  const conf = best?.confidence ?? 0.2;
  return {
    name: input.name,
    resolved_url: null,
    confidence: conf,
    notes: best ? `Top candidate ${best.candidate.domain} scored ${best.confidence.toFixed(2)}: ${best.notes.join("; ")}` : "No candidates",
    matched_team: input.prev_school
  };
}

function domainWeight(domain: string): number {
  if (domain.endsWith("espn.com")) return 3;
  if (domain.endsWith("sports-reference.com")) return 2;
  if (isLikelyRosterDomain(domain)) return 1;
  return 0;
}

