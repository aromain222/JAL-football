import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import ExcelJS from "exceljs";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PFF_SEASON = Number(process.env.PFF_SEASON ?? 2025);

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type PffRow = Database["public"]["Tables"]["player_pff_grades"]["Row"];
type JsonResponseArtifact = {
  url: string;
  status: number;
  contentType: string | null;
  body: unknown;
};

type PffSearchPlayer = {
  current_eligible_year: number | null;
  first_name: string;
  height: number | null;
  id: number;
  last_name: string;
  position: string | null;
  team?: {
    abbreviation?: string | null;
    city?: string | null;
    nickname?: string | null;
    slug?: string | null;
  } | null;
  weight: number | null;
};

type ResolvedPlayer = {
  candidateCount: number;
  id: number;
  matchReason: string;
  player: PffSearchPlayer;
  slug: string;
};

const POSITION_PRIMARY_GRADE_KEYS: Record<string, Array<keyof PffRow>> = {
  QB: ["grades_overall", "grades_pass", "grades_offense"],
  RB: ["grades_overall", "grades_run_rb", "grades_offense", "grades_pass_route"],
  WR: ["grades_overall", "grades_pass_route", "grades_offense"],
  TE: ["grades_overall", "grades_pass_route", "grades_run_block", "grades_offense"],
  OL: ["grades_overall", "grades_pass_block", "grades_run_block"],
  EDGE: ["grades_overall", "grades_pass_rush", "grades_run_defense_dl", "grades_defense"],
  DL: ["grades_overall", "grades_run_defense_dl", "grades_pass_rush", "grades_defense"],
  LB: ["grades_overall", "grades_coverage_lb", "grades_run_defense_lb", "grades_tackle", "grades_defense"],
  CB: ["grades_overall", "grades_coverage_db", "grades_tackle_db", "grades_defense"],
  S: ["grades_overall", "grades_coverage_db", "grades_tackle_db", "grades_defense"],
};

const COLUMN_PATTERNS: Array<{ column: keyof PffRow; patterns: RegExp[] }> = [
  { column: "grades_overall", patterns: [/\boverall\b/, /\boverall[_\s-]*grade\b/] },
  { column: "grades_offense", patterns: [/\boffense\b/, /\boffensive\b/] },
  { column: "grades_defense", patterns: [/\bdefense\b/, /\bdefensive\b/] },
  { column: "grades_pass", patterns: [/\bpassing\b/, /\bpass[_\s-]*grade\b/] },
  { column: "grades_pass_route", patterns: [/\broute\b/, /\breceiving[_\s-]*grade\b/, /\broute[_\s-]*grade\b/] },
  { column: "grades_run_rb", patterns: [/\brun[_\s-]*grade\b/, /\brushing[_\s-]*grade\b/] },
  { column: "grades_pass_block", patterns: [/\bpass[_\s-]*block\b/] },
  { column: "grades_run_block", patterns: [/\brun[_\s-]*block\b/, /\bblock[_\s-]*grade\b/] },
  { column: "grades_pass_rush", patterns: [/\bpass[_\s-]*rush\b/] },
  { column: "grades_run_defense_dl", patterns: [/\brun[_\s-]*def(ense)?\b/, /\brun[_\s-]*stop/i] },
  { column: "grades_run_defense_lb", patterns: [/\brun[_\s-]*def(ense)?\b/, /\brun[_\s-]*stop/i] },
  { column: "grades_coverage_db", patterns: [/\bcoverage\b/] },
  { column: "grades_coverage_lb", patterns: [/\bcoverage\b/] },
  { column: "grades_tackle", patterns: [/\btackle\b/, /\btackling\b/] },
  { column: "grades_tackle_db", patterns: [/\btackle\b/, /\btackling\b/] },
  { column: "stats_targets", patterns: [/\btargets?\b/, /\btgts\b/] },
  { column: "stats_receptions", patterns: [/\breceptions?\b/, /\brec\b/] },
  { column: "stats_receiving_yards", patterns: [/\breceiving[_\s-]*yards?\b/, /\brec[_\s-]*yds?\b/, /\byds\b/] },
  { column: "stats_receiving_tds", patterns: [/\breceiving[_\s-]*tds?\b/, /\btds\b/] },
  { column: "stats_yards_per_route_run", patterns: [/\by\/rr\b/, /\byards[_\s-]*per[_\s-]*route[_\s-]*run\b/, /\byprr\b/] },
  { column: "stats_attempts", patterns: [/\battempts?\b/, /\batt\b/] },
  { column: "stats_completions", patterns: [/\bcompletions?\b/, /\bcomp\b/] },
  { column: "stats_passing_yards", patterns: [/\bpassing[_\s-]*yards?\b/] },
  { column: "stats_passing_tds", patterns: [/\bpassing[_\s-]*tds?\b/] },
  { column: "stats_interceptions", patterns: [/\bints?\b/, /\binterceptions?\b/] },
  { column: "stats_carries", patterns: [/\bcarries\b/] },
  { column: "stats_rushing_yards", patterns: [/\brushing[_\s-]*yards?\b/] },
  { column: "stats_rushing_tds", patterns: [/\brushing[_\s-]*tds?\b/] },
  { column: "stats_pressures", patterns: [/\bpressures\b/] },
  { column: "stats_sacks", patterns: [/\bsacks?\b/] },
  { column: "stats_hits", patterns: [/\bhits?\b/] },
  { column: "stats_hurries", patterns: [/\bhurries\b/] },
  { column: "stats_run_stops", patterns: [/\brun[_\s-]*stops?\b/] },
  { column: "stats_tackles", patterns: [/\btackles\b/] },
  { column: "stats_assists", patterns: [/\bassists\b/] },
  { column: "stats_pass_breakups", patterns: [/\bpbu\b/, /\bpass[_\s-]*breakups?\b/] },
  { column: "stats_targets_allowed", patterns: [/\btargets?[_\s-]*allow(ed)?\b/] },
  { column: "stats_receptions_allowed", patterns: [/\breceptions?[_\s-]*allow(ed)?\b/, /\brec[_\s-]*allow\b/] },
  { column: "stats_yards_allowed", patterns: [/\byards?[_\s-]*allow(ed)?\b/, /\byds[_\s-]*allow\b/] },
  { column: "stats_tds_allowed", patterns: [/\btds?[_\s-]*allow(ed)?\b/] },
  { column: "stats_passer_rating_allowed", patterns: [/\bqbr[_\s-]*allow\b/, /\bpasser[_\s-]*rating[_\s-]*allow(ed)?\b/] },
];

const WEEK_RANGE = "0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20";
const APPLE_SCRIPT_PATH = path.join(os.tmpdir(), "jal-pff-live-tab.applescript");

function getArg(flag: string): string | null {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 ? (process.argv[idx + 1] ?? null) : null;
}

const dateStamp = new Date().toISOString().slice(0, 10);
const seasonArg = getArg("--season");
const season = seasonArg ? Number(seasonArg) : PFF_SEASON;
const limitArg = getArg("--limit");
const LIMIT = limitArg ? Number(limitArg) : undefined;
const APPLY = process.argv.includes("--apply");
const outDir = path.resolve(getArg("--out") ?? path.join("data", "pff", "grade-enrichment", dateStamp, "chrome-live"));

function hasPrimaryGrade(row: PffRow): boolean {
  const keys = POSITION_PRIMARY_GRADE_KEYS[row.position ?? ""] ?? ["grades_overall"];
  return keys.some((key) => row[key] != null);
}

function normalizeLabel(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[,%]/g, "").trim();
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function flattenJson(input: unknown, base = "", out: Array<{ path: string; value: unknown }> = []) {
  if (Array.isArray(input)) {
    input.forEach((item, index) => flattenJson(item, `${base}[${index}]`, out));
    return out;
  }

  if (input && typeof input === "object") {
    for (const [key, value] of Object.entries(input)) {
      const next = base ? `${base}.${key}` : key;
      flattenJson(value, next, out);
    }
    return out;
  }

  out.push({ path: base, value: input });
  return out;
}

function pickFromArtifacts(
  target: PffRow,
  artifacts: JsonResponseArtifact[],
  bodyText: string
): Partial<PffRow> {
  const flatEntries = artifacts.flatMap((artifact) => flattenJson(artifact.body).map((entry) => ({ ...entry, source: artifact.url })));
  const updates: Partial<PffRow> = {};

  for (const mapping of COLUMN_PATTERNS) {
    for (const entry of flatEntries) {
      const haystack = normalizeLabel(`${entry.path} ${entry.source}`);
      if (!mapping.patterns.some((pattern) => pattern.test(haystack))) continue;
      const numeric = toNumber(entry.value);
      if (numeric == null) continue;
      if (numeric < 0) continue;
      if (String(mapping.column).startsWith("grades_") && numeric > 100) continue;
      updates[mapping.column] = numeric as never;
      break;
    }
  }

  const textPatterns: Array<{ column: keyof PffRow; regexes: RegExp[] }> = [
    { column: "grades_overall", regexes: [/\boverall(?: grade)?\s+(\d{1,2}(?:\.\d)?)/i] },
    { column: "grades_offense", regexes: [/\boffense(?: grade)?\s+(\d{1,2}(?:\.\d)?)/i] },
    { column: "grades_defense", regexes: [/\bdefense(?: grade)?\s+(\d{1,2}(?:\.\d)?)/i] },
    { column: "grades_pass", regexes: [/\bpassing(?: grade)?\s+(\d{1,2}(?:\.\d)?)/i] },
    { column: "grades_pass_route", regexes: [/\broute(?: grade)?\s+(\d{1,2}(?:\.\d)?)/i, /\breceiving(?: grade)?\s+(\d{1,2}(?:\.\d)?)/i] },
    { column: "grades_run_rb", regexes: [/\brun(?: grade)?\s+(\d{1,2}(?:\.\d)?)/i] },
    { column: "grades_pass_rush", regexes: [/\bpass rush(?: grade)?\s+(\d{1,2}(?:\.\d)?)/i] },
    { column: "grades_coverage_db", regexes: [/\bcoverage(?: grade)?\s+(\d{1,2}(?:\.\d)?)/i] },
    { column: "grades_coverage_lb", regexes: [/\bcoverage(?: grade)?\s+(\d{1,2}(?:\.\d)?)/i] },
    { column: "grades_run_block", regexes: [/\brun block(?: grade)?\s+(\d{1,2}(?:\.\d)?)/i, /\bblock(?: grade)?\s+(\d{1,2}(?:\.\d)?)/i] },
    { column: "grades_pass_block", regexes: [/\bpass block(?: grade)?\s+(\d{1,2}(?:\.\d)?)/i] },
    { column: "grades_tackle", regexes: [/\btackle(?: grade)?\s+(\d{1,2}(?:\.\d)?)/i] },
    { column: "grades_tackle_db", regexes: [/\btackle(?: grade)?\s+(\d{1,2}(?:\.\d)?)/i] },
  ];

  for (const mapping of textPatterns) {
    if (updates[mapping.column] != null) continue;
    for (const regex of mapping.regexes) {
      const match = bodyText.match(regex);
      if (!match) continue;
      const value = toNumber(match[1]);
      if (value == null) continue;
      updates[mapping.column] = value as never;
      break;
    }
  }

  if (target.position === "CB" && updates.grades_coverage_db != null && updates.grades_defense == null) {
    updates.grades_defense = updates.grades_coverage_db;
  }
  if (target.position === "S" && updates.grades_coverage_db != null && updates.grades_defense == null) {
    updates.grades_defense = updates.grades_coverage_db;
  }
  if (target.position === "LB" && updates.grades_coverage_lb != null && updates.grades_defense == null) {
    updates.grades_defense = updates.grades_coverage_lb;
  }
  if ((target.position === "DL" || target.position === "EDGE") && updates.grades_run_defense_dl != null && updates.grades_defense == null) {
    updates.grades_defense = updates.grades_run_defense_dl;
  }
  if (target.position === "WR" && updates.grades_pass_route != null && updates.grades_offense == null) {
    updates.grades_offense = updates.grades_pass_route;
  }

  return updates;
}

async function getTargets(): Promise<PffRow[]> {
  const { data, error } = await supabase
    .from("player_pff_grades")
    .select("*")
    .eq("season", season)
    .order("position")
    .order("player_name");

  if (error || !data) {
    throw new Error(`Failed to fetch player_pff_grades: ${error?.message ?? "unknown error"}`);
  }

  const targets = (data as PffRow[]).filter((row) => !hasPrimaryGrade(row));
  return LIMIT ? targets.slice(0, LIMIT) : targets;
}

function ensureAppleScript() {
  if (fs.existsSync(APPLE_SCRIPT_PATH)) return;

  fs.writeFileSync(
    APPLE_SCRIPT_PATH,
    [
      "on run argv",
      "  set jsSource to item 1 of argv",
      "  tell application \"Google Chrome\"",
      "    repeat with wi from 1 to count of windows",
      "      set w to window wi",
      "      repeat with ti from 1 to count of tabs of w",
      "        set t to tab ti of w",
      "        set u to URL of t",
      "        if u contains \"premium.pff.com\" then",
      "          set active tab index of w to ti",
      "          set index of w to 1",
      "          return execute t javascript jsSource",
      "        end if",
      "      end repeat",
      "    end repeat",
      "  end tell",
      "  error \"No premium.pff.com tab found in Google Chrome\"",
      "end run",
      "",
    ].join("\n")
  );
}

function execChromeJs<T = unknown>(jsSource: string): T {
  ensureAppleScript();
  const raw = execFileSync("/usr/bin/osascript", [APPLE_SCRIPT_PATH, jsSource], {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  }).trim();
  return JSON.parse(raw) as T;
}

function getPremiumTabState() {
  return execChromeJs<{ url: string; title: string; hasUnlock: boolean; hasSignIn: boolean }>(`
    (() => {
      const text = document.body.innerText;
      return JSON.stringify({
        url: location.href,
        title: document.title,
        hasUnlock: /UNLOCK PFF\\+/i.test(text),
        hasSignIn: /SIGN IN/i.test(text)
      });
    })();
  `);
}

function fetchPremiumJson(url: string): JsonResponseArtifact {
  const result = execChromeJs<{ status?: number; text?: string; error?: string }>(`
    (() => {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open("GET", ${JSON.stringify(url)}, false);
        xhr.send(null);
        return JSON.stringify({
          status: xhr.status,
          text: xhr.responseText
        });
      } catch (error) {
        return JSON.stringify({
          error: String(error)
        });
      }
    })();
  `);

  if (result.error) {
    throw new Error(`Chrome premium fetch failed for ${url}: ${result.error}`);
  }

  const text = result.text ?? "";
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    // Keep raw text for non-JSON errors.
  }

  return {
    url,
    status: result.status ?? 0,
    contentType: typeof body === "object" ? "application/json" : "text/plain",
    body,
  };
}

function normalizeString(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/['’.(),]/g, "")
    .replace(/&/g, " and ")
    .replace(/\bjunior\b/g, "jr")
    .replace(/\bsenior\b/g, "sr")
    .replace(/\bsaint\b/g, "st")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getPositionFamily(value: string | null | undefined): string | null {
  const normalized = normalizeString(value);
  if (!normalized) return null;
  if (["qb"].includes(normalized)) return "QB";
  if (["rb", "hb", "fb"].includes(normalized)) return "RB";
  if (["wr"].includes(normalized)) return "WR";
  if (["te"].includes(normalized)) return "TE";
  if (["c", "g", "t", "ot", "og", "ol"].includes(normalized)) return "OL";
  if (["edge", "de", "ed", "olb"].includes(normalized)) return "EDGE";
  if (["dt", "nt", "di", "dl"].includes(normalized)) return "DL";
  if (["lb", "ilb", "mlb", "will", "sam"].includes(normalized)) return "LB";
  if (["cb"].includes(normalized)) return "CB";
  if (["s", "ss", "fs"].includes(normalized)) return "S";
  return normalized.toUpperCase();
}

function scoreCandidate(target: PffRow, candidate: PffSearchPlayer) {
  const targetName = normalizeString(target.player_name);
  const candidateName = normalizeString(`${candidate.first_name} ${candidate.last_name}`);
  const targetTeam = normalizeString(target.team_name);
  const teamFields = [
    candidate.team?.city,
    candidate.team?.nickname,
    candidate.team?.slug,
    candidate.team?.abbreviation,
    [candidate.team?.city, candidate.team?.nickname].filter(Boolean).join(" "),
  ].map((value) => normalizeString(value));

  const targetFamily = getPositionFamily(target.position);
  const candidateFamily = getPositionFamily(candidate.position);

  let score = 0;
  const reasons: string[] = [];

  if (candidateName === targetName) {
    score += 100;
    reasons.push("exact-name");
  } else if (candidateName.includes(targetName) || targetName.includes(candidateName)) {
    score += 70;
    reasons.push("partial-name");
  }

  if (targetFamily && candidateFamily && targetFamily === candidateFamily) {
    score += 30;
    reasons.push("position");
  }

  if (targetTeam) {
    const exactTeam = teamFields.find((value) => value === targetTeam);
    const looseTeam = teamFields.find((value) => value && (value.includes(targetTeam) || targetTeam.includes(value)));
    if (exactTeam) {
      score += 40;
      reasons.push("team");
    } else if (looseTeam) {
      score += 20;
      reasons.push("team-loose");
    }
  }

  return { score, reason: reasons.join("+") || "fallback" };
}

function resolvePlayer(target: PffRow): ResolvedPlayer {
  const searchUrl = `https://premium.pff.com/api/v1/players?league=ncaa&name=${encodeURIComponent(target.player_name)}`;
  const searchArtifact = fetchPremiumJson(searchUrl);
  if (searchArtifact.status !== 200 || !searchArtifact.body || typeof searchArtifact.body !== "object") {
    throw new Error(`Player search failed for ${target.player_name}`);
  }

  const players = ((searchArtifact.body as { players?: PffSearchPlayer[] }).players ?? []);
  if (!players.length) {
    throw new Error(`No PFF player match found for ${target.player_name}`);
  }

  const ranked = players
    .map((player) => ({ player, ...scoreCandidate(target, player) }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  if (!best || best.score < 70) {
    throw new Error(
      `No confident PFF match for ${target.player_name}. Candidates: ${ranked
        .slice(0, 3)
        .map((entry) => `${entry.player.first_name} ${entry.player.last_name} (${entry.player.position ?? "?"} ${entry.player.team?.city ?? "?"}) score=${entry.score}`)
        .join("; ")}`
    );
  }

  return {
    candidateCount: players.length,
    id: best.player.id,
    matchReason: best.reason,
    player: best.player,
    slug: slugify(`${best.player.first_name} ${best.player.last_name}`),
  };
}

function buildPlayerUrls(playerId: number) {
  const base = `https://premium.pff.com/api/v1/player`;
  return {
    player: `https://premium.pff.com/api/v1/players?league=ncaa&id=${playerId}`,
    seasons: `${base}/seasons?league=ncaa&player_id=${playerId}`,
    snaps: `${base}/snaps/summary?league=ncaa&season=${season}&week=${WEEK_RANGE}&player_id=${playerId}`,
    offense: `${base}/offense/summary?league=ncaa&season=${season}&week=${WEEK_RANGE}&player_id=${playerId}`,
    passing: `${base}/passing/summary?league=ncaa&season=${season}&week=${WEEK_RANGE}&player_id=${playerId}`,
    rushing: `${base}/rushing/summary?league=ncaa&season=${season}&week=${WEEK_RANGE}&player_id=${playerId}`,
    receiving: `${base}/receiving/summary?league=ncaa&season=${season}&week=${WEEK_RANGE}&player_id=${playerId}`,
    defense: `${base}/defense/summary?league=ncaa&season=${season}&week=${WEEK_RANGE}&player_id=${playerId}`,
  };
}

function writeJson(filePath: string, value: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function assignNumber(updates: Partial<PffRow>, column: keyof PffRow, value: unknown) {
  const numeric = toNumber(value);
  if (numeric == null) return;
  updates[column] = numeric as never;
}

function mapArtifactToUpdates(target: PffRow, artifact: JsonResponseArtifact): Partial<PffRow> {
  const body = artifact.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) return {};

  const data = body as Record<string, unknown>;
  const updates: Partial<PffRow> = {};
  const url = artifact.url;

  if (url.includes("/snaps/summary")) {
    assignNumber(updates, "snaps_offense", data.offense);
    assignNumber(updates, "snaps_defense", data.defense);
    assignNumber(updates, "snaps_special_teams", data.special_teams);
    assignNumber(updates, "stats_pass_block_snaps", data.pass_block);
    assignNumber(updates, "stats_run_block_snaps", data.run_block);
    assignNumber(updates, "stats_pass_rush_snaps", data.pass_rush);
    assignNumber(updates, "stats_pff_coverage_snaps", data.coverage);
    return updates;
  }

  if (url.includes("/offense/summary")) {
    assignNumber(updates, "grades_offense", data.grades_offense);
    assignNumber(updates, "grades_pass_block", data.grades_pass_block);
    assignNumber(updates, "grades_run_block", data.grades_run_block);
    assignNumber(updates, "stats_pass_block_snaps", data.snap_counts_pass_block);
    assignNumber(updates, "stats_run_block_snaps", data.snap_counts_run_block);
    return updates;
  }

  if (url.includes("/passing/summary")) {
    assignNumber(updates, "grades_offense", data.grades_offense);
    assignNumber(updates, "grades_pass", data.grades_pass);
    assignNumber(updates, "grades_run_qb", data.grades_run);
    assignNumber(updates, "stats_attempts", data.attempts);
    assignNumber(updates, "stats_completions", data.completions);
    assignNumber(updates, "stats_passing_yards", data.yards);
    assignNumber(updates, "stats_passing_tds", data.touchdowns);
    assignNumber(updates, "stats_interceptions", data.interceptions);
    assignNumber(updates, "stats_big_time_throws", data.big_time_throws);
    assignNumber(updates, "stats_turnover_worthy_plays", data.turnover_worthy_plays);
    assignNumber(updates, "stats_adjusted_completion_pct", data.accuracy_percent);
    assignNumber(updates, "stats_pressure_to_sack", data.pressure_to_sack_rate);
    assignNumber(updates, "stats_time_to_throw", data.avg_time_to_throw);
    assignNumber(updates, "stats_yards_per_attempt", data.ypa);
    return updates;
  }

  if (url.includes("/rushing/summary")) {
    assignNumber(updates, "grades_offense", data.grades_offense);
    assignNumber(updates, "grades_run_rb", data.grades_run);
    assignNumber(updates, "grades_pass_block_rb", data.grades_pass_block);
    assignNumber(updates, "grades_run_block_rb", data.grades_run_block);
    assignNumber(updates, "stats_carries", data.attempts);
    assignNumber(updates, "stats_rushing_yards", data.yards);
    assignNumber(updates, "stats_rushing_tds", data.touchdowns);
    assignNumber(updates, "stats_yards_after_contact", data.yards_after_contact);
    assignNumber(updates, "stats_yards_after_contact_per_carry", data.yards_after_contact_per_attempt);
    assignNumber(updates, "stats_broken_tackles", data.avoided_tackles);
    assignNumber(updates, "stats_elusive_rating", data.elusive_rating);
    assignNumber(updates, "stats_first_downs_rushing", data.first_downs);
    assignNumber(updates, "stats_fumbles", data.fumbles);
    assignNumber(updates, "stats_pass_block_snaps_rb", data.pass_blocks);
    assignNumber(updates, "stats_pressures_allowed_rb", data.pressures_allowed);
    return updates;
  }

  if (url.includes("/receiving/summary")) {
    assignNumber(updates, "grades_offense", data.grades_offense);
    assignNumber(updates, "grades_pass_route", data.grades_pass_route);
    assignNumber(updates, "grades_pass_block", data.grades_pass_block);
    assignNumber(updates, "grades_hands_drop", data.grades_hands_drop);
    assignNumber(updates, "stats_targets", data.targets);
    assignNumber(updates, "stats_receptions", data.receptions);
    assignNumber(updates, "stats_receiving_yards", data.yards);
    assignNumber(updates, "stats_receiving_tds", data.touchdowns);
    assignNumber(updates, "stats_drops", data.drops);
    assignNumber(updates, "stats_yac", data.yards_after_catch);
    assignNumber(updates, "stats_yac_per_reception", data.yards_after_catch_per_reception);
    assignNumber(updates, "stats_contested_catches", data.contested_receptions);
    assignNumber(updates, "stats_contested_catch_rate", data.contested_catch_rate);
    assignNumber(updates, "stats_first_downs_receiving", data.first_downs);
    assignNumber(updates, "stats_adot", data.avg_depth_of_target);
    assignNumber(updates, "stats_catch_rate", data.caught_percent);
    assignNumber(updates, "stats_yards_per_route_run", data.yprr);
    assignNumber(updates, "stats_route_participation_pct", data.route_rate);
    assignNumber(updates, "snaps_slot", data.slot_snaps);
    assignNumber(updates, "snaps_inline_te", data.inline_snaps);
    return updates;
  }

  if (url.includes("/defense/summary")) {
    assignNumber(updates, "grades_defense", data.grades_defense);
    assignNumber(updates, "grades_pass_rush", data.grades_pass_rush_defense);

    if (target.position === "CB" || target.position === "S") {
      assignNumber(updates, "grades_coverage_db", data.grades_coverage_defense);
      assignNumber(updates, "grades_tackle_db", data.grades_tackle);
    }
    if (target.position === "LB") {
      assignNumber(updates, "grades_coverage_lb", data.grades_coverage_defense);
      assignNumber(updates, "grades_tackle", data.grades_tackle);
      assignNumber(updates, "grades_run_defense_lb", data.grades_run_defense);
    }
    if (target.position === "DL" || target.position === "EDGE") {
      assignNumber(updates, "grades_run_defense_dl", data.grades_run_defense);
    }

    assignNumber(updates, "stats_pressures", data.total_pressures);
    assignNumber(updates, "stats_sacks", data.sacks);
    assignNumber(updates, "stats_hits", data.hits);
    assignNumber(updates, "stats_hurries", data.hurries);
    assignNumber(updates, "stats_run_stops", data.stops);
    assignNumber(updates, "stats_tackles", data.tackles);
    assignNumber(updates, "stats_assists", data.assists);
    assignNumber(updates, "stats_missed_tackles", data.missed_tackles);
    assignNumber(updates, "stats_forced_fumbles", data.forced_fumbles);
    assignNumber(updates, "stats_targets_allowed", data.targets);
    assignNumber(updates, "stats_receptions_allowed", data.receptions);
    assignNumber(updates, "stats_yards_allowed", data.yards);
    assignNumber(updates, "stats_tds_allowed", data.touchdowns);
    assignNumber(updates, "stats_interceptions_def", data.interceptions);
    assignNumber(updates, "stats_pass_breakups", data.pass_break_ups);
    assignNumber(updates, "stats_pff_coverage_snaps", data.snap_counts_coverage);
    assignNumber(updates, "stats_passer_rating_allowed", data.qb_rating_against);

    const yardsAllowed = toNumber(data.yards);
    const coverageSnaps = toNumber(data.snap_counts_coverage);
    if (yardsAllowed != null && coverageSnaps != null && coverageSnaps > 0) {
      updates.stats_yards_per_coverage_snap = Number((yardsAllowed / coverageSnaps).toFixed(3)) as never;
    }

    if (target.position === "DL" || target.position === "EDGE") {
      assignNumber(updates, "snaps_interior_dl", data.snap_counts_dl);
    }
    if (target.position === "LB") {
      assignNumber(updates, "snaps_in_box_lb", data.snap_counts_box);
      assignNumber(updates, "snaps_off_ball_lb", data.snap_counts_offball);
    }
    if (target.position === "CB") {
      assignNumber(updates, "snaps_slot_cb", data.snap_counts_slot);
      assignNumber(updates, "snaps_outside_cb", data.snap_counts_corner);
    }
    if (target.position === "S") {
      assignNumber(updates, "snaps_in_box_db", data.snap_counts_box);
      assignNumber(updates, "snaps_free_safety", data.snap_counts_fs);
      assignNumber(updates, "snaps_strong_safety", data.snap_counts_box);
      assignNumber(updates, "snaps_deep_safety", data.snap_counts_fs);
    }
    return updates;
  }

  return updates;
}

function summarizeArtifactBody(body: unknown): unknown | null {
  if (!body || typeof body !== "object") return null;

  if ("snaps" in body) {
    const snaps = (body as { snaps?: { snap_counts?: Record<string, number> } }).snaps;
    return snaps?.snap_counts ?? null;
  }

  const summaryEntry = Object.entries(body).find(([key]) => key.endsWith("_summary"));
  if (!summaryEntry) return null;

  const [, summaryValue] = summaryEntry;
  if (!summaryValue || typeof summaryValue !== "object") return null;

  const totals = (summaryValue as { week_totals?: unknown[] }).week_totals;
  if (!Array.isArray(totals) || !totals.length) return null;

  return totals[0];
}

async function collectPlayerArtifacts(target: PffRow, playerDir: string) {
  fs.mkdirSync(playerDir, { recursive: true });
  const resolved = resolvePlayer(target);
  const urls = buildPlayerUrls(resolved.id);
  const rawArtifacts = Object.entries(urls).map(([name, url]) => {
    const artifact = fetchPremiumJson(url);
    writeJson(path.join(playerDir, `${name}.json`), artifact.body);
    return artifact;
  });

  const artifacts = rawArtifacts
    .map((artifact) => {
      const summarized = summarizeArtifactBody(artifact.body);
      if (!summarized) return null;
      return { ...artifact, body: summarized };
    })
    .filter((artifact): artifact is JsonResponseArtifact => artifact != null);

  const updates = artifacts.reduce<Partial<PffRow>>((acc, artifact) => {
    Object.assign(acc, mapArtifactToUpdates(target, artifact));
    return acc;
  }, {});

  updates.pff_player_id = resolved.id;

  writeJson(path.join(playerDir, "resolved-player.json"), {
    candidate_count: resolved.candidateCount,
    match_reason: resolved.matchReason,
    resolved_player: resolved.player,
  });
  writeJson(path.join(playerDir, "extracted.json"), updates);

  return {
    artifacts,
    pageUrl: `https://premium.pff.com/ncaa/players/${season}/REGPO/${resolved.slug}/${resolved.id}/snaps`,
    resolved,
    updates,
  };
}

function csvEscape(value: unknown): string {
  const text = value == null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

async function writeWorkbook(rows: Array<Record<string, unknown>>, xlsxPath: string) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Recovered Grades");
  const headers = Array.from(
    new Set(
      rows.flatMap((row) => Object.keys(row)).concat([
        "player_name",
        "team_name",
        "position",
        "source_url",
        "resolved_pff_player_id",
        "resolved_team",
      ])
    )
  );

  sheet.columns = headers.map((header) => ({
    header,
    key: header,
    width: Math.max(14, header.length + 2),
  }));
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.getRow(1).font = { bold: true };

  rows.forEach((row) => sheet.addRow(row));
  await workbook.xlsx.writeFile(xlsxPath);
}

async function applyUpdates(target: PffRow, updates: Partial<PffRow>) {
  if (!Object.keys(updates).length) return;
  const payload = Object.fromEntries(
    Object.entries(updates).filter(([, value]) => value != null)
  ) as Database["public"]["Tables"]["player_pff_grades"]["Update"];

  if (!Object.keys(payload).length) return;

  const { error } = await supabase
    .from("player_pff_grades")
    .update(payload)
    .eq("id", target.id);

  if (error) {
    throw new Error(`Failed to update ${target.player_name}: ${error.message}`);
  }
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });

  const tabState = getPremiumTabState();
  if (tabState.hasUnlock || tabState.hasSignIn) {
    throw new Error(
      `Live Chrome premium tab is not authenticated. url=${tabState.url} title=${tabState.title}`
    );
  }

  const targets = await getTargets();
  if (!targets.length) {
    console.log(`No missing-grade targets found for season ${season}.`);
    return;
  }

  const compiledRows: Array<Record<string, unknown>> = [];
  const errors: Array<{ player_name: string; error: string }> = [];

  for (const target of targets) {
    const playerSlug = `${slugify(target.player_name)}-${target.position.toLowerCase()}`;
    const playerDir = path.join(outDir, "raw", playerSlug);
    console.log(`\n[${compiledRows.length + errors.length + 1}/${targets.length}] ${target.player_name} (${target.position})`);

    try {
      const result = await collectPlayerArtifacts(target, playerDir);
      if (APPLY) {
        await applyUpdates(target, result.updates);
      }

      compiledRows.push({
        player_name: target.player_name,
        team_name: target.team_name,
        position: target.position,
        source_url: result.pageUrl,
        resolved_pff_player_id: result.resolved.id,
        resolved_team: [result.resolved.player.team?.city, result.resolved.player.team?.nickname].filter(Boolean).join(" "),
        match_reason: result.resolved.matchReason,
        ...result.updates,
      });
      console.log(`  resolved pff_id=${result.resolved.id} recovered ${Object.keys(result.updates).length} fields`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      errors.push({ player_name: target.player_name, error: message });
      fs.mkdirSync(playerDir, { recursive: true });
      fs.writeFileSync(path.join(playerDir, "error.txt"), `${message}\n`);
      console.error(`  ${message}`);
    }
  }

  const jsonPath = path.join(outDir, "recovered-grades.json");
  const csvPath = path.join(outDir, "recovered-grades.csv");
  const xlsxPath = path.join(outDir, "recovered-grades.xlsx");
  const errorPath = path.join(outDir, "errors.json");

  fs.writeFileSync(jsonPath, JSON.stringify(compiledRows, null, 2));
  fs.writeFileSync(errorPath, JSON.stringify(errors, null, 2));

  const csvHeaders = Array.from(
    new Set(compiledRows.flatMap((row) => Object.keys(row)).concat(["player_name", "team_name", "position", "source_url"]))
  );
  const csvLines = [
    csvHeaders.join(","),
    ...compiledRows.map((row) => csvHeaders.map((header) => csvEscape(row[header])).join(",")),
  ];
  fs.writeFileSync(csvPath, `${csvLines.join("\n")}\n`);
  await writeWorkbook(compiledRows, xlsxPath);

  console.log(`\nRecovered rows: ${compiledRows.length}`);
  console.log(`Errors: ${errors.length}`);
  console.log(`JSON: ${jsonPath}`);
  console.log(`CSV:  ${csvPath}`);
  console.log(`XLSX: ${xlsxPath}`);
  console.log(`Raw artifacts: ${path.join(outDir, "raw")}`);
  if (APPLY) console.log("Recovered fields were also written back to player_pff_grades.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
