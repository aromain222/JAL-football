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
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\nFetching PFF grades for season ${SEASON} from Supabase...`);

  const { data, error } = await supabase
    .from("player_pff_grades" as never)
    .select("*")
    .eq("season" as never, SEASON as never);

  if (error) {
    console.error("Failed to fetch player_pff_grades:", error.message);
    process.exit(1);
  }

  if (!data || (data as unknown[]).length === 0) {
    console.error(`No PFF grades found for season ${SEASON}. Run npm run pff:import first.`);
    process.exit(1);
  }

  const rows = data as PffRow[];
  console.log(`  Found ${rows.length} player records\n`);

  const wb = new ExcelJS.Workbook();
  wb.creator = "JAL Football";
  wb.created = new Date();
  wb.modified = new Date();
  wb.properties.date1904 = false;

  console.log("Building sheets...");
  makeAllPlayersSheet(wb, rows);
  console.log("  ✓ All Players");
  makeQbSheet(wb, rows);
  console.log("  ✓ QB");
  makeWrTeSheet(wb, rows);
  console.log("  ✓ WR-TE");
  makeRbSheet(wb, rows);
  console.log("  ✓ RB");
  makeOlSheet(wb, rows);
  console.log("  ✓ OL");
  makeDlSheet(wb, rows);
  console.log("  ✓ DL-Edge");
  makeLbSheet(wb, rows);
  console.log("  ✓ LB");
  makeDbSheet(wb, rows);
  console.log("  ✓ DB-Safety");

  await wb.xlsx.writeFile(outputPath);
  console.log(`\nSpreadsheet saved: ${outputPath}`);
  console.log(`\nGrade color key:`);
  console.log("  Gold  = 90–100 (Elite)");
  console.log("  Blue  = 80–89  (Great)");
  console.log("  Green = 70–79  (Good)");
  console.log("  Yellow= 60–69  (Average)");
  console.log("  Red   = 0–59   (Below average)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
