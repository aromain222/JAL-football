/**
 * PFF Workbook Importer
 *
 * Imports a structured .xlsx workbook (one sheet per position group) into
 * player_pff_grades and creates missing players so workbook-only rows appear
 * in player search.
 *
 * Usage:
 *   npm run pff:workbook -- --workbook ./data/pff/2026-04-10/pff-workbook.xlsx --season 2025
 */

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
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

function getArg(flag: string): string | null {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 ? (process.argv[idx + 1] ?? null) : null;
}

const workbookArg = getArg("--workbook");
if (!workbookArg) {
  console.error('Usage: npm run pff:workbook -- --workbook "/path/to/pff.xlsx" [--season 2025] [--transfer-year 2026]');
  process.exit(1);
}

const seasonArg = getArg("--season");
const transferYearArg = getArg("--transfer-year");
const DRY_RUN = process.argv.includes("--dry-run");
const season = seasonArg ? Number(seasonArg) : Number(process.env.PFF_SEASON ?? new Date().getFullYear());
const transferYear = transferYearArg ? Number(transferYearArg) : new Date().getFullYear();
const workbookPath = path.resolve(workbookArg);

if (!Number.isFinite(season) || !Number.isFinite(transferYear)) {
  console.error("Season and transfer year must be numeric.");
  process.exit(1);
}

type PositionGroup = "QB" | "RB" | "WR" | "TE" | "OL" | "EDGE" | "DL" | "LB" | "CB" | "S" | "ST";

const POSITION_MAP: Record<string, PositionGroup> = {
  QB: "QB",
  HB: "RB",
  RB: "RB",
  FB: "RB",
  WR: "WR",
  SE: "WR",
  FL: "WR",
  TE: "TE",
  OL: "OL",
  OT: "OL",
  OG: "OL",
  C: "OL",
  LT: "OL",
  RT: "OL",
  LG: "OL",
  RG: "OL",
  T: "OL",
  G: "OL",
  EDGE: "EDGE",
  DE: "EDGE",
  DT: "DL",
  DL: "DL",
  NT: "DL",
  NG: "DL",
  LB: "LB",
  ILB: "LB",
  OLB: "LB",
  MLB: "LB",
  CB: "CB",
  NCB: "CB",
  DB: "CB",
  S: "S",
  FS: "S",
  SS: "S",
  K: "ST",
  P: "ST",
  LS: "ST",
};

type WorkbookSheet =
  | "QB"
  | "WR"
  | "TE"
  | "RB"
  | "OL"
  | "DL-EDGE"
  | "LB"
  | "CB"
  | "S";

type WorkbookValue = string | number | boolean | null;
type WorkbookRow = Record<string, WorkbookValue>;

type ParsedWorkbookPlayer = {
  syntheticPffId: number;
  playerName: string;
  position: string;
  teamName: string | null;
  classYear: string | null;
  eligibilityRemaining: number | null;
  stars: number | null;
  hometown: string | null;
  row: WorkbookRow;
  sheet: WorkbookSheet;
};

type PlayerLookupRow = Pick<
  Database["public"]["Tables"]["players"]["Row"],
  "id" | "first_name" | "last_name" | "position" | "current_school" | "previous_school"
>;

function normalizeName(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeSchool(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/^the/, "")
    .trim();
}

function splitName(fullName: string): { first_name: string; last_name: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return { first_name: parts[0] ?? "", last_name: "" };
  return {
    first_name: parts[0],
    last_name: parts.slice(1).join(" "),
  };
}

function mapPosition(value: string | null | undefined): PositionGroup | null {
  if (!value) return null;
  return POSITION_MAP[value.toUpperCase().trim()] ?? null;
}

function coerceNumber(value: WorkbookValue): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value ? 1 : 0;
  const cleaned = value.toString().trim().replace(/,/g, "").replace(/%$/, "");
  if (!cleaned || cleaned === "—" || cleaned === "-") return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function coerceInteger(value: WorkbookValue): number | null {
  const num = coerceNumber(value);
  return num == null ? null : Math.round(num);
}

function coerceText(value: WorkbookValue): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text || text === "—" || text === "-") return null;
  return text;
}

function stableSyntheticPffId(playerName: string, position: string, teamName: string | null, importSeason: number): number {
  const seed = `${normalizeName(playerName)}|${position.toUpperCase()}|${normalizeSchool(teamName)}|${importSeason}`;
  const hex = createHash("sha256").update(seed).digest("hex").slice(0, 8);
  const asInt = parseInt(hex, 16) % 2_000_000_000;
  return -1 * (asInt + 1);
}

function sumMatching(row: WorkbookRow, predicate: (header: string) => boolean): number | null {
  let total = 0;
  let found = false;
  for (const [header, value] of Object.entries(row)) {
    if (!predicate(header)) continue;
    const numeric = coerceNumber(value);
    if (numeric == null) continue;
    total += numeric;
    found = true;
  }
  return found ? Math.round(total) : null;
}

function setIfPresent(target: Record<string, unknown>, key: string, value: WorkbookValue, integer = false) {
  const parsed = integer ? coerceInteger(value) : coerceNumber(value);
  if (parsed != null) target[key] = parsed;
}

function buildPffRecord(entry: ParsedWorkbookPlayer): Record<string, unknown> {
  const row = entry.row;
  const record: Record<string, unknown> = {
    pff_player_id: entry.syntheticPffId,
    player_name: entry.playerName,
    team_name: entry.teamName,
    position: entry.position,
    season,
    grades_overall: coerceNumber(row["Overall"]),
  };

  const offense = coerceNumber(row["Offense"]);
  const defense = coerceNumber(row["Defense"]);

  if (offense != null) record.grades_offense = offense;
  if (defense != null) record.grades_defense = defense;

  record.snaps_backfield = sumMatching(row, (header) => header.startsWith("Backfield —"));
  record.snaps_slot = sumMatching(row, (header) => header.startsWith("Slot —"));
  record.snaps_wide_left = sumMatching(row, (header) => header === "Wide — LWR");
  record.snaps_wide_right = sumMatching(row, (header) => header === "Wide — RWR");
  record.snaps_inline_te = sumMatching(row, (header) => header.startsWith("Inline —"));
  record.snaps_at_left_tackle = coerceInteger(row["OLine — LT"]);
  record.snaps_at_left_guard = coerceInteger(row["OLine — LG"]);
  record.snaps_at_center = coerceInteger(row["OLine — C"]);
  record.snaps_at_right_guard = coerceInteger(row["OLine — RG"]);
  record.snaps_at_right_tackle = coerceInteger(row["OLine — RT"]);
  record.snaps_at_left_end = sumMatching(row, (header) => ["DLine — LE", "DLine — LEO", "DLine — LOLB"].includes(header));
  record.snaps_at_right_end = sumMatching(row, (header) => ["DLine — RE", "DLine — REO", "DLine — ROLB"].includes(header));
  record.snaps_interior_dl = sumMatching(row, (header) =>
    ["DLine — DLT", "DLine — DRT", "DLine — NT", "DLine — NLT", "DLine — NRT"].includes(header)
  );
  record.snaps_in_box_lb = sumMatching(row, (header) => header.startsWith("Box —"));
  record.snaps_off_ball_lb = coerceInteger(row["Cov Snaps"]);
  record.snaps_free_safety = sumMatching(row, (header) => header.startsWith("Free Safety —"));
  record.snaps_strong_safety = sumMatching(row, (header) => ["Box — SS", "Box — SSL", "Box — SSR"].includes(header));
  record.snaps_slot_cb = sumMatching(row, (header) => header.startsWith("Slot Corner —"));
  record.snaps_outside_cb = sumMatching(row, (header) => ["Wide Corner — LCB", "Wide Corner — RCB"].includes(header));
  record.snaps_in_box_db = sumMatching(row, (header) => header.startsWith("Box —"));
  record.snaps_deep_safety = sumMatching(row, (header) => header.startsWith("Free Safety —"));

  switch (entry.sheet) {
    case "QB":
      setIfPresent(record, "grades_pass", row["Pass Grade"]);
      setIfPresent(record, "stats_completions", row["Comp"], true);
      setIfPresent(record, "stats_attempts", row["Att"], true);
      setIfPresent(record, "stats_passing_yards", row["Yds"], true);
      setIfPresent(record, "stats_passing_tds", row["TDs"], true);
      setIfPresent(record, "stats_interceptions", row["INTs"], true);
      setIfPresent(record, "stats_big_time_throws", row["BTT"], true);
      setIfPresent(record, "stats_turnover_worthy_plays", row["TWP"], true);
      setIfPresent(record, "stats_adjusted_completion_pct", row["Adj Comp%"]);
      setIfPresent(record, "stats_pressure_to_sack", row["Pr→Sack%"]);
      setIfPresent(record, "stats_time_to_throw", row["TTT"]);
      setIfPresent(record, "stats_yards_per_attempt", row["YPA"]);
      setIfPresent(record, "snaps_offense", row["Pass Snaps"], true);
      break;

    case "WR":
      setIfPresent(record, "grades_pass_route", row["Route Grade"]);
      setIfPresent(record, "grades_hands_drop", row["Hands/Drop"]);
      setIfPresent(record, "stats_targets", row["Tgts"], true);
      setIfPresent(record, "stats_receptions", row["Rec"], true);
      setIfPresent(record, "stats_catch_rate", row["Catch%"]);
      setIfPresent(record, "stats_receiving_yards", row["Yds"], true);
      setIfPresent(record, "stats_receiving_tds", row["TDs"], true);
      setIfPresent(record, "stats_first_downs_receiving", row["1st Downs"], true);
      setIfPresent(record, "stats_drops", row["Drops"], true);
      setIfPresent(record, "stats_adot", row["ADOT"]);
      setIfPresent(record, "stats_yac", row["YAC"]);
      setIfPresent(record, "stats_yac_per_reception", row["YAC/Rec"]);
      setIfPresent(record, "stats_yards_per_route_run", row["Y/RR"]);
      setIfPresent(record, "stats_contested_catches", row["CTC"], true);
      setIfPresent(record, "stats_contested_catch_rate", row["CTC%"]);
      setIfPresent(record, "stats_route_participation_pct", row["Route%"]);
      setIfPresent(record, "snaps_offense", row["Pass Plays"], true);
      break;

    case "TE":
      setIfPresent(record, "grades_pass_route", row["Route Grade"]);
      setIfPresent(record, "grades_run_block", row["Block Grade"]);
      setIfPresent(record, "stats_targets", row["Tgts"], true);
      setIfPresent(record, "stats_receptions", row["Rec"], true);
      setIfPresent(record, "stats_catch_rate", row["Catch%"]);
      setIfPresent(record, "stats_receiving_yards", row["Yds"], true);
      setIfPresent(record, "stats_receiving_tds", row["TDs"], true);
      setIfPresent(record, "stats_drops", row["Drops"], true);
      setIfPresent(record, "stats_adot", row["ADOT"]);
      setIfPresent(record, "stats_yac_per_reception", row["YAC/Rec"]);
      setIfPresent(record, "stats_yards_per_route_run", row["Y/RR"]);
      setIfPresent(record, "stats_contested_catch_rate", row["CTC%"]);
      setIfPresent(record, "stats_pass_block_snaps", row["Pass Blocks"], true);
      setIfPresent(record, "snaps_offense", row["Pass Plays"], true);
      break;

    case "RB":
      setIfPresent(record, "grades_run_rb", row["Run Grade"]);
      setIfPresent(record, "grades_pass_block_rb", row["Pass Block"]);
      setIfPresent(record, "grades_pass_route", row["Recv Grade"]);
      setIfPresent(record, "stats_carries", row["Carries"], true);
      setIfPresent(record, "stats_rushing_yards", row["Yds"], true);
      setIfPresent(record, "stats_rushing_tds", row["TDs"], true);
      setIfPresent(record, "stats_first_downs_rushing", row["1st Downs"], true);
      setIfPresent(record, "stats_yards_after_contact", row["YAC"]);
      setIfPresent(record, "stats_yards_after_contact_per_carry", row["YAC/Car"]);
      setIfPresent(record, "stats_broken_tackles", row["Broken Tkls"], true);
      setIfPresent(record, "stats_elusive_rating", row["Elusive Rtg"]);
      setIfPresent(record, "stats_fumbles", row["Fumbles"], true);
      setIfPresent(record, "stats_targets", row["Tgts"], true);
      setIfPresent(record, "stats_receptions", row["Rec"], true);
      setIfPresent(record, "stats_receiving_yards", row["Rec Yds"], true);
      setIfPresent(record, "stats_yards_per_route_run", row["Y/RR"]);
      setIfPresent(record, "snaps_offense", row["Run Plays"], true);
      break;

    case "OL":
      setIfPresent(record, "grades_pass_block", row["Pass Block"]);
      setIfPresent(record, "grades_run_block", row["Run Block"]);
      setIfPresent(record, "stats_pass_block_snaps", row["PB Snaps"], true);
      setIfPresent(record, "stats_run_block_snaps", row["RB Snaps"], true);
      setIfPresent(record, "stats_pressures_allowed", row["Press Allow"], true);
      setIfPresent(record, "stats_sacks_allowed", row["Sacks Allow"]);
      setIfPresent(record, "stats_hits_allowed", row["Hits Allow"], true);
      setIfPresent(record, "stats_hurries_allowed", row["Hurries Allow"], true);
      setIfPresent(record, "stats_penalties", row["Penalties"], true);
      setIfPresent(record, "snaps_offense", row["Snaps"], true);
      break;

    case "DL-EDGE":
      setIfPresent(record, "grades_pass_rush", row["Pass Rush"]);
      setIfPresent(record, "grades_run_defense_dl", row["Run Def"]);
      setIfPresent(record, "grades_tackle", row["Tackle"]);
      setIfPresent(record, "stats_pass_rush_snaps", row["PR Snaps"], true);
      setIfPresent(record, "stats_pressures", row["Pressures"], true);
      setIfPresent(record, "stats_sacks", row["Sacks"]);
      setIfPresent(record, "stats_hits", row["Hits"], true);
      setIfPresent(record, "stats_hurries", row["Hurries"], true);
      setIfPresent(record, "stats_run_stops", row["Run Stops"], true);
      setIfPresent(record, "stats_tackles", row["Tackles"], true);
      setIfPresent(record, "stats_assists", row["Assists"], true);
      setIfPresent(record, "stats_missed_tackles", row["Missed Tkls"], true);
      setIfPresent(record, "stats_run_stop_pct", row["Stop%"]);
      setIfPresent(record, "stats_forced_fumbles", row["Forced Fmbl"], true);
      setIfPresent(record, "snaps_defense", row["Pass Play Snaps"], true);
      break;

    case "LB":
      setIfPresent(record, "grades_coverage_lb", row["Coverage"]);
      setIfPresent(record, "grades_run_defense_lb", row["Run Def"]);
      setIfPresent(record, "grades_pass_rush_lb", row["Pass Rush"]);
      setIfPresent(record, "grades_tackle", row["Tackle"]);
      setIfPresent(record, "stats_pff_coverage_snaps", row["Cov Snaps"], true);
      setIfPresent(record, "stats_pass_rush_snaps", row["PR Snaps"], true);
      setIfPresent(record, "stats_tackles", row["Tackles"], true);
      setIfPresent(record, "stats_assists", row["Assists"], true);
      setIfPresent(record, "stats_stops_lb", row["Stops"], true);
      setIfPresent(record, "stats_missed_tackles", row["Missed Tkls"], true);
      setIfPresent(record, "stats_forced_fumbles", row["Forced Fmbl"], true);
      setIfPresent(record, "stats_targets_allowed", row["Tgts Allow"], true);
      setIfPresent(record, "stats_receptions_allowed", row["Rec Allow"], true);
      setIfPresent(record, "stats_interceptions_def", row["INTs"], true);
      setIfPresent(record, "stats_pass_breakups", row["PBU"], true);
      setIfPresent(record, "stats_passer_rating_allowed", row["QBR Allow"]);
      setIfPresent(record, "stats_pressures", row["Pressures"], true);
      setIfPresent(record, "stats_sacks", row["Sacks"]);
      setIfPresent(record, "snaps_defense", row["Pass Play Snaps"], true);
      break;

    case "CB":
      setIfPresent(record, "grades_coverage_db", row["Coverage"]);
      setIfPresent(record, "grades_tackle_db", row["Tackle"]);
      setIfPresent(record, "stats_pff_coverage_snaps", row["Cov Snaps"], true);
      setIfPresent(record, "stats_targets_allowed", row["Tgts Allow"], true);
      setIfPresent(record, "stats_receptions_allowed", row["Rec Allow"], true);
      setIfPresent(record, "stats_yards_allowed", row["Yds Allow"], true);
      setIfPresent(record, "stats_tds_allowed", row["TDs Allow"], true);
      setIfPresent(record, "stats_interceptions_def", row["INTs"], true);
      setIfPresent(record, "stats_pass_breakups", row["PBU"], true);
      setIfPresent(record, "stats_passer_rating_allowed", row["QBR Allow"]);
      setIfPresent(record, "stats_yards_per_coverage_snap", row["Yds/CovSnap"]);
      setIfPresent(record, "stats_tackles", row["Tackles"], true);
      setIfPresent(record, "stats_assists", row["Assists"], true);
      setIfPresent(record, "stats_missed_tackles", row["Missed Tkls"], true);
      setIfPresent(record, "snaps_defense", row["Pass Play Snaps"], true);
      break;

    case "S":
      setIfPresent(record, "grades_coverage_db", row["Coverage"]);
      setIfPresent(record, "grades_run_defense_lb", row["Run Def"]);
      setIfPresent(record, "grades_tackle_db", row["Tackle"]);
      setIfPresent(record, "stats_pff_coverage_snaps", row["Cov Snaps"], true);
      setIfPresent(record, "stats_targets_allowed", row["Tgts Allow"], true);
      setIfPresent(record, "stats_receptions_allowed", row["Rec Allow"], true);
      setIfPresent(record, "stats_yards_allowed", row["Yds Allow"], true);
      setIfPresent(record, "stats_tds_allowed", row["TDs Allow"], true);
      setIfPresent(record, "stats_interceptions_def", row["INTs"], true);
      setIfPresent(record, "stats_pass_breakups", row["PBU"], true);
      setIfPresent(record, "stats_passer_rating_allowed", row["QBR Allow"]);
      setIfPresent(record, "stats_yards_per_coverage_snap", row["Yds/CovSnap"]);
      setIfPresent(record, "stats_tackles", row["Tackles"], true);
      setIfPresent(record, "stats_assists", row["Assists"], true);
      setIfPresent(record, "stats_stops_lb", row["Stops"], true);
      setIfPresent(record, "stats_missed_tackles", row["Missed Tkls"], true);
      setIfPresent(record, "stats_forced_fumbles", row["Forced Fmbl"], true);
      setIfPresent(record, "snaps_defense", row["Pass Play Snaps"], true);
      break;
  }

  return Object.fromEntries(
    Object.entries(record).filter(([key, value]) => {
      if (key === "grades_overall") return value !== undefined;
      return value !== null && value !== undefined && value !== "";
    })
  );
}

async function readWorkbook(): Promise<ParsedWorkbookPlayer[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(workbookPath);

  const parsed: ParsedWorkbookPlayer[] = [];

  for (const worksheet of workbook.worksheets) {
    const sheetName = worksheet.name as WorkbookSheet;
    if (!["QB", "WR", "TE", "RB", "OL", "DL-EDGE", "LB", "CB", "S"].includes(sheetName)) continue;

    const headerRow = worksheet.getRow(1);
    const headerValues = Array.isArray(headerRow.values) ? headerRow.values.slice(1) : [];
    const headers = headerValues.map((value: ExcelJS.CellValue) =>
      typeof value === "string" ? value.trim() : String(value ?? "").trim()
    );

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const values = Array.isArray(row.values) ? row.values.slice(1) : [];
      const record: WorkbookRow = {};
      headers.forEach((header: string, index: number) => {
        record[header] = (values[index] as WorkbookValue) ?? null;
      });

      const playerName = coerceText(record["Player"]);
      const position = coerceText(record["Pos"]);
      if (!playerName || !position) return;

      parsed.push({
        syntheticPffId: stableSyntheticPffId(playerName, position, coerceText(record["Team"]), season),
        playerName,
        position,
        teamName: coerceText(record["Team"]),
        classYear: coerceText(record["Class"]),
        eligibilityRemaining: coerceInteger(record["Elig"]),
        stars: coerceInteger(record["Stars"]),
        hometown: coerceText(record["Hometown"]),
        row: record,
        sheet: sheetName,
      });
    });
  }

  return parsed;
}

function chooseExistingPlayer(entry: ParsedWorkbookPlayer, candidates: PlayerLookupRow[]): PlayerLookupRow | null {
  if (!candidates.length) return null;
  const position = mapPosition(entry.position);
  const team = normalizeSchool(entry.teamName);

  const byPosition = position ? candidates.filter((candidate) => candidate.position === position) : candidates;
  const preferredPool = byPosition.length ? byPosition : candidates;

  if (team) {
    const byTeam = preferredPool.filter((candidate) => {
      const current = normalizeSchool(candidate.current_school);
      const previous = normalizeSchool(candidate.previous_school);
      return team === current || team === previous;
    });
    if (byTeam.length === 1) return byTeam[0];
    if (byTeam.length > 1) return byTeam[0];
  }

  if (preferredPool.length === 1) return preferredPool[0];
  return null;
}

async function main() {
  console.log(`\nReading workbook: ${workbookPath}`);
  console.log(`Season: ${season}`);
  console.log(`Transfer year for new players: ${transferYear}\n`);

  const workbookRows = await readWorkbook();
  if (!workbookRows.length) {
    console.error("No workbook rows found.");
    process.exit(1);
  }

  console.log(`Parsed ${workbookRows.length} workbook player rows.`);

  const { data: playersRaw, error: playersError } = await supabase
    .from("players" as never)
    .select("id, first_name, last_name, position, current_school, previous_school");

  if (playersError || !playersRaw) {
    console.error("Failed to fetch players:", playersError?.message ?? "unknown error");
    process.exit(1);
  }

  const players = playersRaw as PlayerLookupRow[];
  const byNormalizedName = new Map<string, PlayerLookupRow[]>();
  for (const player of players) {
    const fullName = normalizeName(`${player.first_name} ${player.last_name}`);
    const list = byNormalizedName.get(fullName) ?? [];
    list.push(player);
    byNormalizedName.set(fullName, list);
  }

  const pffRows: Record<string, unknown>[] = [];
  const inserts: Database["public"]["Tables"]["players"]["Insert"][] = [];
  let matchedExisting = 0;

  for (const entry of workbookRows) {
    const normalized = normalizeName(entry.playerName);
    const candidates = byNormalizedName.get(normalized) ?? [];
    const match = chooseExistingPlayer(entry, candidates);
    if (match) matchedExisting++;

    const pffRecord = buildPffRecord(entry);
    if (match) {
      pffRecord.player_id = match.id;
    } else {
      const position = mapPosition(entry.position);
      const { first_name, last_name } = splitName(entry.playerName);

      if (position && first_name && last_name) {
        const id = randomUUID();
        byNormalizedName.set(normalized, [
          ...(byNormalizedName.get(normalized) ?? []),
          {
            id,
            first_name,
            last_name,
            position,
            current_school: "Transfer Portal",
            previous_school: entry.teamName,
          },
        ]);
        inserts.push({
          id,
          first_name,
          last_name,
          position,
          transfer_year: transferYear,
          current_school: "Transfer Portal",
          conference: null,
          previous_school: entry.teamName,
          hometown: entry.hometown,
          state: null,
          class_year: entry.classYear ?? "Unknown",
          eligibility_remaining: entry.eligibilityRemaining ?? 1,
          stars: entry.stars,
          academic_status: null,
          status: "Portal",
          film_url: null,
          photo_url: null,
          x_handle: null,
          x_user_id: null,
          contact_window: null,
          notes: "Imported from PFF workbook.",
          sportradar_id: null,
        });
        pffRecord.player_id = id;
      }
    }

    pffRows.push(pffRecord);
  }

  const uniquePlayerInserts = Array.from(
    new Map(inserts.map((insert) => [`${normalizeName(`${insert.first_name} ${insert.last_name}`)}|${insert.position}`, insert])).values()
  );

  console.log(`Matched ${matchedExisting} workbook rows to existing players.`);
  console.log(`Creating ${uniquePlayerInserts.length} new players from workbook-only rows.`);

  if (DRY_RUN) {
    console.log("Dry run enabled. No database writes performed.");
    return;
  }

  if (uniquePlayerInserts.length) {
    const { error: insertError } = await supabase
      .from("players" as never)
      .upsert(uniquePlayerInserts as never, { onConflict: "id" });

    if (insertError) {
      console.error("Failed to insert workbook players:", insertError.message);
      process.exit(1);
    }
  }

  const chunkSize = 200;
  for (let i = 0; i < pffRows.length; i += chunkSize) {
    const chunk = pffRows.slice(i, i + chunkSize);
    const { error } = await supabase
      .from("player_pff_grades" as never)
      .upsert(chunk as never, { onConflict: "pff_player_id,season" });

    if (error) {
      console.error(`Failed to upsert workbook PFF rows ${i + 1}-${i + chunk.length}:`, error.message);
      process.exit(1);
    }

    console.log(`Upserted ${Math.min(i + chunk.length, pffRows.length)}/${pffRows.length} PFF rows`);
  }

  console.log("\nWorkbook import complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
