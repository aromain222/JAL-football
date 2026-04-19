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

const WEEK_RANGE = "0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20";
const APPLE_SCRIPT_PATH = path.join(os.tmpdir(), "jal-pff-live-tab.applescript");

function getArg(flag: string): string | null {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 ? (process.argv[idx + 1] ?? null) : null;
}

function getRepeatableArg(flag: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === flag) {
      const value = process.argv[index + 1];
      if (value) values.push(value);
    }
  }
  return values;
}

const sourceSeason = Number(getArg("--source-season") ?? 2025);
const checkSeason = Number(getArg("--check-season") ?? 2024);
const start = Number(getArg("--start") ?? "0") || 0;
const limit = Number(getArg("--limit") ?? "0") || undefined;
const playerNames = new Set(
  getRepeatableArg("--player-name")
    .map((value) => value.trim())
    .filter(Boolean)
);
const playerNamesFile = getArg("--player-names-file");
const dateStamp = new Date().toISOString().slice(0, 10);
const outDir = path.resolve(
  getArg("--out") ?? path.join("data", "pff", "grade-enrichment", dateStamp, `prior-season-${checkSeason}`)
);

if (playerNamesFile) {
  const names = JSON.parse(fs.readFileSync(path.resolve(playerNamesFile), "utf8")) as unknown;
  if (!Array.isArray(names)) {
    throw new Error(`Expected ${playerNamesFile} to contain a JSON array of player names.`);
  }
  names
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean)
    .forEach((value) => playerNames.add(value));
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
        return JSON.stringify({ status: xhr.status, text: xhr.responseText });
      } catch (error) {
        return JSON.stringify({ error: String(error) });
      }
    })();
  `);

  if (result.error) {
    throw new Error(`Chrome premium fetch failed for ${url}: ${result.error}`);
  }

  let body: unknown = null;
  try {
    body = JSON.parse(result.text ?? "");
  } catch {
    body = result.text ?? null;
  }

  return { url, body };
}

function assignNumber(updates: Partial<PffRow>, column: keyof PffRow, value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    updates[column] = value as never;
    return;
  }
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[,%]/g, "").trim());
    if (Number.isFinite(parsed)) {
      updates[column] = parsed as never;
    }
  }
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

function mapArtifactToUpdates(target: PffRow, artifact: JsonResponseArtifact): Partial<PffRow> {
  const body = artifact.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) return {};

  const data = body as Record<string, unknown>;
  const updates: Partial<PffRow> = {};
  const url = artifact.url;

  if (url.includes("/offense/summary")) {
    assignNumber(updates, "grades_offense", data.grades_offense);
    assignNumber(updates, "grades_pass_block", data.grades_pass_block);
    assignNumber(updates, "grades_run_block", data.grades_run_block);
  } else if (url.includes("/passing/summary")) {
    assignNumber(updates, "grades_offense", data.grades_offense);
    assignNumber(updates, "grades_pass", data.grades_pass);
  } else if (url.includes("/rushing/summary")) {
    assignNumber(updates, "grades_offense", data.grades_offense);
    assignNumber(updates, "grades_run_rb", data.grades_run);
  } else if (url.includes("/receiving/summary")) {
    assignNumber(updates, "grades_offense", data.grades_offense);
    assignNumber(updates, "grades_pass_route", data.grades_pass_route);
    assignNumber(updates, "grades_run_block", data.grades_run_block);
  } else if (url.includes("/defense/summary")) {
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
  }

  return updates;
}

function hasPrimaryGrade(row: Partial<PffRow> & Pick<PffRow, "position">): boolean {
  const keys = POSITION_PRIMARY_GRADE_KEYS[row.position ?? ""] ?? ["grades_overall"];
  return keys.some((key) => row[key] != null);
}

function buildSeasonUrls(playerId: number, season: number) {
  const base = `https://premium.pff.com/api/v1/player`;
  return [
    `${base}/offense/summary?league=ncaa&season=${season}&week=${WEEK_RANGE}&player_id=${playerId}`,
    `${base}/passing/summary?league=ncaa&season=${season}&week=${WEEK_RANGE}&player_id=${playerId}`,
    `${base}/rushing/summary?league=ncaa&season=${season}&week=${WEEK_RANGE}&player_id=${playerId}`,
    `${base}/receiving/summary?league=ncaa&season=${season}&week=${WEEK_RANGE}&player_id=${playerId}`,
    `${base}/defense/summary?league=ncaa&season=${season}&week=${WEEK_RANGE}&player_id=${playerId}`,
    `${base}/snaps/summary?league=ncaa&season=${season}&week=${WEEK_RANGE}&player_id=${playerId}`,
  ];
}

async function getTargets() {
  const { data, error } = await supabase
    .from("player_pff_grades")
    .select("*")
    .eq("season", sourceSeason)
    .order("position")
    .order("player_name");

  if (error || !data) {
    throw new Error(`Failed to fetch source targets: ${error?.message ?? "unknown error"}`);
  }

  const filtered = (data as PffRow[])
    .filter((row) => !hasPrimaryGrade(row))
    .filter((row) => (row.pff_player_id ?? 0) > 0)
    .filter((row) => (playerNames.size ? playerNames.has(row.player_name) : true));

  const sliced = filtered.slice(start);
  return limit ? sliced.slice(0, limit) : sliced;
}

async function writeWorkbook(rows: Array<Record<string, unknown>>, xlsxPath: string) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Prior Season Check");
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
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

function csvEscape(value: unknown): string {
  const text = value == null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });

  const tabState = getPremiumTabState();
  if (tabState.hasUnlock || tabState.hasSignIn) {
    throw new Error(`Live Chrome premium tab is not authenticated. url=${tabState.url} title=${tabState.title}`);
  }

  const targets = await getTargets();
  const recovered: Array<Record<string, unknown>> = [];
  const errors: Array<{ player_name: string; error: string }> = [];

  for (const target of targets) {
    try {
      const updates: Partial<PffRow> = {};
      for (const url of buildSeasonUrls(Number(target.pff_player_id), checkSeason)) {
        const artifact = fetchPremiumJson(url);
        const summarized = summarizeArtifactBody(artifact.body);
        if (!summarized) continue;
        Object.assign(updates, mapArtifactToUpdates(target, { ...artifact, body: summarized }));
      }

      if (hasPrimaryGrade({ ...target, ...updates })) {
        recovered.push({
          player_name: target.player_name,
          position: target.position,
          source_season: sourceSeason,
          check_season: checkSeason,
          source_pff_player_id: target.pff_player_id,
          ...updates,
        });
      }
    } catch (error) {
      errors.push({
        player_name: target.player_name,
        error: error instanceof Error ? error.message : "unknown error",
      });
    }
  }

  const summary = {
    source_season: sourceSeason,
    check_season: checkSeason,
    start,
    targets_checked: targets.length,
    with_prior_primary_grade: recovered.length,
    errors: errors.length,
  };

  const jsonPath = path.join(outDir, `prior-season-${checkSeason}.json`);
  const csvPath = path.join(outDir, `prior-season-${checkSeason}.csv`);
  const xlsxPath = path.join(outDir, `prior-season-${checkSeason}.xlsx`);
  const errorPath = path.join(outDir, `prior-season-${checkSeason}-errors.json`);
  const summaryPath = path.join(outDir, `prior-season-${checkSeason}-summary.json`);

  fs.writeFileSync(jsonPath, JSON.stringify(recovered, null, 2));
  fs.writeFileSync(errorPath, JSON.stringify(errors, null, 2));
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

  const headers = Array.from(new Set(recovered.flatMap((row) => Object.keys(row))));
  const csvLines = [
    headers.join(","),
    ...recovered.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
  ];
  fs.writeFileSync(csvPath, `${csvLines.join("\n")}\n`);
  await writeWorkbook(recovered, xlsxPath);

  console.log(JSON.stringify(summary, null, 2));
  console.log(jsonPath);
  console.log(csvPath);
  console.log(xlsxPath);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
