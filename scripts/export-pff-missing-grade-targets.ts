import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import fs from "node:fs";
import path from "node:path";
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

const dateStamp = new Date().toISOString().slice(0, 10);

function getArg(flag: string): string | null {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 ? (process.argv[idx + 1] ?? null) : null;
}

const seasonArg = getArg("--season");
const season = seasonArg ? Number(seasonArg) : Number(process.env.PFF_SEASON ?? 2025);
const outDir = path.resolve(getArg("--out") ?? path.join("data", "pff", "grade-enrichment", dateStamp));

type PffRow = Database["public"]["Tables"]["player_pff_grades"]["Row"];

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

function hasPrimaryGrade(row: PffRow): boolean {
  const keys = POSITION_PRIMARY_GRADE_KEYS[row.position ?? ""] ?? ["grades_overall"];
  return keys.some((key) => row[key] != null);
}

function currentPrimaryLabel(row: PffRow): string | null {
  const keys = POSITION_PRIMARY_GRADE_KEYS[row.position ?? ""] ?? ["grades_overall"];
  const labelMap: Partial<Record<keyof PffRow, string>> = {
    grades_overall: "Overall",
    grades_pass: "Passing",
    grades_offense: "Offense",
    grades_run_rb: "Run",
    grades_pass_route: "Route",
    grades_run_block: "Run Block",
    grades_pass_block: "Pass Block",
    grades_pass_rush: "Pass Rush",
    grades_run_defense_dl: "Run Defense",
    grades_run_defense_lb: "Run Defense",
    grades_coverage_lb: "Coverage",
    grades_coverage_db: "Coverage",
    grades_tackle: "Tackle",
    grades_tackle_db: "Tackle",
    grades_defense: "Defense",
  };

  for (const key of keys) {
    const value = row[key];
    if (typeof value === "number") return `${labelMap[key] ?? key} ${value.toFixed(1)}`;
  }

  return null;
}

function csvEscape(value: unknown): string {
  const text = value == null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });

  const { data, error } = await supabase
    .from("player_pff_grades")
    .select("*")
    .eq("season", season)
    .order("position")
    .order("player_name");

  if (error || !data) {
    console.error("Failed to fetch player_pff_grades:", error?.message ?? "unknown error");
    process.exit(1);
  }

  const targets = (data as PffRow[]).filter((row) => !hasPrimaryGrade(row));

  const summary = targets.reduce<Record<string, number>>((acc, row) => {
    acc[row.position ?? "UNK"] = (acc[row.position ?? "UNK"] ?? 0) + 1;
    return acc;
  }, {});

  const jsonPath = path.join(outDir, "missing-grade-targets.json");
  const csvPath = path.join(outDir, "missing-grade-targets.csv");
  const xlsxPath = path.join(outDir, "missing-grade-targets.xlsx");

  fs.writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        season,
        generated_at: new Date().toISOString(),
        total_targets: targets.length,
        by_position: summary,
        targets,
      },
      null,
      2
    )
  );

  const csvHeaders = [
    "id",
    "player_id",
    "pff_player_id",
    "player_name",
    "team_name",
    "position",
    "season",
    "current_primary_grade",
  ];
  const csvLines = [
    csvHeaders.join(","),
    ...targets.map((row) =>
      [
        row.id,
        row.player_id,
        row.pff_player_id,
        row.player_name,
        row.team_name,
        row.position,
        row.season,
        currentPrimaryLabel(row),
      ]
        .map(csvEscape)
        .join(",")
    ),
  ];
  fs.writeFileSync(csvPath, `${csvLines.join("\n")}\n`);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Missing Grades");
  sheet.columns = [
    { header: "Player", key: "player_name", width: 28 },
    { header: "Team", key: "team_name", width: 18 },
    { header: "Pos", key: "position", width: 8 },
    { header: "Season", key: "season", width: 8 },
    { header: "Player Row ID", key: "id", width: 38 },
    { header: "Linked Player ID", key: "player_id", width: 38 },
    { header: "PFF ID", key: "pff_player_id", width: 14 },
    { header: "Current Primary Grade", key: "current_primary_grade", width: 22 },
  ];
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: sheet.columns.length },
  };
  sheet.getRow(1).font = { bold: true };

  for (const row of targets) {
    sheet.addRow({
      player_name: row.player_name,
      team_name: row.team_name,
      position: row.position,
      season: row.season,
      id: row.id,
      player_id: row.player_id,
      pff_player_id: row.pff_player_id,
      current_primary_grade: currentPrimaryLabel(row) ?? "",
    });
  }

  const summarySheet = workbook.addWorksheet("Summary");
  summarySheet.columns = [
    { header: "Position", key: "position", width: 12 },
    { header: "Missing Primary Grade", key: "count", width: 20 },
  ];
  summarySheet.getRow(1).font = { bold: true };
  Object.entries(summary)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([position, count]) => summarySheet.addRow({ position, count }));

  await workbook.xlsx.writeFile(xlsxPath);

  console.log(`Exported ${targets.length} missing-grade targets for season ${season}`);
  console.log(`JSON: ${jsonPath}`);
  console.log(`CSV:  ${csvPath}`);
  console.log(`XLSX: ${xlsxPath}`);
  console.log(`By position: ${JSON.stringify(summary)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
