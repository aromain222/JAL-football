/**
 * PFF Spreadsheet Generator
 *
 * Reads player_pff_grades from Supabase and generates a formatted .xlsx file
 * with one sheet per position group. Each sheet has:
 *   - Frozen header row + auto-filter
 *   - Conditional formatting on PFF grade columns (0-59 red, 60-69 yellow,
 *     70-79 green, 80-89 blue, 90-100 gold)
 *   - Rows sorted by overall grade descending
 *
 * Usage:
 *   npm run pff:spreadsheet
 *   npm run pff:spreadsheet -- --season 2024 --out ./reports/pff.xlsx
 */

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

// ---------------------------------------------------------------------------
// Env
// ---------------------------------------------------------------------------

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function getArg(flag: string): string | null {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 ? (process.argv[idx + 1] ?? null) : null;
}

const seasonArg = getArg("--season");
const SEASON = seasonArg ? Number(seasonArg) : Number(process.env.PFF_SEASON ?? new Date().getFullYear());

const outArg = getArg("--out");
const dateStr = new Date().toISOString().slice(0, 10);
const defaultOut = path.resolve("data", "pff", `pff-stats-${dateStr}.xlsx`);
const outputPath = path.resolve(outArg ?? defaultOut);

// Ensure output directory exists
fs.mkdirSync(path.dirname(outputPath), { recursive: true });

// ---------------------------------------------------------------------------
// Colors for grade conditional formatting
// ---------------------------------------------------------------------------

const GRADE_FILLS = {
  elite:   { argb: "FFFFD700" }, // gold  90–100
  great:   { argb: "FF4472C4" }, // blue  80–89
  good:    { argb: "FF70AD47" }, // green 70–79
  average: { argb: "FFFFEB9C" }, // yellow 60–69
  poor:    { argb: "FFFFC7CE" }, // red    0–59
  header:  { argb: "FF1F4E79" }, // dark navy header
  headerFont: { argb: "FFFFFFFF" }, // white header font
};

type GradeCell = { value: number | null; fill: ExcelJS.Fill; font?: Partial<ExcelJS.Font> };

function gradeCell(grade: number | null | undefined): GradeCell {
  if (grade == null) return { value: null, fill: { type: "pattern", pattern: "none" } };
  let argb: string;
  if (grade >= 90) argb = GRADE_FILLS.elite.argb;
  else if (grade >= 80) argb = GRADE_FILLS.great.argb;
  else if (grade >= 70) argb = GRADE_FILLS.good.argb;
  else if (grade >= 60) argb = GRADE_FILLS.average.argb;
  else argb = GRADE_FILLS.poor.argb;

  return {
    value: grade,
    fill: { type: "pattern", pattern: "solid", fgColor: { argb } },
    font: grade >= 80 ? { bold: true } : undefined,
  };
}

// ---------------------------------------------------------------------------
// Column definition helper
// ---------------------------------------------------------------------------

type ColDef = {
  header: string;
  key: string;
  width: number;
  isGrade?: boolean;
  numFmt?: string;
};

function addSheet(
  wb: ExcelJS.Workbook,
  name: string,
  columns: ColDef[],
  rows: Record<string, unknown>[]
): void {
  const ws = wb.addWorksheet(name);

  // Define columns
  ws.columns = columns.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width,
  }));

  // Style header row
  const headerRow = ws.getRow(1);
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GRADE_FILLS.header.argb } };
    cell.font = { bold: true, color: { argb: GRADE_FILLS.headerFont.argb }, size: 11 };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });
  headerRow.height = 30;

  // Freeze header
  ws.views = [{ state: "frozen", ySplit: 1 }];

  // Auto-filter
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };

  // Add data rows
  for (const rowData of rows) {
    const excelRow = ws.addRow({});
    columns.forEach((col, colIdx) => {
      const val = rowData[col.key];
      const cell = excelRow.getCell(colIdx + 1);

      if (col.isGrade) {
        const gc = gradeCell(val as number | null);
        cell.value = gc.value;
        cell.fill = gc.fill;
        if (gc.font) cell.font = gc.font;
      } else {
        cell.value = val == null ? "" : (val as ExcelJS.CellValue);
      }

      cell.alignment = { vertical: "middle", horizontal: typeof val === "number" ? "center" : "left" };
      if (col.numFmt && typeof val === "number") {
        cell.numFmt = col.numFmt;
      }
    });

    // Alternating row color for non-grade rows
    if (excelRow.number % 2 === 0) {
      excelRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
        if (!columns[colNum - 1]?.isGrade || (cell.value == null)) {
          if (!cell.fill || (cell.fill as ExcelJS.FillPattern).pattern === "none") {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } };
          }
        }
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Sheet definitions
// ---------------------------------------------------------------------------

type PffRow = Record<string, unknown>;

function makeAllPlayersSheet(wb: ExcelJS.Workbook, rows: PffRow[]): void {
  const cols: ColDef[] = [
    { header: "Player", key: "player_name", width: 22 },
    { header: "Team", key: "team_name", width: 14 },
    { header: "Pos", key: "position", width: 8 },
    { header: "Season", key: "season", width: 8 },
    { header: "Overall", key: "grades_overall", width: 10, isGrade: true },
    { header: "Offense", key: "grades_offense", width: 10, isGrade: true },
    { header: "Defense", key: "grades_defense", width: 10, isGrade: true },
    { header: "ST", key: "grades_special_teams", width: 8, isGrade: true },
    { header: "Off Snaps", key: "snaps_offense", width: 10 },
    { header: "Def Snaps", key: "snaps_defense", width: 10 },
  ];
  const sorted = [...rows].sort((a, b) => ((b.grades_overall as number) ?? 0) - ((a.grades_overall as number) ?? 0));
  addSheet(wb, "All Players", cols, sorted);
}

function makeQbSheet(wb: ExcelJS.Workbook, rows: PffRow[]): void {
  const cols: ColDef[] = [
    { header: "Player", key: "player_name", width: 22 },
    { header: "Team", key: "team_name", width: 14 },
    { header: "Snaps", key: "snaps_offense", width: 8 },
    { header: "Overall", key: "grades_overall", width: 10, isGrade: true },
    { header: "Pass Grade", key: "grades_pass", width: 12, isGrade: true },
    { header: "Comp%", key: "stats_adjusted_completion_pct", width: 9, numFmt: "0.0" },
    { header: "Att", key: "stats_attempts", width: 7 },
    { header: "Yds", key: "stats_passing_yards", width: 7 },
    { header: "TDs", key: "stats_passing_tds", width: 6 },
    { header: "INTs", key: "stats_interceptions", width: 6 },
    { header: "BTT", key: "stats_big_time_throws", width: 6 },
    { header: "TWP", key: "stats_turnover_worthy_plays", width: 6 },
    { header: "YPA", key: "stats_yards_per_attempt", width: 7, numFmt: "0.0" },
    { header: "TTT", key: "stats_time_to_throw", width: 7, numFmt: "0.00" },
    { header: "P→Sack%", key: "stats_pressure_to_sack", width: 9, numFmt: "0.0" },
  ];
  const qbs = rows
    .filter((r) => String(r.position ?? "").toUpperCase() === "QB")
    .sort((a, b) => ((b.grades_overall as number) ?? 0) - ((a.grades_overall as number) ?? 0));
  addSheet(wb, "QB", cols, qbs);
}

function makeWrTeSheet(wb: ExcelJS.Workbook, rows: PffRow[]): void {
  const cols: ColDef[] = [
    { header: "Player", key: "player_name", width: 22 },
    { header: "Team", key: "team_name", width: 14 },
    { header: "Pos", key: "position", width: 6 },
    { header: "Snaps", key: "snaps_offense", width: 8 },
    { header: "Overall", key: "grades_overall", width: 10, isGrade: true },
    { header: "Route Grade", key: "grades_pass_route", width: 12, isGrade: true },
    { header: "ADOT", key: "stats_adot", width: 7, numFmt: "0.0" },
    { header: "Tgts", key: "stats_targets", width: 7 },
    { header: "Rec", key: "stats_receptions", width: 7 },
    { header: "Catch%", key: "stats_catch_rate", width: 8, numFmt: "0.0" },
    { header: "Yds", key: "stats_receiving_yards", width: 7 },
    { header: "TDs", key: "stats_receiving_tds", width: 6 },
    { header: "Drops", key: "stats_drops", width: 7 },
    { header: "YAC/Rec", key: "stats_yac_per_reception", width: 9, numFmt: "0.0" },
    { header: "Contested%", key: "stats_contested_catch_rate", width: 11, numFmt: "0.0" },
    { header: "YPRR", key: "stats_yards_per_route_run", width: 8, numFmt: "0.00" },
    { header: "Route%", key: "stats_route_participation_pct", width: 8, numFmt: "0.0" },
    { header: "Slot Snaps", key: "snaps_slot", width: 11 },
    { header: "Wide Snaps", key: "snaps_wide_left", width: 11 },
    { header: "Inline Snaps", key: "snaps_inline_te", width: 12 },
    { header: "Backfield Snaps", key: "snaps_backfield", width: 14 },
    // Route tree
    { header: "Slant Tgts", key: "stats_routes_slant_targets", width: 10 },
    { header: "Slant Rec", key: "stats_routes_slant_receptions", width: 10 },
    { header: "Hitch Tgts", key: "stats_routes_hitch_targets", width: 10 },
    { header: "Out Tgts", key: "stats_routes_out_targets", width: 9 },
    { header: "Curl Tgts", key: "stats_routes_curl_targets", width: 9 },
    { header: "Dig Tgts", key: "stats_routes_dig_targets", width: 9 },
    { header: "Post Tgts", key: "stats_routes_post_targets", width: 9 },
    { header: "Corner Tgts", key: "stats_routes_corner_targets", width: 11 },
    { header: "Go/Fly Tgts", key: "stats_routes_go_targets", width: 11 },
    { header: "Screen Tgts", key: "stats_routes_screen_targets", width: 11 },
    { header: "Cross Tgts", key: "stats_routes_crosser_targets", width: 10 },
  ];
  const players = rows
    .filter((r) => ["WR", "TE"].includes(String(r.position ?? "").toUpperCase()))
    .sort((a, b) => ((b.grades_overall as number) ?? 0) - ((a.grades_overall as number) ?? 0));
  addSheet(wb, "WR-TE", cols, players);
}

function makeRbSheet(wb: ExcelJS.Workbook, rows: PffRow[]): void {
  const cols: ColDef[] = [
    { header: "Player", key: "player_name", width: 22 },
    { header: "Team", key: "team_name", width: 14 },
    { header: "Snaps", key: "snaps_offense", width: 8 },
    { header: "Overall", key: "grades_overall", width: 10, isGrade: true },
    { header: "Run Grade", key: "grades_run_rb", width: 11, isGrade: true },
    { header: "Pass Block", key: "grades_pass_block_rb", width: 11, isGrade: true },
    { header: "Carries", key: "stats_carries", width: 8 },
    { header: "Rush Yds", key: "stats_rushing_yards", width: 9 },
    { header: "Rush TDs", key: "stats_rushing_tds", width: 9 },
    { header: "YAC/Car", key: "stats_yards_after_contact_per_carry", width: 9, numFmt: "0.0" },
    { header: "Broken Tkls", key: "stats_broken_tackles", width: 11 },
    { header: "Elusive Rtg", key: "stats_elusive_rating", width: 11, numFmt: "0.0" },
    { header: "Fumbles", key: "stats_fumbles", width: 8 },
    { header: "Targets", key: "stats_targets", width: 8 },
    { header: "Rec", key: "stats_receptions", width: 7 },
    { header: "Rec Yds", key: "stats_receiving_yards", width: 9 },
    { header: "Press Allowed", key: "stats_pressures_allowed_rb", width: 13 },
    { header: "Off Snaps", key: "snaps_offset", width: 10 },
    { header: "Slot Snaps", key: "snaps_slot", width: 10 },
    { header: "Inline Snaps", key: "snaps_inline_te", width: 12 },
  ];
  const rbs = rows
    .filter((r) => String(r.position ?? "").toUpperCase() === "RB")
    .sort((a, b) => ((b.grades_overall as number) ?? 0) - ((a.grades_overall as number) ?? 0));
  addSheet(wb, "RB", cols, rbs);
}

function makeOlSheet(wb: ExcelJS.Workbook, rows: PffRow[]): void {
  const cols: ColDef[] = [
    { header: "Player", key: "player_name", width: 22 },
    { header: "Team", key: "team_name", width: 14 },
    { header: "Pos", key: "position", width: 6 },
    { header: "Snaps", key: "snaps_offense", width: 8 },
    { header: "Overall", key: "grades_overall", width: 10, isGrade: true },
    { header: "Pass Block", key: "grades_pass_block", width: 11, isGrade: true },
    { header: "Run Block", key: "grades_run_block", width: 11, isGrade: true },
    { header: "PB Snaps", key: "stats_pass_block_snaps", width: 9 },
    { header: "Press Allowed", key: "stats_pressures_allowed", width: 13 },
    { header: "Sacks Allow", key: "stats_sacks_allowed", width: 11, numFmt: "0.0" },
    { header: "Hits Allow", key: "stats_hits_allowed", width: 10 },
    { header: "Hurries Allow", key: "stats_hurries_allowed", width: 13 },
    { header: "RB Snaps", key: "stats_run_block_snaps", width: 9 },
    { header: "Penalties", key: "stats_penalties", width: 9 },
    { header: "LT Snaps", key: "snaps_at_left_tackle", width: 9 },
    { header: "LG Snaps", key: "snaps_at_left_guard", width: 9 },
    { header: "C Snaps", key: "snaps_at_center", width: 9 },
    { header: "RG Snaps", key: "snaps_at_right_guard", width: 9 },
    { header: "RT Snaps", key: "snaps_at_right_tackle", width: 9 },
  ];
  const olPositions = new Set(["T", "G", "C", "OT", "OG", "OL", "LT", "RT", "LG", "RG"]);
  const players = rows
    .filter((r) => olPositions.has(String(r.position ?? "").toUpperCase()))
    .sort((a, b) => ((b.grades_overall as number) ?? 0) - ((a.grades_overall as number) ?? 0));
  addSheet(wb, "OL", cols, players);
}

function makeDlSheet(wb: ExcelJS.Workbook, rows: PffRow[]): void {
  const cols: ColDef[] = [
    { header: "Player", key: "player_name", width: 22 },
    { header: "Team", key: "team_name", width: 14 },
    { header: "Pos", key: "position", width: 6 },
    { header: "Snaps", key: "snaps_defense", width: 8 },
    { header: "Overall", key: "grades_overall", width: 10, isGrade: true },
    { header: "Pass Rush", key: "grades_pass_rush", width: 11, isGrade: true },
    { header: "Run Def", key: "grades_run_defense_dl", width: 10, isGrade: true },
    { header: "PR Snaps", key: "stats_pass_rush_snaps", width: 9 },
    { header: "Pressures", key: "stats_pressures", width: 10 },
    { header: "Sacks", key: "stats_sacks", width: 7, numFmt: "0.0" },
    { header: "Hits", key: "stats_hits", width: 6 },
    { header: "Hurries", key: "stats_hurries", width: 8 },
    { header: "Run Stops", key: "stats_run_stops", width: 10 },
    { header: "Stop%", key: "stats_run_stop_pct", width: 8, numFmt: "0.0" },
    { header: "LE Snaps", key: "snaps_at_left_end", width: 9 },
    { header: "RE Snaps", key: "snaps_at_right_end", width: 9 },
    { header: "Interior Snaps", key: "snaps_interior_dl", width: 14 },
  ];
  const dlPositions = new Set(["DT", "NT", "DE", "ED", "IDL", "DL", "EDGE"]);
  const players = rows
    .filter((r) => dlPositions.has(String(r.position ?? "").toUpperCase()))
    .sort((a, b) => ((b.grades_overall as number) ?? 0) - ((a.grades_overall as number) ?? 0));
  addSheet(wb, "DL-Edge", cols, players);
}

function makeLbSheet(wb: ExcelJS.Workbook, rows: PffRow[]): void {
  const cols: ColDef[] = [
    { header: "Player", key: "player_name", width: 22 },
    { header: "Team", key: "team_name", width: 14 },
    { header: "Pos", key: "position", width: 6 },
    { header: "Snaps", key: "snaps_defense", width: 8 },
    { header: "Overall", key: "grades_overall", width: 10, isGrade: true },
    { header: "Coverage", key: "grades_coverage_lb", width: 11, isGrade: true },
    { header: "Tackle", key: "grades_tackle", width: 10, isGrade: true },
    { header: "Run Def", key: "grades_run_defense_lb", width: 10, isGrade: true },
    { header: "Pass Rush", key: "grades_pass_rush_lb", width: 11, isGrade: true },
    { header: "Tackles", key: "stats_tackles", width: 8 },
    { header: "Assists", key: "stats_assists", width: 8 },
    { header: "TFL/Stops", key: "stats_stops_lb", width: 10 },
    { header: "Missed Tkls", key: "stats_missed_tackles", width: 11 },
    { header: "FF", key: "stats_forced_fumbles", width: 6 },
    { header: "In-Box Snaps", key: "snaps_in_box_lb", width: 12 },
    { header: "Off-Ball Snaps", key: "snaps_off_ball_lb", width: 13 },
  ];
  const lbPositions = new Set(["LB", "ILB", "OLB", "MLB", "WILL", "MIKE", "SAM"]);
  const players = rows
    .filter((r) => lbPositions.has(String(r.position ?? "").toUpperCase()))
    .sort((a, b) => ((b.grades_overall as number) ?? 0) - ((a.grades_overall as number) ?? 0));
  addSheet(wb, "LB", cols, players);
}

function makeDbSheet(wb: ExcelJS.Workbook, rows: PffRow[]): void {
  const cols: ColDef[] = [
    { header: "Player", key: "player_name", width: 22 },
    { header: "Team", key: "team_name", width: 14 },
    { header: "Pos", key: "position", width: 6 },
    { header: "Snaps", key: "snaps_defense", width: 8 },
    { header: "Overall", key: "grades_overall", width: 10, isGrade: true },
    { header: "Coverage", key: "grades_coverage_db", width: 11, isGrade: true },
    { header: "Man Cov", key: "grades_man_coverage", width: 10, isGrade: true },
    { header: "Zone Cov", key: "grades_zone_coverage", width: 10, isGrade: true },
    { header: "Tackle", key: "grades_tackle_db", width: 9, isGrade: true },
    { header: "Cov Snaps", key: "stats_pff_coverage_snaps", width: 10 },
    { header: "Tgts Allow", key: "stats_targets_allowed", width: 11 },
    { header: "Rec Allow", key: "stats_receptions_allowed", width: 11 },
    { header: "Yds Allow", key: "stats_yards_allowed", width: 10 },
    { header: "TDs Allow", key: "stats_tds_allowed", width: 10 },
    { header: "INT", key: "stats_interceptions_def", width: 6 },
    { header: "PBU", key: "stats_pass_breakups", width: 6 },
    { header: "Yds/CovSnap", key: "stats_yards_per_coverage_snap", width: 12, numFmt: "0.00" },
    { header: "QBR Allow", key: "stats_passer_rating_allowed", width: 10, numFmt: "0.0" },
    { header: "FS Snaps", key: "snaps_free_safety", width: 9 },
    { header: "SS Snaps", key: "snaps_strong_safety", width: 9 },
    { header: "Slot CB Snaps", key: "snaps_slot_cb", width: 13 },
    { header: "Outside CB Snaps", key: "snaps_outside_cb", width: 15 },
    { header: "In-Box Snaps", key: "snaps_in_box_db", width: 12 },
    { header: "Deep Snaps", key: "snaps_deep_safety", width: 11 },
  ];
  const dbPositions = new Set(["CB", "S", "SS", "FS", "DB", "SAF", "NCB"]);
  const players = rows
    .filter((r) => dbPositions.has(String(r.position ?? "").toUpperCase()))
    .sort((a, b) => ((b.grades_overall as number) ?? 0) - ((a.grades_overall as number) ?? 0));
  addSheet(wb, "DB-Safety", cols, players);
}

// ---------------------------------------------------------------------------
// Portal Target Board — all positions
// ---------------------------------------------------------------------------

type PortalPlayer = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  previous_school: string | null;
  current_school: string | null;
  hometown: string | null;
  class_year: string | null;
  eligibility_remaining: number | null;
  stars: number | null;
};

// Shared helper — build base row object for a portal player
function buildPortalRow(p: PortalPlayer, pffByPlayerId: Map<string, PffRow>): Record<string, unknown> {
  const pff = pffByPlayerId.get(p.id) ?? {};
  return {
    player_name: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(),
    position: p.position,
    previous_school: p.previous_school,
    class_year: p.class_year,
    eligibility_remaining: p.eligibility_remaining,
    stars: p.stars,
    hometown: p.hometown,
    has_pff: pffByPlayerId.has(p.id) ? "Yes" : "No PFF match",
    ...pff,
  };
}

// Sort helper — PFF data first by grade desc, then alphabetically
function portalSort(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return [...rows].sort((a, b) => {
    const aGrade = (a.grades_overall as number | null) ?? -1;
    const bGrade = (b.grades_overall as number | null) ?? -1;
    if (aGrade !== bGrade) return bGrade - aGrade;
    return String(a.player_name).localeCompare(String(b.player_name));
  });
}

// Profile columns shared across all portal sheets
const PROFILE_COLS: ColDef[] = [
  { header: "Player", key: "player_name", width: 22 },
  { header: "Prev School", key: "previous_school", width: 18 },
  { header: "Class", key: "class_year", width: 7 },
  { header: "Elig", key: "eligibility_remaining", width: 6 },
  { header: "Stars", key: "stars", width: 6 },
  { header: "Hometown", key: "hometown", width: 20 },
];

// ---------------------------------------------------------------------------
// Summary portal board — all positions
// ---------------------------------------------------------------------------
function makePortalSummarySheet(
  wb: ExcelJS.Workbook,
  portalPlayers: PortalPlayer[],
  pffByPlayerId: Map<string, PffRow>
): void {
  const cols: ColDef[] = [
    { header: "Player", key: "player_name", width: 22 },
    { header: "Pos", key: "position", width: 6 },
    { header: "Prev School", key: "previous_school", width: 18 },
    { header: "Class", key: "class_year", width: 7 },
    { header: "Elig", key: "eligibility_remaining", width: 6 },
    { header: "Stars", key: "stars", width: 6 },
    { header: "Hometown", key: "hometown", width: 20 },
    { header: "Overall", key: "grades_overall", width: 10, isGrade: true },
    { header: "Offense", key: "grades_offense", width: 10, isGrade: true },
    { header: "Defense", key: "grades_defense", width: 10, isGrade: true },
    { header: "Off Snaps", key: "snaps_offense", width: 10 },
    { header: "Def Snaps", key: "snaps_defense", width: 10 },
    { header: "PFF Data?", key: "has_pff", width: 10 },
  ];
  const rows = portalSort(portalPlayers.map((p) => buildPortalRow(p, pffByPlayerId)));
  addSheet(wb, "Portal Target Board", cols, rows);
}

// ---------------------------------------------------------------------------
// Portal QB sheet
// ---------------------------------------------------------------------------
function makePortalQbSheet(
  wb: ExcelJS.Workbook,
  portalPlayers: PortalPlayer[],
  pffByPlayerId: Map<string, PffRow>
): void {
  const cols: ColDef[] = [
    ...PROFILE_COLS,
    { header: "Overall", key: "grades_overall", width: 10, isGrade: true },
    { header: "Pass Grade", key: "grades_pass", width: 12, isGrade: true },
    { header: "Comp%", key: "stats_adjusted_completion_pct", width: 9, numFmt: "0.0" },
    { header: "Att", key: "stats_attempts", width: 7 },
    { header: "Yds", key: "stats_passing_yards", width: 7 },
    { header: "TDs", key: "stats_passing_tds", width: 6 },
    { header: "INTs", key: "stats_interceptions", width: 6 },
    { header: "BTT", key: "stats_big_time_throws", width: 6 },
    { header: "TWP", key: "stats_turnover_worthy_plays", width: 6 },
    { header: "YPA", key: "stats_yards_per_attempt", width: 7, numFmt: "0.0" },
    { header: "TTT", key: "stats_time_to_throw", width: 7, numFmt: "0.00" },
    { header: "PFF Data?", key: "has_pff", width: 10 },
  ];
  const qbs = portalPlayers.filter((p) => String(p.position ?? "").toUpperCase() === "QB");
  const rows = portalSort(qbs.map((p) => buildPortalRow(p, pffByPlayerId)));
  addSheet(wb, "Portal QB", cols, rows);
}

// ---------------------------------------------------------------------------
// Portal WR-TE sheet
// ---------------------------------------------------------------------------
function makePortalWrTeSheet(
  wb: ExcelJS.Workbook,
  portalPlayers: PortalPlayer[],
  pffByPlayerId: Map<string, PffRow>
): void {
  const cols: ColDef[] = [
    { header: "Player", key: "player_name", width: 22 },
    { header: "Pos", key: "position", width: 6 },
    { header: "Prev School", key: "previous_school", width: 18 },
    { header: "Class", key: "class_year", width: 7 },
    { header: "Elig", key: "eligibility_remaining", width: 6 },
    { header: "Stars", key: "stars", width: 6 },
    { header: "Hometown", key: "hometown", width: 20 },
    { header: "Overall", key: "grades_overall", width: 10, isGrade: true },
    { header: "Route Grade", key: "grades_pass_route", width: 12, isGrade: true },
    { header: "ADOT", key: "stats_adot", width: 7, numFmt: "0.0" },
    { header: "Tgts", key: "stats_targets", width: 7 },
    { header: "Rec", key: "stats_receptions", width: 6 },
    { header: "Catch%", key: "stats_catch_rate", width: 8, numFmt: "0.0" },
    { header: "Yds", key: "stats_receiving_yards", width: 7 },
    { header: "TDs", key: "stats_receiving_tds", width: 6 },
    { header: "Drops", key: "stats_drops", width: 7 },
    { header: "YAC/Rec", key: "stats_yac_per_reception", width: 9, numFmt: "0.0" },
    { header: "YPRR", key: "stats_yards_per_route_run", width: 8, numFmt: "0.00" },
    { header: "Contested%", key: "stats_contested_catch_rate", width: 11, numFmt: "0.0" },
    { header: "Off Snaps", key: "snaps_offense", width: 10 },
    { header: "Slot Snaps", key: "snaps_slot", width: 11 },
    { header: "Wide Snaps", key: "snaps_wide_left", width: 11 },
    { header: "Inline Snaps", key: "snaps_inline_te", width: 12 },
    { header: "Slant Tgts", key: "stats_routes_slant_targets", width: 10 },
    { header: "Hitch Tgts", key: "stats_routes_hitch_targets", width: 10 },
    { header: "Out Tgts", key: "stats_routes_out_targets", width: 9 },
    { header: "Curl Tgts", key: "stats_routes_curl_targets", width: 9 },
    { header: "Dig Tgts", key: "stats_routes_dig_targets", width: 9 },
    { header: "Post Tgts", key: "stats_routes_post_targets", width: 9 },
    { header: "Corner Tgts", key: "stats_routes_corner_targets", width: 11 },
    { header: "Go/Fly Tgts", key: "stats_routes_go_targets", width: 11 },
    { header: "Screen Tgts", key: "stats_routes_screen_targets", width: 11 },
    { header: "Cross Tgts", key: "stats_routes_crosser_targets", width: 10 },
    { header: "PFF Data?", key: "has_pff", width: 10 },
  ];
  const players = portalPlayers.filter((p) => ["WR", "TE"].includes(String(p.position ?? "").toUpperCase()));
  const rows = portalSort(players.map((p) => buildPortalRow(p, pffByPlayerId)));
  addSheet(wb, "Portal WR-TE", cols, rows);
}

// ---------------------------------------------------------------------------
// Portal RB sheet
// ---------------------------------------------------------------------------
function makePortalRbSheet(
  wb: ExcelJS.Workbook,
  portalPlayers: PortalPlayer[],
  pffByPlayerId: Map<string, PffRow>
): void {
  const cols: ColDef[] = [
    ...PROFILE_COLS,
    { header: "Overall", key: "grades_overall", width: 10, isGrade: true },
    { header: "Run Grade", key: "grades_run_rb", width: 11, isGrade: true },
    { header: "Pass Block", key: "grades_pass_block_rb", width: 11, isGrade: true },
    { header: "Carries", key: "stats_carries", width: 8 },
    { header: "Rush Yds", key: "stats_rushing_yards", width: 9 },
    { header: "Rush TDs", key: "stats_rushing_tds", width: 9 },
    { header: "YAC/Car", key: "stats_yards_after_contact_per_carry", width: 9, numFmt: "0.0" },
    { header: "Broken Tkls", key: "stats_broken_tackles", width: 11 },
    { header: "Elusive Rtg", key: "stats_elusive_rating", width: 11, numFmt: "0.0" },
    { header: "Targets", key: "stats_targets", width: 8 },
    { header: "Rec", key: "stats_receptions", width: 7 },
    { header: "Rec Yds", key: "stats_receiving_yards", width: 9 },
    { header: "PFF Data?", key: "has_pff", width: 10 },
  ];
  const rbs = portalPlayers.filter((p) => String(p.position ?? "").toUpperCase() === "RB");
  const rows = portalSort(rbs.map((p) => buildPortalRow(p, pffByPlayerId)));
  addSheet(wb, "Portal RB", cols, rows);
}

// ---------------------------------------------------------------------------
// Portal OL sheet
// ---------------------------------------------------------------------------
function makePortalOlSheet(
  wb: ExcelJS.Workbook,
  portalPlayers: PortalPlayer[],
  pffByPlayerId: Map<string, PffRow>
): void {
  const OL_POS = new Set(["T", "G", "C", "OT", "OG", "OL", "LT", "RT", "LG", "RG"]);
  const cols: ColDef[] = [
    { header: "Player", key: "player_name", width: 22 },
    { header: "Pos", key: "position", width: 6 },
    { header: "Prev School", key: "previous_school", width: 18 },
    { header: "Class", key: "class_year", width: 7 },
    { header: "Elig", key: "eligibility_remaining", width: 6 },
    { header: "Stars", key: "stars", width: 6 },
    { header: "Hometown", key: "hometown", width: 20 },
    { header: "Overall", key: "grades_overall", width: 10, isGrade: true },
    { header: "Pass Block", key: "grades_pass_block", width: 11, isGrade: true },
    { header: "Run Block", key: "grades_run_block", width: 11, isGrade: true },
    { header: "Press Allowed", key: "stats_pressures_allowed", width: 13 },
    { header: "Sacks Allow", key: "stats_sacks_allowed", width: 11, numFmt: "0.0" },
    { header: "Hurries Allow", key: "stats_hurries_allowed", width: 13 },
    { header: "Penalties", key: "stats_penalties", width: 9 },
    { header: "LT Snaps", key: "snaps_at_left_tackle", width: 9 },
    { header: "LG Snaps", key: "snaps_at_left_guard", width: 9 },
    { header: "C Snaps", key: "snaps_at_center", width: 9 },
    { header: "RG Snaps", key: "snaps_at_right_guard", width: 9 },
    { header: "RT Snaps", key: "snaps_at_right_tackle", width: 9 },
    { header: "PFF Data?", key: "has_pff", width: 10 },
  ];
  const players = portalPlayers.filter((p) => OL_POS.has(String(p.position ?? "").toUpperCase()));
  const rows = portalSort(players.map((p) => buildPortalRow(p, pffByPlayerId)));
  addSheet(wb, "Portal OL", cols, rows);
}

// ---------------------------------------------------------------------------
// Portal DL-EDGE sheet
// ---------------------------------------------------------------------------
function makePortalDlSheet(
  wb: ExcelJS.Workbook,
  portalPlayers: PortalPlayer[],
  pffByPlayerId: Map<string, PffRow>
): void {
  const DL_POS = new Set(["DT", "NT", "DE", "ED", "IDL", "DL", "EDGE"]);
  const cols: ColDef[] = [
    { header: "Player", key: "player_name", width: 22 },
    { header: "Pos", key: "position", width: 6 },
    { header: "Prev School", key: "previous_school", width: 18 },
    { header: "Class", key: "class_year", width: 7 },
    { header: "Elig", key: "eligibility_remaining", width: 6 },
    { header: "Stars", key: "stars", width: 6 },
    { header: "Hometown", key: "hometown", width: 20 },
    { header: "Overall", key: "grades_overall", width: 10, isGrade: true },
    { header: "Pass Rush", key: "grades_pass_rush", width: 11, isGrade: true },
    { header: "Run Def", key: "grades_run_defense_dl", width: 10, isGrade: true },
    { header: "Pressures", key: "stats_pressures", width: 10 },
    { header: "Sacks", key: "stats_sacks", width: 7, numFmt: "0.0" },
    { header: "Hits", key: "stats_hits", width: 6 },
    { header: "Hurries", key: "stats_hurries", width: 8 },
    { header: "Run Stops", key: "stats_run_stops", width: 10 },
    { header: "LE Snaps", key: "snaps_at_left_end", width: 9 },
    { header: "RE Snaps", key: "snaps_at_right_end", width: 9 },
    { header: "Interior Snaps", key: "snaps_interior_dl", width: 14 },
    { header: "PFF Data?", key: "has_pff", width: 10 },
  ];
  const players = portalPlayers.filter((p) => DL_POS.has(String(p.position ?? "").toUpperCase()));
  const rows = portalSort(players.map((p) => buildPortalRow(p, pffByPlayerId)));
  addSheet(wb, "Portal DL-EDGE", cols, rows);
}

// ---------------------------------------------------------------------------
// Portal LB sheet
// ---------------------------------------------------------------------------
function makePortalLbSheet(
  wb: ExcelJS.Workbook,
  portalPlayers: PortalPlayer[],
  pffByPlayerId: Map<string, PffRow>
): void {
  const LB_POS = new Set(["LB", "ILB", "OLB", "MLB", "WILL", "MIKE", "SAM"]);
  const cols: ColDef[] = [
    ...PROFILE_COLS,
    { header: "Overall", key: "grades_overall", width: 10, isGrade: true },
    { header: "Coverage", key: "grades_coverage_lb", width: 11, isGrade: true },
    { header: "Tackle", key: "grades_tackle", width: 10, isGrade: true },
    { header: "Run Def", key: "grades_run_defense_lb", width: 10, isGrade: true },
    { header: "Pass Rush", key: "grades_pass_rush_lb", width: 11, isGrade: true },
    { header: "Tackles", key: "stats_tackles", width: 8 },
    { header: "Assists", key: "stats_assists", width: 8 },
    { header: "Missed Tkls", key: "stats_missed_tackles", width: 11 },
    { header: "FF", key: "stats_forced_fumbles", width: 6 },
    { header: "PFF Data?", key: "has_pff", width: 10 },
  ];
  const players = portalPlayers.filter((p) => LB_POS.has(String(p.position ?? "").toUpperCase()));
  const rows = portalSort(players.map((p) => buildPortalRow(p, pffByPlayerId)));
  addSheet(wb, "Portal LB", cols, rows);
}

// ---------------------------------------------------------------------------
// Portal DB (CB + Safety) sheet
// ---------------------------------------------------------------------------
function makePortalDbSheet(
  wb: ExcelJS.Workbook,
  portalPlayers: PortalPlayer[],
  pffByPlayerId: Map<string, PffRow>
): void {
  const DB_POS = new Set(["CB", "S", "SS", "FS", "DB", "SAF", "NCB"]);
  const cols: ColDef[] = [
    { header: "Player", key: "player_name", width: 22 },
    { header: "Pos", key: "position", width: 6 },
    { header: "Prev School", key: "previous_school", width: 18 },
    { header: "Class", key: "class_year", width: 7 },
    { header: "Elig", key: "eligibility_remaining", width: 6 },
    { header: "Stars", key: "stars", width: 6 },
    { header: "Hometown", key: "hometown", width: 20 },
    { header: "Overall", key: "grades_overall", width: 10, isGrade: true },
    { header: "Coverage", key: "grades_coverage_db", width: 11, isGrade: true },
    { header: "Man Cov", key: "grades_man_coverage", width: 10, isGrade: true },
    { header: "Zone Cov", key: "grades_zone_coverage", width: 10, isGrade: true },
    { header: "Tgts Allowed", key: "stats_targets_allowed", width: 12 },
    { header: "Rec Allowed", key: "stats_receptions_allowed", width: 12 },
    { header: "Yds Allowed", key: "stats_yards_allowed", width: 11 },
    { header: "INT", key: "stats_interceptions_def", width: 6 },
    { header: "PBU", key: "stats_pass_breakups", width: 6 },
    { header: "QBR Allowed", key: "stats_passer_rating_allowed", width: 11, numFmt: "0.0" },
    { header: "FS Snaps", key: "snaps_free_safety", width: 9 },
    { header: "SS Snaps", key: "snaps_strong_safety", width: 9 },
    { header: "Slot CB Snaps", key: "snaps_slot_cb", width: 13 },
    { header: "Outside CB Snaps", key: "snaps_outside_cb", width: 15 },
    { header: "PFF Data?", key: "has_pff", width: 10 },
  ];
  const players = portalPlayers.filter((p) => DB_POS.has(String(p.position ?? "").toUpperCase()));
  const rows = portalSort(players.map((p) => buildPortalRow(p, pffByPlayerId)));
  addSheet(wb, "Portal DB", cols, rows);
}

// ---------------------------------------------------------------------------
// Main — reads CSVs directly from --csv-dir folder
// ---------------------------------------------------------------------------

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === "," && !inQuotes) { result.push(cur); cur = ""; }
    else { cur += ch; }
  }
  result.push(cur);
  return result;
}

function readCSV(filePath: string): PffRow[] {
  // Read as raw buffer to detect encoding
  const buf = fs.readFileSync(filePath);
  let content: string;

  // UTF-16 LE BOM: FF FE
  if (buf[0] === 0xFF && buf[1] === 0xFE) {
    content = buf.slice(2).toString("utf16le");
  // UTF-16 BE BOM: FE FF
  } else if (buf[0] === 0xFE && buf[1] === 0xFF) {
    content = buf.slice(2).swap16().toString("utf16le");
  // UTF-8 BOM: EF BB BF
  } else if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
    content = buf.slice(3).toString("utf-8");
  } else {
    content = buf.toString("utf-8");
  }
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]).map((h) => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map((line) => {
    const vals = parseCSVLine(line);
    const row: PffRow = {};
    headers.forEach((h, i) => {
      const raw = (vals[i] ?? "").trim().replace(/^"|"$/g, "");
      // Strip non-printable/control characters from strings
      const clean = raw.replace(/[^\x20-\x7E\u00A0-\uFFFC]/g, "").trim();
      row[h] = clean === "" ? null : isNaN(Number(clean)) ? clean : Number(clean);
    });
    return row;
  });
}

async function main() {
  const csvDir = getArg("--csv-dir") ?? path.resolve("data", "pff", "2025");

  if (!fs.existsSync(csvDir)) {
    console.error(`CSV directory not found: ${csvDir}`);
    console.error(`Usage: npm run pff:spreadsheet -- --csv-dir "/path/to/csvs"`);
    process.exit(1);
  }

  const allCsvFiles = fs.readdirSync(csvDir).filter((f) => f.endsWith(".csv"));
  // Skip "copy" files; skip "(N)" variants only if the base file also exists in the same folder
  const files = allCsvFiles.filter((f) => {
    if (f.toLowerCase().includes("copy")) return false;
    const dupMatch = f.match(/^(.+) \(\d+\)\.csv$/i);
    if (dupMatch) {
      const baseName = dupMatch[1] + ".csv";
      return !allCsvFiles.includes(baseName); // keep (1) when no base file exists
    }
    return true;
  });

  console.log(`\nReading ${files.length} CSV files from ${csvDir}:`);

  // Merge all CSVs by player_id (primary key)
  const playerMap = new Map<string, PffRow>();

  for (const file of files) {
    const rows = readCSV(path.join(csvDir, file));
    const sampleCols = rows[0] ? Object.keys(rows[0]).join(", ") : "(empty)";
    console.log(`  ${file}: ${rows.length} rows`);
    console.log(`    columns: ${sampleCols}`);
    for (const row of rows) {
      const pid = String(row.player_id ?? "");
      const name = String(row.player ?? "");
      const team = String(row.team_name ?? "");
      const key = pid || `${name}|${team}`;
      if (!key || key === "|") continue;
      const existing = playerMap.get(key) ?? {};
      // Merge: existing fields win for grades, new file adds missing fields
      const merged: PffRow = { ...row, ...existing };
      // Always keep best grade values
      for (const k of Object.keys(row)) {
        if (k.startsWith("grades_") && row[k] != null) {
          if (existing[k] == null) merged[k] = row[k];
        }
      }
      merged.player_name = name || String(existing.player_name ?? "");
      playerMap.set(key, merged);
    }
  }

  const allPlayers = [...playerMap.values()];
  console.log(`\nTotal unique players across all files: ${allPlayers.length}`);

  const wb = new ExcelJS.Workbook();
  wb.creator = "JAL Football";
  wb.created = new Date();
  wb.modified = new Date();

  // Helper: build position sheet using actual CSV column names
  function makePositionSheet(
    sheetName: string,
    positions: string[],
    gradeCols: { header: string; key: string }[],
    statCols: { header: string; key: string; numFmt?: string }[]
  ) {
    const pos = new Set(positions.map((p) => p.toUpperCase()));
    const players = allPlayers
      .filter((r) => pos.has(String(r.position ?? "").toUpperCase()))
      .sort((a, b) => {
        const aG = gradeCols.reduce((best, c) => Math.max(best, (a[c.key] as number) ?? 0), 0);
        const bG = gradeCols.reduce((best, c) => Math.max(best, (b[c.key] as number) ?? 0), 0);
        return bG - aG;
      });

    const cols: ColDef[] = [
      { header: "Player", key: "player_name", width: 22 },
      { header: "Pos", key: "position", width: 6 },
      { header: "Team", key: "team_name", width: 16 },
      { header: "Games", key: "player_game_count", width: 7 },
      ...gradeCols.map((c) => ({ ...c, width: 11, isGrade: true })),
      ...statCols.map((c) => ({ ...c, width: 10 })),
    ];
    addSheet(wb, sheetName, cols, players);
    console.log(`  ✓ ${sheetName} (${players.length} players)`);
  }

  console.log("\nBuilding sheets...");

  // QB — passing_summary.csv columns confirmed
  makePositionSheet("QB", ["QB"], [
    { header: "Pass Grade", key: "grades_pass" },
    { header: "Offense", key: "grades_offense" },
  ], [
    { header: "Dropbacks", key: "dropbacks" },
    { header: "Att", key: "attempts" },
    { header: "Comp", key: "completions" },
    { header: "Comp%", key: "completion_percent", numFmt: "0.0" },
    { header: "Adj Comp%", key: "accuracy_percent", numFmt: "0.0" },
    { header: "Yds", key: "yards" },
    { header: "TDs", key: "touchdowns" },
    { header: "INTs", key: "interceptions" },
    { header: "BTT", key: "big_time_throws" },
    { header: "BTT%", key: "btt_rate", numFmt: "0.0" },
    { header: "TWP", key: "turnover_worthy_plays" },
    { header: "TWP%", key: "twp_rate", numFmt: "0.0" },
    { header: "YPA", key: "ypa", numFmt: "0.0" },
    { header: "ADOT", key: "avg_depth_of_target", numFmt: "0.0" },
    { header: "TTT", key: "avg_time_to_throw", numFmt: "0.00" },
    { header: "QB Rating", key: "qb_rating", numFmt: "0.0" },
    { header: "Sacks", key: "sacks" },
    { header: "Scrambles", key: "scrambles" },
    { header: "Drops", key: "drops" },
    { header: "Press Faced", key: "def_gen_pressures" },
    { header: "Pr→Sack%", key: "pressure_to_sack_rate", numFmt: "0.0" },
    { header: "Pass Snaps", key: "passing_snaps" },
  ]);

  // WR — receiving_summary.csv columns confirmed
  makePositionSheet("WR", ["WR"], [
    { header: "Offense", key: "grades_offense" },
    { header: "Route Grade", key: "grades_pass_route" },
    { header: "Hands/Drop", key: "grades_hands_drop" },
  ], [
    { header: "Pass Plays", key: "pass_plays" },
    { header: "Routes", key: "routes" },
    { header: "Route%", key: "route_rate", numFmt: "0.0" },
    { header: "Tgts", key: "targets" },
    { header: "Rec", key: "receptions" },
    { header: "Catch%", key: "caught_percent", numFmt: "0.0" },
    { header: "Yds", key: "yards" },
    { header: "TDs", key: "touchdowns" },
    { header: "1st Downs", key: "first_downs" },
    { header: "Drops", key: "drops" },
    { header: "Drop%", key: "drop_rate", numFmt: "0.0" },
    { header: "ADOT", key: "avg_depth_of_target", numFmt: "0.0" },
    { header: "YAC", key: "yards_after_catch" },
    { header: "YAC/Rec", key: "yards_after_catch_per_reception", numFmt: "0.0" },
    { header: "Y/RR", key: "yprr", numFmt: "0.00" },
    { header: "Tgt QBR", key: "targeted_qb_rating", numFmt: "0.0" },
    { header: "CTT", key: "contested_targets" },
    { header: "CTC", key: "contested_receptions" },
    { header: "CTC%", key: "contested_catch_rate", numFmt: "0.0" },
    { header: "MTF", key: "avoided_tackles" },
    { header: "Fumbles", key: "fumbles" },
    { header: "Slot Snaps", key: "slot_snaps" },
    { header: "Slot%", key: "slot_rate", numFmt: "0.0" },
    { header: "Wide Snaps", key: "wide_snaps" },
    { header: "Wide%", key: "wide_rate", numFmt: "0.0" },
    { header: "Longest", key: "longest" },
  ]);

  // TE — receiving_summary.csv columns confirmed
  makePositionSheet("TE", ["TE"], [
    { header: "Offense", key: "grades_offense" },
    { header: "Route Grade", key: "grades_pass_route" },
    { header: "Block Grade", key: "grades_pass_block" },
  ], [
    { header: "Pass Plays", key: "pass_plays" },
    { header: "Routes", key: "routes" },
    { header: "Route%", key: "route_rate", numFmt: "0.0" },
    { header: "Tgts", key: "targets" },
    { header: "Rec", key: "receptions" },
    { header: "Catch%", key: "caught_percent", numFmt: "0.0" },
    { header: "Yds", key: "yards" },
    { header: "TDs", key: "touchdowns" },
    { header: "Drops", key: "drops" },
    { header: "Drop%", key: "drop_rate", numFmt: "0.0" },
    { header: "ADOT", key: "avg_depth_of_target", numFmt: "0.0" },
    { header: "YAC/Rec", key: "yards_after_catch_per_reception", numFmt: "0.0" },
    { header: "Y/RR", key: "yprr", numFmt: "0.00" },
    { header: "CTT", key: "contested_targets" },
    { header: "CTC%", key: "contested_catch_rate", numFmt: "0.0" },
    { header: "MTF", key: "avoided_tackles" },
    { header: "Pass Blocks", key: "pass_blocks" },
    { header: "PB Rate", key: "pass_block_rate", numFmt: "0.0" },
    { header: "Inline Snaps", key: "inline_snaps" },
    { header: "Inline%", key: "inline_rate", numFmt: "0.0" },
    { header: "Slot Snaps", key: "slot_snaps" },
    { header: "Wide Snaps", key: "wide_snaps" },
    { header: "Longest", key: "longest" },
  ]);

  // RB — rushing_summary.csv columns confirmed
  makePositionSheet("RB", ["RB", "HB", "FB"], [
    { header: "Run Grade", key: "grades_run" },
    { header: "Offense", key: "grades_offense" },
    { header: "Pass Block", key: "grades_pass_block" },
    { header: "Recv Grade", key: "grades_pass_route" },
  ], [
    { header: "Run Plays", key: "run_plays" },
    { header: "Total Touches", key: "total_touches" },
    { header: "Carries", key: "attempts" },
    { header: "Yds", key: "yards" },
    { header: "TDs", key: "touchdowns" },
    { header: "1st Downs", key: "first_downs" },
    { header: "Yds/Car", key: "ypa", numFmt: "0.0" },
    { header: "YAC", key: "yards_after_contact" },
    { header: "YAC/Car", key: "yco_attempt", numFmt: "0.0" },
    { header: "Broken Tkls", key: "avoided_tackles" },
    { header: "Elusive Rtg", key: "elusive_rating", numFmt: "0.0" },
    { header: "Breakaway Yds", key: "breakaway_yards" },
    { header: "Breakaway%", key: "breakaway_percent", numFmt: "0.0" },
    { header: "Explosive", key: "explosive" },
    { header: "Fumbles", key: "fumbles" },
    { header: "Tgts", key: "targets" },
    { header: "Rec", key: "receptions" },
    { header: "Rec Yds", key: "rec_yards" },
    { header: "Y/RR", key: "yprr", numFmt: "0.00" },
  ]);

  // OL — offense_blocking.csv columns confirmed
  makePositionSheet("OL", ["T", "G", "C", "OT", "OG", "OL", "LT", "RT", "LG", "RG"], [
    { header: "Pass Block", key: "grades_pass_block" },
    { header: "Run Block", key: "grades_run_block" },
    { header: "Overall", key: "grades_offense" },
    { header: "Gap RB", key: "gap_grades_run_block" },
    { header: "Zone RB", key: "zone_grades_run_block" },
  ], [
    { header: "Snaps", key: "snap_counts_offense" },
    { header: "PB Snaps", key: "snap_counts_pass_block" },
    { header: "RB Snaps", key: "snap_counts_run_block" },
    { header: "Press Allow", key: "pressures_allowed" },
    { header: "Sacks Allow", key: "sacks_allowed", numFmt: "0.0" },
    { header: "Hits Allow", key: "hits_allowed" },
    { header: "Hurries Allow", key: "hurries_allowed" },
    { header: "PBE", key: "pbe", numFmt: "0.0" },
    { header: "PB%", key: "pass_block_percent", numFmt: "0.0" },
    { header: "RB%", key: "run_block_percent", numFmt: "0.0" },
    { header: "Penalties", key: "penalties" },
    { header: "LT Snaps", key: "snap_counts_lt" },
    { header: "LG Snaps", key: "snap_counts_lg" },
    { header: "C Snaps", key: "snap_counts_ce" },
    { header: "RG Snaps", key: "snap_counts_rg" },
    { header: "RT Snaps", key: "snap_counts_rt" },
  ]);

  // EDGE/DL — pass_rush_summary + pass_rush_productivity + run_defense_summary columns confirmed
  makePositionSheet("DL-EDGE", ["DE", "DT", "NT", "ED", "DL", "EDGE", "IDL"], [
    { header: "Pass Rush", key: "grades_pass_rush_defense" },
    { header: "Run Def", key: "grades_run_defense" },
    { header: "Defense", key: "grades_defense" },
    { header: "Tackle", key: "grades_tackle" },
  ], [
    { header: "Pass Play Snaps", key: "snap_counts_pass_play" },
    { header: "PR Snaps", key: "snap_counts_pass_rush" },
    { header: "Run Def Snaps", key: "snap_counts_run" },
    { header: "Pressures", key: "total_pressures" },
    { header: "Sacks", key: "sacks" },
    { header: "Hits", key: "hits" },
    { header: "Hurries", key: "hurries" },
    { header: "PRP", key: "prp", numFmt: "0.0" },
    { header: "PR Win%", key: "pass_rush_win_rate", numFmt: "0.0" },
    { header: "PR%", key: "pass_rush_percent", numFmt: "0.0" },
    { header: "Run Stops", key: "stops" },
    { header: "Tackles", key: "tackles" },
    { header: "Assists", key: "assists" },
    { header: "Missed Tkls", key: "missed_tackles" },
    { header: "Stop%", key: "stop_percent", numFmt: "0.0" },
    { header: "Forced Fmbl", key: "forced_fumbles" },
    { header: "LHS PR Snaps", key: "lhs_pass_rush_snaps" },
    { header: "LHS Pressures", key: "lhs_pressures" },
    { header: "RHS PR Snaps", key: "rhs_pass_rush_snaps" },
    { header: "RHS Pressures", key: "rhs_pressures" },
  ]);

  // LB — pass_rush_summary + run_defense_summary + defense_coverage_summary columns confirmed
  makePositionSheet("LB", ["LB", "ILB", "OLB", "MLB"], [
    { header: "Defense", key: "grades_defense" },
    { header: "Coverage", key: "grades_coverage_defense" },
    { header: "Run Def", key: "grades_run_defense" },
    { header: "Pass Rush", key: "grades_pass_rush_defense" },
    { header: "Tackle", key: "grades_tackle" },
  ], [
    { header: "Pass Play Snaps", key: "snap_counts_pass_play" },
    { header: "Cov Snaps", key: "snap_counts_coverage" },
    { header: "PR Snaps", key: "snap_counts_pass_rush" },
    { header: "Run Def Snaps", key: "snap_counts_run" },
    { header: "Tackles", key: "tackles" },
    { header: "Assists", key: "assists" },
    { header: "Stops", key: "stops" },
    { header: "Missed Tkls", key: "missed_tackles" },
    { header: "Stop%", key: "stop_percent", numFmt: "0.0" },
    { header: "Forced Fmbl", key: "forced_fumbles" },
    { header: "Tgts Allow", key: "targets" },
    { header: "Rec Allow", key: "receptions" },
    { header: "INTs", key: "interceptions" },
    { header: "Dropped INTs", key: "dropped_ints" },
    { header: "PBU", key: "pass_break_ups" },
    { header: "QBR Allow", key: "qb_rating_against", numFmt: "0.0" },
    { header: "Pressures", key: "total_pressures" },
    { header: "Sacks", key: "sacks" },
  ]);

  // CB — defense_coverage_summary columns confirmed
  makePositionSheet("CB", ["CB", "NCB"], [
    { header: "Coverage", key: "grades_coverage_defense" },
    { header: "Defense", key: "grades_defense" },
    { header: "Tackle", key: "grades_tackle" },
    { header: "Pass Rush", key: "grades_pass_rush_defense" },
    { header: "Run Def", key: "grades_run_defense" },
  ], [
    { header: "Cov Snaps", key: "snap_counts_coverage" },
    { header: "Pass Play Snaps", key: "snap_counts_pass_play" },
    { header: "Tgts Allow", key: "targets" },
    { header: "Rec Allow", key: "receptions" },
    { header: "Catch%", key: "catch_rate", numFmt: "0.0" },
    { header: "Yds Allow", key: "yards" },
    { header: "Yds/Rec", key: "yards_per_reception", numFmt: "0.0" },
    { header: "TDs Allow", key: "touchdowns" },
    { header: "INTs", key: "interceptions" },
    { header: "Dropped INTs", key: "dropped_ints" },
    { header: "PBU", key: "pass_break_ups" },
    { header: "Forced Inc", key: "forced_incompletes" },
    { header: "Forced Inc%", key: "forced_incompletion_rate", numFmt: "0.0" },
    { header: "QBR Allow", key: "qb_rating_against", numFmt: "0.0" },
    { header: "Cov%", key: "coverage_percent", numFmt: "0.0" },
    { header: "Yds/CovSnap", key: "yards_per_coverage_snap", numFmt: "0.00" },
    { header: "YAC Allow", key: "yards_after_catch" },
    { header: "Tackles", key: "tackles" },
    { header: "Assists", key: "assists" },
    { header: "Stops", key: "stops" },
    { header: "Missed Tkls", key: "missed_tackles" },
    { header: "Longest", key: "longest" },
  ]);

  // S — defense_coverage_summary columns confirmed
  makePositionSheet("S", ["S", "SS", "FS", "SAF", "DB"], [
    { header: "Coverage", key: "grades_coverage_defense" },
    { header: "Run Def", key: "grades_run_defense" },
    { header: "Defense", key: "grades_defense" },
    { header: "Tackle", key: "grades_tackle" },
    { header: "Pass Rush", key: "grades_pass_rush_defense" },
  ], [
    { header: "Cov Snaps", key: "snap_counts_coverage" },
    { header: "Pass Play Snaps", key: "snap_counts_pass_play" },
    { header: "Tgts Allow", key: "targets" },
    { header: "Rec Allow", key: "receptions" },
    { header: "Catch%", key: "catch_rate", numFmt: "0.0" },
    { header: "Yds Allow", key: "yards" },
    { header: "Yds/Rec", key: "yards_per_reception", numFmt: "0.0" },
    { header: "TDs Allow", key: "touchdowns" },
    { header: "INTs", key: "interceptions" },
    { header: "Dropped INTs", key: "dropped_ints" },
    { header: "PBU", key: "pass_break_ups" },
    { header: "Forced Inc", key: "forced_incompletes" },
    { header: "Forced Inc%", key: "forced_incompletion_rate", numFmt: "0.0" },
    { header: "QBR Allow", key: "qb_rating_against", numFmt: "0.0" },
    { header: "Yds/CovSnap", key: "yards_per_coverage_snap", numFmt: "0.00" },
    { header: "YAC Allow", key: "yards_after_catch" },
    { header: "Tackles", key: "tackles" },
    { header: "Assists", key: "assists" },
    { header: "Stops", key: "stops" },
    { header: "Missed Tkls", key: "missed_tackles" },
    { header: "Forced Fmbl", key: "forced_fumbles" },
    { header: "Longest", key: "longest" },
  ]);

  await wb.xlsx.writeFile(outputPath);
  console.log(`\nSpreadsheet saved: ${outputPath}`);
  console.log("\nGrade color key:");
  console.log("  Gold   = 90–100 (Elite)");
  console.log("  Blue   = 80–89  (Great)");
  console.log("  Green  = 70–79  (Good)");
  console.log("  Yellow = 60–69  (Average)");
  console.log("  Red    = 0–59   (Below average)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
