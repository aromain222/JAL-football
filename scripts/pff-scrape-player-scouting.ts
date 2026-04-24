import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium, type Locator, type Page } from "playwright";

const PFF_EMAIL = process.env.PFF_EMAIL;
const PFF_PASSWORD = process.env.PFF_PASSWORD;
const PFF_SEASON = Number(process.env.PFF_SEASON ?? 2025);
const WEEK_RANGE = "0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20";

type InputPlayer = {
  name: string;
  school?: string | null;
  position?: string | null;
};

type PffSearchPlayer = {
  id: number;
  first_name: string;
  last_name: string;
  position: string | null;
  team?: {
    abbreviation?: string | null;
    city?: string | null;
    nickname?: string | null;
    slug?: string | null;
  } | null;
  current_eligible_year?: number | null;
};

type JsonArtifact = {
  url: string;
  status: number;
  body: unknown;
};

type PositionGroup = "OL" | "WR" | "DB" | "EDGE_DL" | "OTHER";

type AlignmentData = {
  total_snaps: number | null;
  pass_snaps: number | null;
  run_snaps: number | null;
  pass_block_snaps: number | null;
  run_block_snaps: number | null;
  pass_rush_snaps: number | null;
  coverage_snaps: number | null;
  slot_snaps: number | null;
  wide_snaps: number | null;
  inline_snaps: number | null;
  box_snaps: number | null;
  deep_snaps: number | null;
  left_side_snaps: number | null;
  right_side_snaps: number | null;
  interior_snaps: number | null;
  edge_snaps: number | null;
  percentages: Record<string, number | null>;
};

type PlayerScoutingResult = {
  input: {
    name: string;
    school: string | null;
    position: string | null;
  };
  status: "ok" | "not_found" | "error";
  error: string | null;
  resolution: {
    pff_player_id: number | null;
    matched_name: string | null;
    matched_school: string | null;
    matched_position: string | null;
    candidate_count: number;
    match_reason: string | null;
    search_url: string | null;
    stats_page_url: string | null;
  };
  position_group: PositionGroup;
  stats: {
    total_snaps: number | null;
    usage_splits: Record<string, number | null>;
    snap_alignment: Record<string, number | null>;
    alignment_data: AlignmentData;
    position_specific: Record<string, number | null>;
  };
  raw: {
    fetched_urls: string[];
    available_sections: string[];
  };
  missing_fields: string[];
};

function getArg(flag: string): string | null {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 ? (process.argv[idx + 1] ?? null) : null;
}

const inputPath = getArg("--input");
const season = Number(getArg("--season") ?? PFF_SEASON);
const headless = !process.argv.includes("--headed");
const limit = Number(getArg("--limit") ?? "0") || undefined;
const dateStamp = new Date().toISOString().slice(0, 10);
const outDir = path.resolve(
  getArg("--out") ?? path.join("data", "pff", "scouting-scrapes", dateStamp)
);

if (!inputPath) {
  console.error('Usage: npm run pff:scrape-scouting -- --input "/absolute/path/to/players.json|csv" [--out ./data/pff/scouting]');
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });

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

function positionGroupFor(position: string | null | undefined): PositionGroup {
  const normalized = normalizeString(position).toUpperCase();
  if (["C", "G", "T", "OT", "OG", "OL"].includes(normalized)) return "OL";
  if (["WR", "TE", "RB"].includes(normalized)) return "WR";
  if (["CB", "S", "FS", "SS", "DB"].includes(normalized)) return "DB";
  if (["EDGE", "DE", "DT", "NT", "DL", "ED", "IDL", "OLB"].includes(normalized)) return "EDGE_DL";
  return "OTHER";
}

function scoreCandidate(target: InputPlayer, candidate: PffSearchPlayer) {
  const targetName = normalizeString(target.name);
  const candidateName = normalizeString(`${candidate.first_name} ${candidate.last_name}`);
  const targetSchool = normalizeString(target.school);
  const schoolFields = [
    candidate.team?.city,
    candidate.team?.nickname,
    candidate.team?.slug,
    candidate.team?.abbreviation,
    [candidate.team?.city, candidate.team?.nickname].filter(Boolean).join(" "),
  ].map((value) => normalizeString(value));

  const targetGroup = positionGroupFor(target.position);
  const candidateGroup = positionGroupFor(candidate.position);

  let score = 0;
  const reasons: string[] = [];

  if (candidateName === targetName) {
    score += 100;
    reasons.push("exact-name");
  } else if (candidateName.includes(targetName) || targetName.includes(candidateName)) {
    score += 70;
    reasons.push("partial-name");
  }

  if (targetGroup !== "OTHER" && candidateGroup === targetGroup) {
    score += 30;
    reasons.push("position");
  }

  if (targetSchool) {
    const exact = schoolFields.find((value) => value === targetSchool);
    const loose = schoolFields.find((value) => value && (value.includes(targetSchool) || targetSchool.includes(value)));
    if (exact) {
      score += 40;
      reasons.push("school");
    } else if (loose) {
      score += 20;
      reasons.push("school-loose");
    }
  }

  return { score, reason: reasons.join("+") || "fallback" };
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }
    current += char;
  }

  values.push(current);
  return values.map((value) => value.trim());
}

function loadPlayers(filePath: string): InputPlayer[] {
  const resolved = path.resolve(filePath);
  const ext = path.extname(resolved).toLowerCase();

  if (ext === ".json") {
    const parsed = JSON.parse(fs.readFileSync(resolved, "utf8")) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error(`Expected ${resolved} to contain a JSON array`);
    }
    return parsed
      .map((item) => item as Record<string, unknown>)
      .map((item) => ({
        name: String(item.name ?? "").trim(),
        school: item.school == null ? null : String(item.school).trim(),
        position: item.position == null ? null : String(item.position).trim(),
      }))
      .filter((item) => item.name);
  }

  if (ext === ".csv") {
    const lines = fs.readFileSync(resolved, "utf8").split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) return [];
    const headers = parseCsvLine(lines[0]).map((value) => value.replace(/^"|"$/g, ""));
    return lines
      .slice(1)
      .map((line) => {
        const values = parseCsvLine(line).map((value) => value.replace(/^"|"$/g, ""));
        const row = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])) as Record<
          string,
          string
        >;
        const name = row.name?.trim() || `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim();
        return {
          name,
          school: row.school?.trim() || row.previous_school?.trim() || row.current_school?.trim() || null,
          position: row.position?.trim() || null,
        };
      })
      .filter((item) => item.name);
  }

  throw new Error(`Unsupported input format for ${resolved}. Use .json or .csv.`);
}

async function getSessionState(page: Page) {
  const bodyText = await page.locator("body").innerText().catch(() => "");
  return {
    signedIn: !/sign in/i.test(bodyText),
    premium: !/unlock pff\+/i.test(bodyText),
  };
}

async function fillLogin(page: Page) {
  if (!PFF_EMAIL || !PFF_PASSWORD) return;

  const findFirstVisible = async (selectors: string[]): Promise<Locator | null> => {
    for (const selector of selectors) {
      const locator = page.locator(selector).first();
      if (await locator.isVisible().catch(() => false)) return locator;
    }
    return null;
  };

  await page.waitForSelector('input[type="password"]', { timeout: 10000 });

  const emailInput = await findFirstVisible([
    'input[type="email"]',
    'input[name="email"]',
    'input[name="username"]',
    'input[placeholder*="Email"]',
    'input[placeholder*="email"]',
  ]);
  const passwordInput = await findFirstVisible(['input[type="password"]']);

  if (!emailInput || !passwordInput) {
    throw new Error("PFF login inputs not found");
  }

  await emailInput.fill("");
  await emailInput.fill(PFF_EMAIL);
  await passwordInput.fill("");
  await passwordInput.fill(PFF_PASSWORD);

  const submit = page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Log in")').first();
  if (await submit.isVisible().catch(() => false)) {
    await submit.click();
  }
}

async function ensurePremiumSession(page: Page) {
  await page.goto(`https://premium.pff.com/ncaa/players/${season}/REGPO`, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await page.waitForTimeout(1500);

  let state = await getSessionState(page);
  if (state.signedIn && state.premium) return;

  await page.goto("https://auth.pff.com/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1500);
  await fillLogin(page);
  await page.waitForTimeout(2500);
  await page.goto(`https://premium.pff.com/ncaa/players/${season}/REGPO`, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await page.waitForTimeout(1500);
  state = await getSessionState(page);

  if (!state.signedIn || !state.premium) {
    throw new Error("PFF session is not premium-authenticated. Run npm run pff:session first if reCAPTCHA blocks login.");
  }
}

async function fetchPremiumJson(page: Page, url: string): Promise<JsonArtifact> {
  const result = await page.evaluate(async (requestUrl) => {
    try {
      const response = await fetch(requestUrl, {
        credentials: "include",
        headers: {
          accept: "application/json, text/plain, */*",
        },
      });
      const text = await response.text();
      return { status: response.status, text };
    } catch (error) {
      return { status: 0, text: JSON.stringify({ error: String(error) }) };
    }
  }, url);

  let body: unknown = result.text;
  try {
    body = JSON.parse(result.text);
  } catch {
    // keep text
  }

  return {
    url,
    status: result.status,
    body,
  };
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

async function resolvePlayer(page: Page, player: InputPlayer) {
  const searchUrl = `https://premium.pff.com/api/v1/players?league=ncaa&name=${encodeURIComponent(player.name)}`;
  const searchArtifact = await fetchPremiumJson(page, searchUrl);
  const candidates = ((searchArtifact.body as { players?: PffSearchPlayer[] })?.players ?? []) as PffSearchPlayer[];
  if (!candidates.length) return null;

  const ranked = candidates
    .map((candidate) => ({ candidate, ...scoreCandidate(player, candidate) }))
    .sort((left, right) => right.score - left.score);

  const best = ranked[0];
  if (!best || best.score < 70) return null;

  return {
    id: best.candidate.id,
    slug: slugify(`${best.candidate.first_name} ${best.candidate.last_name}`),
    candidateCount: candidates.length,
    matchReason: best.reason,
    player: best.candidate,
    searchUrl,
  };
}

function buildUrls(playerId: number) {
  const base = "https://premium.pff.com/api/v1/player";
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

function statsPagePath(positionGroup: PositionGroup) {
  switch (positionGroup) {
    case "OL":
      return "offense";
    case "WR":
      return "receiving";
    case "DB":
    case "EDGE_DL":
      return "defense";
    default:
      return "snaps";
  }
}

function getUsageSplits(snapsSummary: Record<string, unknown>, bodySummaries: Array<Record<string, unknown>>) {
  const values: Record<string, number | null> = {
    offense: toNumber(snapsSummary.offense),
    defense: toNumber(snapsSummary.defense),
    special_teams: toNumber(snapsSummary.special_teams),
    pass_route: toNumber(snapsSummary.pass_route),
    pass_block: toNumber(snapsSummary.pass_block),
    run_block: toNumber(snapsSummary.run_block),
    pass_rush: toNumber(snapsSummary.pass_rush),
    coverage: toNumber(snapsSummary.coverage),
    run_defense: toNumber(snapsSummary.run_defense),
  };

  for (const summary of bodySummaries) {
    for (const [key, value] of Object.entries(summary)) {
      if (key.startsWith("snap_counts_")) {
        const normalized = key.replace(/^snap_counts_/, "");
        if (!(normalized in values)) values[normalized] = toNumber(value);
      }
    }
  }

  return values;
}

function getSnapAlignment(bodySummaries: Array<Record<string, unknown>>) {
  const alignment: Record<string, number | null> = {};

  for (const summary of bodySummaries) {
    for (const [key, value] of Object.entries(summary)) {
      if (!key.startsWith("snap_counts_")) continue;
      alignment[key.replace(/^snap_counts_/, "")] = toNumber(value);
    }
  }

  return alignment;
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    const numeric = toNumber(value);
    if (numeric != null) return numeric;
  }
  return null;
}

function sumNumbers(...values: Array<number | null | undefined>) {
  const numeric = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return numeric.length ? numeric.reduce((sum, value) => sum + value, 0) : null;
}

function ratioOrNull(value: number | null, total: number | null) {
  if (value == null || total == null || total <= 0) return null;
  return Number((value / total).toFixed(4));
}

function buildAlignmentData(
  usageSplits: Record<string, number | null>,
  snapAlignment: Record<string, number | null>,
  positionSpecific: Record<string, number | null>,
  totalSnaps: number | null
): AlignmentData {
  const passBlockSnaps = firstNumber(
    positionSpecific.pass_block_snaps,
    usageSplits.pass_block
  );
  const runBlockSnaps = firstNumber(
    positionSpecific.run_block_snaps,
    usageSplits.run_block
  );
  const passRushSnaps = firstNumber(usageSplits.pass_rush, snapAlignment.pass_rush);
  const coverageSnaps = firstNumber(usageSplits.coverage, snapAlignment.coverage);
  const slotSnaps = firstNumber(positionSpecific.slot_snaps, snapAlignment.slot, snapAlignment.slot_cb);
  const wideSnaps = firstNumber(
    positionSpecific.wide_snaps,
    snapAlignment.wide,
    sumNumbers(snapAlignment.wide_left, snapAlignment.wide_right)
  );
  const inlineSnaps = firstNumber(
    snapAlignment.inline,
    snapAlignment.inline_te,
    snapAlignment.at_center
  );
  const boxSnaps = firstNumber(snapAlignment.box, snapAlignment.in_box_db, snapAlignment.in_box_lb);
  const deepSnaps = firstNumber(
    positionSpecific.deep_snaps,
    snapAlignment.deep,
    snapAlignment.deep_safety,
    snapAlignment.fs,
    snapAlignment.free_safety
  );
  const leftSideSnaps = sumNumbers(
    snapAlignment.at_left_tackle,
    snapAlignment.at_left_guard,
    snapAlignment.at_left_end,
    snapAlignment.wide_left,
    snapAlignment.left
  );
  const rightSideSnaps = sumNumbers(
    snapAlignment.at_right_tackle,
    snapAlignment.at_right_guard,
    snapAlignment.at_right_end,
    snapAlignment.wide_right,
    snapAlignment.right
  );
  const interiorSnaps = firstNumber(
    snapAlignment.interior,
    sumNumbers(
      snapAlignment.at_left_guard,
      snapAlignment.at_center,
      snapAlignment.at_right_guard,
      snapAlignment.interior_dl
    )
  );
  const edgeSnaps = firstNumber(
    positionSpecific.edge_snaps,
    snapAlignment.edge,
    snapAlignment.dl_outside_t,
    sumNumbers(snapAlignment.at_left_end, snapAlignment.at_right_end)
  );
  const passSnaps = firstNumber(
    snapAlignment.pass,
    sumNumbers(usageSplits.pass_route, passBlockSnaps),
    sumNumbers(passRushSnaps, coverageSnaps)
  );
  const runSnaps = firstNumber(
    snapAlignment.run,
    sumNumbers(runBlockSnaps, usageSplits.run_defense)
  );

  const counts = {
    total_snaps: totalSnaps,
    pass_snaps: passSnaps,
    run_snaps: runSnaps,
    pass_block_snaps: passBlockSnaps,
    run_block_snaps: runBlockSnaps,
    pass_rush_snaps: passRushSnaps,
    coverage_snaps: coverageSnaps,
    slot_snaps: slotSnaps,
    wide_snaps: wideSnaps,
    inline_snaps: inlineSnaps,
    box_snaps: boxSnaps,
    deep_snaps: deepSnaps,
    left_side_snaps: leftSideSnaps,
    right_side_snaps: rightSideSnaps,
    interior_snaps: interiorSnaps,
    edge_snaps: edgeSnaps,
  };

  return {
    ...counts,
    percentages: Object.fromEntries(
      Object.entries(counts).map(([key, value]) => [key, ratioOrNull(value, totalSnaps)])
    ),
  };
}

function extractPositionSpecific(
  positionGroup: PositionGroup,
  summaries: {
    offense: Record<string, unknown>;
    receiving: Record<string, unknown>;
    defense: Record<string, unknown>;
    snaps: Record<string, unknown>;
  }
): Record<string, number | null> {
  const offense = summaries.offense;
  const receiving = summaries.receiving;
  const defense = summaries.defense;
  const snaps = summaries.snaps;

  if (positionGroup === "OL") {
    return {
      pass_block_grade: firstNumber(offense.grades_pass_block),
      run_block_grade: firstNumber(offense.grades_run_block),
      pressures_allowed: firstNumber(offense.pressures_allowed, offense.total_pressures_allowed),
      sacks_allowed: firstNumber(offense.sacks_allowed),
      pass_block_snaps: firstNumber(offense.snap_counts_pass_block, snaps.pass_block),
      run_block_snaps: firstNumber(offense.snap_counts_run_block, snaps.run_block),
    };
  }

  if (positionGroup === "WR") {
    const slotSnaps = firstNumber(receiving.slot_snaps, receiving.snap_counts_slot);
    const inlineSnaps = firstNumber(receiving.inline_snaps, receiving.snap_counts_inline);
    const totalOffense = firstNumber(snaps.offense);
    const wideSnaps = firstNumber(receiving.wide_snaps, receiving.snap_counts_wide) ??
      (totalOffense != null ? Math.max(totalOffense - (slotSnaps ?? 0) - (inlineSnaps ?? 0), 0) : null);

    return {
      targets: firstNumber(receiving.targets),
      receptions: firstNumber(receiving.receptions),
      yards: firstNumber(receiving.yards),
      yards_per_route_run: firstNumber(receiving.yprr),
      slot_snaps: slotSnaps,
      wide_snaps: wideSnaps,
    };
  }

  if (positionGroup === "DB") {
    return {
      coverage_grade: firstNumber(defense.grades_coverage_defense),
      targets_allowed: firstNumber(defense.targets),
      yards_allowed: firstNumber(defense.yards),
      interceptions: firstNumber(defense.interceptions),
      pass_breakups: firstNumber(defense.pass_break_ups),
      slot_snaps: firstNumber(defense.snap_counts_slot),
      deep_snaps: firstNumber(defense.snap_counts_fs, defense.snap_counts_deep, defense.snap_counts_deep_safety),
    };
  }

  if (positionGroup === "EDGE_DL") {
    return {
      pass_rush_grade: firstNumber(defense.grades_pass_rush_defense),
      pressures: firstNumber(defense.total_pressures),
      sacks: firstNumber(defense.sacks),
      run_defense_grade: firstNumber(defense.grades_run_defense),
      edge_snaps: firstNumber(defense.snap_counts_dl_outside_t, defense.snap_counts_dl),
    };
  }

  return {};
}

function getTotalSnaps(snapsSummary: Record<string, unknown>, usageSplits: Record<string, number | null>) {
  return (
    firstNumber(snapsSummary.offense) ??
    firstNumber(snapsSummary.defense) ??
    firstNumber(usageSplits.pass_route) ??
    firstNumber(usageSplits.pass_block) ??
    firstNumber(usageSplits.coverage) ??
    null
  );
}

function buildMissingFields(result: PlayerScoutingResult["stats"]) {
  const missing: string[] = [];
  if (result.total_snaps == null) missing.push("total_snaps");
  for (const [key, value] of Object.entries(result.alignment_data)) {
    if (key === "percentages") continue;
    if (value == null) missing.push(`alignment_data.${key}`);
  }
  for (const [key, value] of Object.entries(result.position_specific)) {
    if (value == null) missing.push(key);
  }
  return missing.sort();
}

function writeJson(filePath: string, value: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

async function scrapePlayer(page: Page, player: InputPlayer): Promise<PlayerScoutingResult> {
  const baseResult: PlayerScoutingResult = {
    input: {
      name: player.name,
      school: player.school ?? null,
      position: player.position ?? null,
    },
    status: "not_found",
    error: null,
    resolution: {
      pff_player_id: null,
      matched_name: null,
      matched_school: null,
      matched_position: null,
      candidate_count: 0,
      match_reason: null,
      search_url: null,
      stats_page_url: null,
    },
    position_group: positionGroupFor(player.position),
    stats: {
      total_snaps: null,
      usage_splits: {},
      snap_alignment: {},
      alignment_data: {
        total_snaps: null,
        pass_snaps: null,
        run_snaps: null,
        pass_block_snaps: null,
        run_block_snaps: null,
        pass_rush_snaps: null,
        coverage_snaps: null,
        slot_snaps: null,
        wide_snaps: null,
        inline_snaps: null,
        box_snaps: null,
        deep_snaps: null,
        left_side_snaps: null,
        right_side_snaps: null,
        interior_snaps: null,
        edge_snaps: null,
        percentages: {},
      },
      position_specific: {},
    },
    raw: {
      fetched_urls: [],
      available_sections: [],
    },
    missing_fields: [],
  };

  try {
    const resolved = await resolvePlayer(page, player);
    if (!resolved) {
      baseResult.error = "No confident PFF match found";
      return baseResult;
    }

    const matchedName = `${resolved.player.first_name} ${resolved.player.last_name}`.trim();
    const matchedSchool = [resolved.player.team?.city, resolved.player.team?.nickname].filter(Boolean).join(" ").trim() || null;
    const matchedPosition = resolved.player.position ?? null;
    const positionGroup = positionGroupFor(player.position ?? matchedPosition);
    const statsPageUrl = `https://premium.pff.com/ncaa/players/${season}/REGPO/${resolved.slug}/${resolved.id}/${statsPagePath(positionGroup)}`;

    await page.goto(statsPageUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(1200);

    const urls = buildUrls(resolved.id);
    const rawArtifacts = await Promise.all(Object.values(urls).map((url) => fetchPremiumJson(page, url)));
    const summarized = Object.fromEntries(
      rawArtifacts.map((artifact) => {
        const key = Object.entries(urls).find(([, value]) => value === artifact.url)?.[0] ?? artifact.url;
        return [key, summarizeArtifactBody(artifact.body)];
      })
    ) as Record<string, unknown>;

    const snapSummary = (summarized.snaps as Record<string, unknown> | null) ?? {};
    const bodySummaries = ["offense", "passing", "rushing", "receiving", "defense"]
      .map((key) => summarized[key])
      .filter((value): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value));

    const usageSplits = getUsageSplits(snapSummary, bodySummaries);
    const snapAlignment = getSnapAlignment(bodySummaries);
    const positionSpecific = extractPositionSpecific(positionGroup, {
      offense: (summarized.offense as Record<string, unknown> | null) ?? {},
      receiving: (summarized.receiving as Record<string, unknown> | null) ?? {},
      defense: (summarized.defense as Record<string, unknown> | null) ?? {},
      snaps: snapSummary,
    });
    const totalSnaps = getTotalSnaps(snapSummary, usageSplits);
    const alignmentData = buildAlignmentData(usageSplits, snapAlignment, positionSpecific, totalSnaps);

    const result: PlayerScoutingResult = {
      ...baseResult,
      status: "ok",
      position_group: positionGroup,
      resolution: {
        pff_player_id: resolved.id,
        matched_name: matchedName,
        matched_school: matchedSchool,
        matched_position: matchedPosition,
        candidate_count: resolved.candidateCount,
        match_reason: resolved.matchReason,
        search_url: resolved.searchUrl,
        stats_page_url: statsPageUrl,
      },
      stats: {
        total_snaps: totalSnaps,
        usage_splits: usageSplits,
        snap_alignment: snapAlignment,
        alignment_data: alignmentData,
        position_specific: positionSpecific,
      },
      raw: {
        fetched_urls: rawArtifacts.map((artifact) => artifact.url),
        available_sections: Object.entries(summarized)
          .filter(([, value]) => value && typeof value === "object")
          .map(([key]) => key),
      },
      missing_fields: [],
    };

    result.missing_fields = buildMissingFields(result.stats);
    return result;
  } catch (error) {
    return {
      ...baseResult,
      status: "error",
      error: error instanceof Error ? error.message : "Unknown scrape error",
    };
  }
}

async function main() {
  const players = loadPlayers(inputPath!);
  const scopedPlayers = limit ? players.slice(0, limit) : players;

  if (!scopedPlayers.length) {
    console.error("No players found in input.");
    process.exit(1);
  }

  const userDataDir = path.join(os.homedir(), ".pff-browser-session");
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless,
    acceptDownloads: false,
  });
  const page = context.pages()[0] ?? (await context.newPage());

  await ensurePremiumSession(page);

  const results: PlayerScoutingResult[] = [];
  for (const player of scopedPlayers) {
    console.log(`Scraping ${player.name}${player.school ? ` (${player.school})` : ""}...`);
    const result = await scrapePlayer(page, player);
    results.push(result);

    const fileSlug = slugify(`${player.name}-${player.school ?? ""}-${player.position ?? ""}`) || "player";
    writeJson(path.join(outDir, "players", `${fileSlug}.json`), result);
  }

  const aggregate = {
    season,
    generated_at: new Date().toISOString(),
    total_players: results.length,
    success_count: results.filter((result) => result.status === "ok").length,
    not_found_count: results.filter((result) => result.status === "not_found").length,
    error_count: results.filter((result) => result.status === "error").length,
    players: results,
  };

  const aggregatePath = path.join(outDir, "player-scouting-results.json");
  writeJson(aggregatePath, aggregate);
  console.log(aggregatePath);

  await context.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
