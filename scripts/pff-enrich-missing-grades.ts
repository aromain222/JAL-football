import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ExcelJS from "exceljs";
import { chromium, type BrowserContext, type Locator, type Page, type Response } from "playwright";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PFF_EMAIL = process.env.PFF_EMAIL;
const PFF_PASSWORD = process.env.PFF_PASSWORD;
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
const chromeProfileName = getArg("--chrome-profile") ?? process.env.PFF_CHROME_PROFILE ?? "Default";
const outDir = path.resolve(getArg("--out") ?? path.join("data", "pff", "grade-enrichment", dateStamp));

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
      if (mapping.column.startsWith("grades_") && numeric > 100) continue;
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

async function createChromeProfileCopy(): Promise<string> {
  const chromeRoot = path.join(os.homedir(), "Library/Application Support/Google/Chrome");
  const srcProfile = path.join(chromeRoot, chromeProfileName);
  const destRoot = fs.mkdtempSync(path.join(os.tmpdir(), "jal-pff-chrome-profile-"));
  const destProfile = path.join(destRoot, chromeProfileName);

  if (!fs.existsSync(srcProfile)) {
    throw new Error(`Chrome profile not found: ${srcProfile}`);
  }

  fs.mkdirSync(destRoot, { recursive: true });
  fs.mkdirSync(destProfile, { recursive: true });

  for (const file of ["Local State", "First Run"]) {
    const src = path.join(chromeRoot, file);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(destRoot, file));
  }

  const copyEntry = (relativePath: string) => {
    const sourcePath = path.join(srcProfile, relativePath);
    const destPath = path.join(destProfile, relativePath);
    if (!fs.existsSync(sourcePath)) return;

    const stat = fs.statSync(sourcePath);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    if (stat.isDirectory()) {
      fs.cpSync(sourcePath, destPath, { recursive: true });
      return;
    }

    fs.copyFileSync(sourcePath, destPath);
  };

  for (const relativePath of [
    "Cookies",
    "Cookies-journal",
    "Preferences",
    "Secure Preferences",
    "Local Storage",
    "Session Storage",
    "WebStorage",
    path.join("IndexedDB", "https_www.pff.com_0.indexeddb.leveldb"),
    path.join("IndexedDB", "https_premium.pff.com_0.indexeddb.leveldb"),
  ]) {
    copyEntry(relativePath);
  }

  return destRoot;
}

async function getSessionState(page: Page) {
  const bodyText = await page.locator("body").innerText().catch(() => "");
  const signInVisible = /sign in/i.test(bodyText);
  const unlockVisible = /unlock pff\+/i.test(bodyText);
  return {
    signedIn: !signInVisible,
    premium: !unlockVisible,
    bodyText,
  };
}

async function tryCredentialLogin(page: Page) {
  if (!PFF_EMAIL || !PFF_PASSWORD) return;
  await page.goto("https://auth.pff.com/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1000);
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

  const signIn = page.getByRole("button", { name: /^sign in$/i });

  if (await signIn.isVisible().catch(() => false)) {
    await signIn.click();
  } else {
    await page.locator("form").first().evaluate((form: HTMLFormElement) => {
      if (typeof form.requestSubmit === "function") {
        form.requestSubmit();
        return;
      }
      form.submit();
    });
  }
  await page.waitForTimeout(3000);
}

async function ensurePremiumContext(): Promise<BrowserContext> {
  fs.mkdirSync(outDir, { recursive: true });

  const copiedProfile = await createChromeProfileCopy();
  const context = await chromium.launchPersistentContext(copiedProfile, {
    channel: "chrome",
    headless: false,
    acceptDownloads: true,
  });
  const page = context.pages()[0] ?? (await context.newPage());

  await page.goto(`https://premium.pff.com/ncaa/players/${season}/REGPO`, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await page.waitForTimeout(2500);

  let state = await getSessionState(page);
  if (!state.signedIn || !state.premium) {
    await tryCredentialLogin(page);
    await page.goto(`https://premium.pff.com/ncaa/players/${season}/REGPO`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.waitForTimeout(2500);
    state = await getSessionState(page);
  }

  if (!state.signedIn || !state.premium) {
    throw new Error("PFF premium session unavailable. Chrome profile and env credentials both resolved to the public shell.");
  }

  return context;
}

async function dismissCookieBanner(page: Page) {
  const accept = page.getByRole("button", { name: /accept all/i });
  if (await accept.isVisible().catch(() => false)) {
    await accept.click();
    await page.waitForTimeout(500);
  }
}

async function openPlayerSearch(page: Page) {
  await page.goto(`https://premium.pff.com/ncaa/players/${season}/REGPO`, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await page.waitForTimeout(2000);
  await dismissCookieBanner(page);
}

async function searchPlayer(page: Page, playerName: string) {
  const triggerCandidates = [
    page.getByRole("button", { name: /search for player/i }),
    page.locator('[placeholder*="search for player" i]').first(),
    page.locator('[class*="search"]').first(),
  ];

  for (const trigger of triggerCandidates) {
    if (await trigger.isVisible().catch(() => false)) {
      await trigger.click();
      await page.waitForTimeout(750);
      break;
    }
  }

  const inputCandidates = [
    page.locator('input[placeholder*="search" i]').first(),
    page.locator('input[type="search"]').first(),
    page.locator('input[aria-label*="search" i]').first(),
    page.locator('[class*="search"] input').first(),
  ];

  let input = inputCandidates[0];
  for (const candidate of inputCandidates) {
    if (await candidate.isVisible().catch(() => false)) {
      input = candidate;
      break;
    }
  }

  if (!(await input.isVisible().catch(() => false))) {
    throw new Error(`Search input not found for ${playerName}`);
  }

  await input.fill("");
  await input.type(playerName, { delay: 60 });
  await page.waitForTimeout(2000);

  const firstName = playerName.split(/\s+/)[0] ?? playerName;
  const resultCandidates = [
    page.locator(`a[href*="/players/"]:has-text("${firstName}")`).first(),
    page.locator(`li:has-text("${firstName}")`).first(),
    page.locator(`[role="option"]:has-text("${firstName}")`).first(),
    page.locator(`text=${playerName}`).first(),
    page.locator('a[href*="/players/"]').first(),
  ];

  for (const candidate of resultCandidates) {
    if (await candidate.isVisible().catch(() => false)) {
      await candidate.click();
      await page.waitForTimeout(2500);
      return;
    }
  }

  throw new Error(`Search result not found for ${playerName}`);
}

async function clickTabIfPresent(page: Page, name: string) {
  const candidates = [
    page.getByRole("tab", { name: new RegExp(name, "i") }),
    page.getByRole("button", { name: new RegExp(name, "i") }),
    page.getByRole("link", { name: new RegExp(name, "i") }),
    page.locator(`[href*="${name.toLowerCase().replace(/\s+/g, "-")}"]`).first(),
  ];
  for (const candidate of candidates) {
    if (await candidate.isVisible().catch(() => false)) {
      await candidate.click();
      await page.waitForTimeout(1500);
      return true;
    }
  }
  return false;
}

async function collectPlayerArtifacts(page: Page, target: PffRow, playerDir: string) {
  fs.mkdirSync(playerDir, { recursive: true });
  const artifacts: JsonResponseArtifact[] = [];

  const responseHandler = async (response: Response) => {
    try {
      const contentType = response.headers()["content-type"] ?? null;
      if (!contentType?.includes("application/json")) return;
      const url = response.url();
      if (!/pff|premium/i.test(url)) return;
      const body = await response.json().catch(() => null);
      if (!body) return;
      artifacts.push({
        url,
        status: response.status(),
        contentType,
        body,
      });
    } catch {
      // Ignore response parse failures.
    }
  };

  page.on("response", responseHandler);
  try {
    await openPlayerSearch(page);
    await searchPlayer(page, target.player_name);

    const pageUrl = page.url();
    const bodyText = await page.locator("body").innerText().catch(() => "");
    const html = await page.content();

    await page.screenshot({ path: path.join(playerDir, "page.png"), fullPage: true }).catch(() => {});
    fs.writeFileSync(path.join(playerDir, "page.txt"), bodyText);
    fs.writeFileSync(path.join(playerDir, "page.html"), html);
    fs.writeFileSync(path.join(playerDir, "page-url.txt"), `${pageUrl}\n`);

    for (const tabName of ["Grades", "Summary", "Receiving", "Rushing", "Passing", "Blocking", "Defense", "Advanced"]) {
      await clickTabIfPresent(page, tabName);
    }

    await page.waitForTimeout(2000);

    const updatedBodyText = await page.locator("body").innerText().catch(() => bodyText);
    fs.writeFileSync(path.join(playerDir, "page-after-tabs.txt"), updatedBodyText);

    const updates = pickFromArtifacts(target, artifacts, updatedBodyText);
    fs.writeFileSync(path.join(playerDir, "responses.json"), JSON.stringify(artifacts, null, 2));
    fs.writeFileSync(path.join(playerDir, "extracted.json"), JSON.stringify(updates, null, 2));

    return {
      pageUrl,
      updates,
      artifacts,
      bodyText: updatedBodyText,
    };
  } finally {
    page.off("response", responseHandler);
  }
}

function csvEscape(value: unknown): string {
  const text = value == null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

async function writeWorkbook(rows: Array<Record<string, unknown>>, xlsxPath: string) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Recovered Grades");
  const headers = [
    "player_name",
    "team_name",
    "position",
    "source_url",
    "grades_overall",
    "grades_offense",
    "grades_defense",
    "grades_pass",
    "grades_pass_route",
    "grades_run_rb",
    "grades_pass_rush",
    "grades_coverage_db",
    "grades_coverage_lb",
    "grades_run_block",
    "grades_pass_block",
    "grades_tackle",
    "grades_tackle_db",
    "grades_run_defense_dl",
    "grades_run_defense_lb",
    "stats_targets",
    "stats_receptions",
    "stats_receiving_yards",
    "stats_receiving_tds",
    "stats_yards_per_route_run",
    "stats_attempts",
    "stats_completions",
    "stats_passing_yards",
    "stats_passing_tds",
    "stats_interceptions",
    "stats_carries",
    "stats_rushing_yards",
    "stats_rushing_tds",
    "stats_pressures",
    "stats_sacks",
    "stats_hits",
    "stats_hurries",
    "stats_run_stops",
    "stats_tackles",
    "stats_assists",
    "stats_pass_breakups",
  ];

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

  const targets = await getTargets();
  if (!targets.length) {
    console.log(`No missing-grade targets found for season ${season}.`);
    return;
  }

  const context = await ensurePremiumContext();
  const page = context.pages()[0] ?? (await context.newPage());
  const compiledRows: Array<Record<string, unknown>> = [];
  const errors: Array<{ player_name: string; error: string }> = [];

  for (const target of targets) {
    const playerSlug = `${slugify(target.player_name)}-${target.position.toLowerCase()}`;
    const playerDir = path.join(outDir, "raw", playerSlug);
    console.log(`\n[${compiledRows.length + errors.length + 1}/${targets.length}] ${target.player_name} (${target.position})`);

    try {
      const result = await collectPlayerArtifacts(page, target, playerDir);
      if (APPLY) {
        await applyUpdates(target, result.updates);
      }

      compiledRows.push({
        player_name: target.player_name,
        team_name: target.team_name,
        position: target.position,
        source_url: result.pageUrl,
        ...result.updates,
      });
      console.log(`  recovered ${Object.keys(result.updates).length} fields`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      errors.push({ player_name: target.player_name, error: message });
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

  await context.close();

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
