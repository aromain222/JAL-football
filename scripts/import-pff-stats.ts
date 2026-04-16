/**
 * PFF Stats Importer
 *
 * Reads all PFF CSV exports from a directory, auto-detects each file type,
 * merges all data by pff_player_id, matches to our Supabase players table by
 * name + team, then upserts into player_pff_grades.
 *
 * Usage:
 *   npm run pff:import
 *   npm run pff:import -- --dir "./data/pff/2025-01-15"
 *   npm run pff:import -- --season 2024 --dir "./data/pff/2025-01-15"
 */

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import fs from "node:fs";
import path from "node:path";
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

const dirArg = getArg("--dir");
const seasonArg = getArg("--season");
const defaultSeason = Number(process.env.PFF_SEASON ?? new Date().getFullYear());
const SEASON = seasonArg ? Number(seasonArg) : defaultSeason;

// Default to the most recent data/pff subdirectory
function findLatestPffDir(): string {
  const base = path.resolve("data", "pff");
  if (!fs.existsSync(base)) {
    console.error(`No data/pff directory found. Run npm run pff:download first, or pass --dir.`);
    process.exit(1);
  }
  const subdirs = fs
    .readdirSync(base)
    .filter((d) => {
      const dirPath = path.join(base, d);
      if (!fs.statSync(dirPath).isDirectory()) return false;
      return fs.readdirSync(dirPath).some((file) => file.toLowerCase().endsWith(".csv"));
    })
    .sort()
    .reverse();
  if (!subdirs.length) {
    console.error("No CSV-containing subdirectories found in data/pff/. Run npm run pff:download first.");
    process.exit(1);
  }
  return path.join(base, subdirs[0]);
}

const inputDir = path.resolve(dirArg ?? findLatestPffDir());
console.log(`\nReading PFF CSV files from: ${inputDir}`);
console.log(`Season: ${SEASON}\n`);

// ---------------------------------------------------------------------------
// CSV parser (handles quoted values)
// ---------------------------------------------------------------------------

function parseCsv(content: string): Record<string, string>[] {
  const lines = content.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map((h) => h.toLowerCase().trim());
  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = (values[i] ?? "").trim(); });
    return row;
  });
}

function splitCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  values.push(current.trim());
  return values;
}

// ---------------------------------------------------------------------------
// Type coercion helpers
// ---------------------------------------------------------------------------

function toInt(v?: string): number | null {
  if (!v || v.trim() === "" || v.trim() === "-") return null;
  const n = parseInt(v.replace(/,/g, ""), 10);
  return isNaN(n) ? null : n;
}

function toFloat(v?: string): number | null {
  if (!v || v.trim() === "" || v.trim() === "-") return null;
  const n = parseFloat(v.replace(/,/g, "").replace(/%$/, ""));
  return isNaN(n) ? null : n;
}

function str(v?: string): string | null {
  const t = v?.trim();
  return t && t !== "-" ? t : null;
}

// ---------------------------------------------------------------------------
// PFF record (merged across all CSVs)
// ---------------------------------------------------------------------------

type PffRecord = Record<string, string | number | null>;

// ---------------------------------------------------------------------------
// File type detection based on column headers
// ---------------------------------------------------------------------------

type PffFileType =
  | "grades"
  | "passing"
  | "rushing"
  | "receiving"
  | "blocking"
  | "pass_rush"
  | "run_defense"
  | "coverage"
  | "route_tree"
  | "snap_alignment"
  | "unknown";

function detectFileType(headers: string[]): PffFileType {
  const h = new Set(headers.map((x) => x.toLowerCase()));
  if (h.has("grades_pass") || h.has("big_time_throws") || h.has("btt")) return "passing";
  if (h.has("grades_run_block") && h.has("grades_pass_block") && (h.has("pressures_allowed") || h.has("hits_allowed"))) return "blocking";
  if (h.has("grades_pass_rush") || h.has("pass_rush_grade") || h.has("total_pressures")) return "pass_rush";
  if (h.has("grades_run_defense") || (h.has("run_stops") && h.has("grades_defense"))) return "run_defense";
  if (h.has("grades_coverage") || h.has("grades_man_coverage") || h.has("passer_rating_allowed")) return "coverage";
  if (h.has("route_type") || h.has("routes_slant") || h.has("slant_targets") || h.has("route_depth")) return "route_tree";
  if (h.has("snap_counts_slot") || h.has("snaps_slot") || h.has("alignment_snaps") || (h.has("slot") && h.has("wide_left"))) return "snap_alignment";
  if (h.has("carries") || h.has("rushing_yards") || h.has("grades_run")) return "rushing";
  if (h.has("targets") || h.has("receiving_yards") || h.has("grades_pass_route") || h.has("adot")) return "receiving";
  if (h.has("grades_overall") || h.has("overall_grade")) return "grades";
  return "unknown";
}

// ---------------------------------------------------------------------------
// Map a CSV row to partial PffRecord fields based on file type
// ---------------------------------------------------------------------------

function mapGradesRow(row: Record<string, string>): Partial<PffRecord> {
  return {
    grades_overall: toFloat(row.grades_overall ?? row.overall_grade),
    grades_offense: toFloat(row.grades_offense),
    grades_defense: toFloat(row.grades_defense),
    grades_special_teams: toFloat(row.grades_special_teams),
    snaps_offense: toInt(row.snap_counts_offense ?? row.snaps_offense),
    snaps_defense: toInt(row.snap_counts_defense ?? row.snaps_defense),
    snaps_special_teams: toInt(row.snap_counts_special_teams ?? row.snaps_special_teams),
  };
}

function mapPassingRow(row: Record<string, string>): Partial<PffRecord> {
  return {
    grades_pass: toFloat(row.grades_pass ?? row.pass_grade),
    grades_run_qb: toFloat(row.grades_run),
    stats_completions: toInt(row.completions ?? row.comps),
    stats_attempts: toInt(row.attempts ?? row.att),
    stats_passing_yards: toInt(row.yards ?? row.passing_yards ?? row.yds),
    stats_passing_tds: toInt(row.touchdowns ?? row.tds ?? row.passing_tds),
    stats_interceptions: toInt(row.interceptions ?? row.int),
    stats_big_time_throws: toInt(row.big_time_throws ?? row.btt),
    stats_turnover_worthy_plays: toInt(row.turnover_worthy_plays ?? row.twp),
    stats_adjusted_completion_pct: toFloat(row.adjusted_completion_pct ?? row.adj_comp_pct),
    stats_pressure_to_sack: toFloat(row.pressure_to_sack),
    stats_time_to_throw: toFloat(row.time_to_throw ?? row.ttt),
    stats_yards_per_attempt: toFloat(row.yards_per_att ?? row.ypa),
  };
}

function mapRushingRow(row: Record<string, string>): Partial<PffRecord> {
  return {
    grades_run_rb: toFloat(row.grades_run ?? row.run_grade),
    stats_carries: toInt(row.carries ?? row.att),
    stats_rushing_yards: toInt(row.yards ?? row.rushing_yards ?? row.yds),
    stats_rushing_tds: toInt(row.touchdowns ?? row.tds ?? row.rushing_tds),
    stats_ya_contact: toFloat(row.yards_after_contact ?? row.yac),
    stats_yards_after_contact: toFloat(row.yards_after_contact),
    stats_yards_after_contact_per_carry: toFloat(row.yards_after_contact_per_att ?? row.yac_per_att),
    stats_broken_tackles: toInt(row.avoided_tackles ?? row.broken_tackles ?? row.evaded_tackles),
    stats_elusive_rating: toFloat(row.elusive_rating),
    stats_first_downs_rushing: toInt(row.first_downs ?? row.rushing_first_downs),
    stats_fumbles: toInt(row.fumbles),
    grades_pass_block_rb: toFloat(row.grades_pass_block ?? row.pass_block_grade),
    grades_run_block_rb: toFloat(row.grades_run_block ?? row.run_block_grade),
    stats_pass_block_snaps_rb: toInt(row.snap_counts_pass_block ?? row.pass_block_snaps),
    stats_pressures_allowed_rb: toInt(row.pressures_allowed ?? row.total_pressures_allowed),
    stats_run_block_snaps_rb: toInt(row.snap_counts_run_block ?? row.run_block_snaps),
  };
}

function mapReceivingRow(row: Record<string, string>): Partial<PffRecord> {
  return {
    grades_pass_route: toFloat(row.grades_pass_route ?? row.route_grade),
    grades_hands_drop: toFloat(row.grades_hands_drop ?? row.drop_grade),
    stats_targets: toInt(row.targets),
    stats_receptions: toInt(row.receptions ?? row.rec),
    stats_receiving_yards: toInt(row.yards ?? row.receiving_yards ?? row.yds),
    stats_receiving_tds: toInt(row.touchdowns ?? row.tds ?? row.receiving_tds),
    stats_drops: toInt(row.drops),
    stats_yac: toFloat(row.yards_after_catch ?? row.yac),
    stats_yac_per_reception: toFloat(row.yards_after_catch_per_rec ?? row.yac_per_rec),
    stats_contested_catches: toInt(row.contested_catches),
    stats_contested_catch_rate: toFloat(row.contested_catch_rate),
    stats_first_downs_receiving: toInt(row.first_downs ?? row.receiving_first_downs),
    stats_adot: toFloat(row.avg_depth_of_target ?? row.adot),
    stats_catch_rate: toFloat(row.catch_rate ?? row.catch_pct),
    stats_yards_per_route_run: toFloat(row.yards_per_route_run ?? row.yprr),
    stats_route_participation_pct: toFloat(row.route_participation ?? row.route_part_pct),
  };
}

function mapBlockingRow(row: Record<string, string>): Partial<PffRecord> {
  return {
    grades_pass_block: toFloat(row.grades_pass_block ?? row.pass_block_grade),
    grades_run_block: toFloat(row.grades_run_block ?? row.run_block_grade),
    stats_pass_block_snaps: toInt(row.snap_counts_pass_block ?? row.pass_block_snaps),
    stats_pressures_allowed: toInt(row.pressures_allowed ?? row.total_pressures_allowed),
    stats_sacks_allowed: toFloat(row.sacks_allowed),
    stats_hits_allowed: toInt(row.hits_allowed),
    stats_hurries_allowed: toInt(row.hurries_allowed),
    stats_run_block_snaps: toInt(row.snap_counts_run_block ?? row.run_block_snaps),
    stats_penalties: toInt(row.penalties),
  };
}

function mapPassRushRow(row: Record<string, string>): Partial<PffRecord> {
  return {
    grades_pass_rush: toFloat(row.grades_pass_rush ?? row.pass_rush_grade),
    stats_pass_rush_snaps: toInt(row.snap_counts_pass_rush ?? row.pass_rush_snaps),
    stats_pressures: toInt(row.total_pressures ?? row.pressures),
    stats_sacks: toFloat(row.sacks),
    stats_hits: toInt(row.hits),
    stats_hurries: toInt(row.hurries),
    grades_pass_rush_lb: toFloat(row.grades_pass_rush), // reused for LBs
  };
}

function mapRunDefenseRow(row: Record<string, string>): Partial<PffRecord> {
  return {
    grades_run_defense_dl: toFloat(row.grades_run_defense ?? row.run_defense_grade),
    grades_run_defense_lb: toFloat(row.grades_run_defense ?? row.run_defense_grade),
    stats_run_stops: toInt(row.run_stops ?? row.stops),
    stats_run_stop_pct: toFloat(row.run_stop_pct ?? row.stop_pct),
    stats_tackles: toInt(row.tackles ?? row.solo_tackles),
    stats_assists: toInt(row.assists ?? row.assisted_tackles),
    stats_missed_tackles: toInt(row.missed_tackles),
    stats_forced_fumbles: toInt(row.forced_fumbles ?? row.ff),
    grades_tackle: toFloat(row.grades_tackle ?? row.tackle_grade),
    grades_run_defense_lb: toFloat(row.grades_run_defense),
    stats_stops_lb: toInt(row.stops ?? row.run_stops),
  };
}

function mapCoverageRow(row: Record<string, string>): Partial<PffRecord> {
  return {
    grades_coverage_db: toFloat(row.grades_coverage ?? row.coverage_grade),
    grades_coverage_lb: toFloat(row.grades_coverage),
    grades_man_coverage: toFloat(row.grades_man_coverage ?? row.man_coverage_grade),
    grades_zone_coverage: toFloat(row.grades_zone_coverage ?? row.zone_coverage_grade),
    grades_tackle_db: toFloat(row.grades_tackle ?? row.tackle_grade),
    stats_targets_allowed: toInt(row.targets),
    stats_receptions_allowed: toInt(row.receptions_allowed ?? row.rec_allowed),
    stats_yards_allowed: toInt(row.yards_allowed ?? row.yds_allowed),
    stats_tds_allowed: toInt(row.touchdowns_allowed ?? row.tds_allowed),
    stats_interceptions_def: toInt(row.interceptions ?? row.int),
    stats_pass_breakups: toInt(row.pass_breakups ?? row.pbu),
    stats_pff_coverage_snaps: toInt(row.snap_counts_coverage ?? row.coverage_snaps),
    stats_yards_per_coverage_snap: toFloat(row.yards_per_coverage_snap ?? row.yds_per_cov_snap),
    stats_passer_rating_allowed: toFloat(row.passer_rating_when_targeted ?? row.qbr_allowed),
  };
}

function mapRouteTreeRow(row: Record<string, string>): Partial<PffRecord> {
  // PFF route tree CSVs may have one row per player+route or have all routes as columns
  // Handle both: if there's a route_type column, accumulate; if columns, map directly
  const routeType = str(row.route_type ?? row.route)?.toLowerCase().replace(/[^a-z]/g, "");
  if (routeType) {
    // One row per route type
    const targets = toInt(row.targets);
    const receptions = toInt(row.receptions ?? row.rec);
    const key = `stats_routes_${routeType}`;
    return {
      [`${key}_targets`]: targets,
      [`${key}_receptions`]: receptions,
    };
  }
  // Columns per route type
  return {
    stats_routes_slant_targets: toInt(row.slant_targets ?? row.targets_slant),
    stats_routes_slant_receptions: toInt(row.slant_receptions ?? row.rec_slant),
    stats_routes_hitch_targets: toInt(row.hitch_targets ?? row.targets_hitch),
    stats_routes_hitch_receptions: toInt(row.hitch_receptions ?? row.rec_hitch),
    stats_routes_out_targets: toInt(row.out_targets ?? row.targets_out),
    stats_routes_out_receptions: toInt(row.out_receptions ?? row.rec_out),
    stats_routes_curl_targets: toInt(row.curl_targets ?? row.targets_curl),
    stats_routes_curl_receptions: toInt(row.curl_receptions ?? row.rec_curl),
    stats_routes_dig_targets: toInt(row.dig_targets ?? row.targets_dig),
    stats_routes_dig_receptions: toInt(row.dig_receptions ?? row.rec_dig),
    stats_routes_post_targets: toInt(row.post_targets ?? row.targets_post),
    stats_routes_post_receptions: toInt(row.post_receptions ?? row.rec_post),
    stats_routes_corner_targets: toInt(row.corner_targets ?? row.targets_corner),
    stats_routes_corner_receptions: toInt(row.corner_receptions ?? row.rec_corner),
    stats_routes_go_targets: toInt(row.go_targets ?? row.targets_go ?? row.fly_targets),
    stats_routes_go_receptions: toInt(row.go_receptions ?? row.rec_go ?? row.fly_receptions),
    stats_routes_screen_targets: toInt(row.screen_targets ?? row.targets_screen),
    stats_routes_screen_receptions: toInt(row.screen_receptions ?? row.rec_screen),
    stats_routes_crosser_targets: toInt(row.crosser_targets ?? row.cross_targets ?? row.targets_crosser),
    stats_routes_crosser_receptions: toInt(row.crosser_receptions ?? row.cross_receptions ?? row.rec_crosser),
  };
}

function mapSnapAlignmentRow(row: Record<string, string>): Partial<PffRecord> {
  return {
    snaps_slot: toInt(row.snap_counts_slot ?? row.slot ?? row.snaps_slot),
    snaps_wide_left: toInt(row.snap_counts_wide_left ?? row.wide_left ?? row.snaps_wide_left),
    snaps_wide_right: toInt(row.snap_counts_wide_right ?? row.wide_right ?? row.snaps_wide_right),
    snaps_inline_te: toInt(row.snap_counts_inline ?? row.inline ?? row.snaps_inline_te ?? row.inline_te),
    snaps_backfield: toInt(row.snap_counts_backfield ?? row.backfield ?? row.snaps_backfield),
    snaps_as_flanker: toInt(row.snap_counts_flanker ?? row.flanker ?? row.snaps_as_flanker),
    snaps_at_left_tackle: toInt(row.snap_counts_left_tackle ?? row.left_tackle ?? row.lt),
    snaps_at_left_guard: toInt(row.snap_counts_left_guard ?? row.left_guard ?? row.lg),
    snaps_at_center: toInt(row.snap_counts_center ?? row.center ?? row.c),
    snaps_at_right_guard: toInt(row.snap_counts_right_guard ?? row.right_guard ?? row.rg),
    snaps_at_right_tackle: toInt(row.snap_counts_right_tackle ?? row.right_tackle ?? row.rt),
    snaps_at_left_end: toInt(row.snap_counts_left_end ?? row.left_end ?? row.le),
    snaps_at_right_end: toInt(row.snap_counts_right_end ?? row.right_end ?? row.re),
    snaps_interior_dl: toInt(row.snap_counts_interior ?? row.interior ?? row.dt ?? row.idt),
    snaps_in_box_lb: toInt(row.snap_counts_box ?? row.in_box ?? row.box ?? row.snaps_in_box_lb),
    snaps_off_ball_lb: toInt(row.snap_counts_off_ball ?? row.off_ball ?? row.snaps_off_ball_lb),
    snaps_free_safety: toInt(row.snap_counts_free_safety ?? row.free_safety ?? row.fs),
    snaps_strong_safety: toInt(row.snap_counts_strong_safety ?? row.strong_safety ?? row.ss),
    snaps_slot_cb: toInt(row.snap_counts_slot_cb ?? row.slot_cb ?? row.nickel_cb),
    snaps_outside_cb: toInt(row.snap_counts_outside_cb ?? row.outside_cb ?? row.boundary_cb),
    snaps_in_box_db: toInt(row.snap_counts_box_db ?? row.in_box_db ?? row.box_safety),
    snaps_deep_safety: toInt(row.snap_counts_deep ?? row.deep ?? row.deep_safety),
  };
}

// ---------------------------------------------------------------------------
// Process a single CSV file and merge into playerMap
// ---------------------------------------------------------------------------

type PlayerKey = string; // `${pff_player_id}`

function processFile(
  filePath: string,
  playerMap: Map<PlayerKey, PffRecord>
): void {
  const content = fs.readFileSync(filePath, "utf8");
  const rows = parseCsv(content);
  if (!rows.length) {
    console.log(`  Skipping empty file: ${path.basename(filePath)}`);
    return;
  }

  const headers = Object.keys(rows[0]);
  const fileType = detectFileType(headers);
  console.log(`  ${path.basename(filePath)} → detected as: ${fileType} (${rows.length} rows)`);

  for (const row of rows) {
    // PFF uses "player_id" for their internal ID, "player" for name
    const pffId =
      str(row.player_id ?? row.pff_id ?? row.id) ??
      str(row.franchise_id);
    const playerName = str(row.player ?? row.player_name ?? row.name);
    const teamName = str(row.team_name ?? row.team ?? row.franchise);
    const position = str(row.position ?? row.pos);

    if (!pffId || !playerName) continue;

    const key: PlayerKey = pffId;
    if (!playerMap.has(key)) {
      playerMap.set(key, {
        pff_player_id: toInt(pffId),
        player_name: playerName,
        team_name: teamName,
        position: position,
      });
    } else {
      // Update name/team/position if missing
      const existing = playerMap.get(key)!;
      if (!existing.player_name) existing.player_name = playerName;
      if (!existing.team_name && teamName) existing.team_name = teamName;
      if (!existing.position && position) existing.position = position;
    }

    const record = playerMap.get(key)!;
    let mapped: Partial<PffRecord> = {};

    switch (fileType) {
      case "grades":       mapped = mapGradesRow(row); break;
      case "passing":      mapped = mapPassingRow(row); break;
      case "rushing":      mapped = mapRushingRow(row); break;
      case "receiving":    mapped = mapReceivingRow(row); break;
      case "blocking":     mapped = mapBlockingRow(row); break;
      case "pass_rush":    mapped = mapPassRushRow(row); break;
      case "run_defense":  mapped = mapRunDefenseRow(row); break;
      case "coverage":     mapped = mapCoverageRow(row); break;
      case "route_tree":   mapped = mapRouteTreeRow(row); break;
      case "snap_alignment": mapped = mapSnapAlignmentRow(row); break;
      default: break;
    }

    // Merge non-null values (don't overwrite existing values with null)
    for (const [k, v] of Object.entries(mapped)) {
      if (v !== null && v !== undefined) {
        record[k] = v;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Resolve player_id by matching name + team against our players table
// ---------------------------------------------------------------------------

async function resolvePlayerIds(
  playerMap: Map<PlayerKey, PffRecord>
): Promise<void> {
  console.log("\nFetching players from Supabase for name matching...");
  const { data: players, error } = await supabase
    .from("players" as never)
    .select("id, first_name, last_name, current_school");

  if (error || !players) {
    console.warn("Could not fetch players:", error?.message ?? "unknown error");
    return;
  }

  // Build lookup: normalized "firstname lastname" → player_id
  const nameMap = new Map<string, string>();
  for (const p of players as Array<{ id: string; first_name: string | null; last_name: string | null; current_school: string | null }>) {
    if (p.first_name && p.last_name) {
      const key = `${p.first_name.toLowerCase()} ${p.last_name.toLowerCase()}`;
      nameMap.set(key, p.id);
    }
  }

  let matched = 0;
  let unmatched = 0;

  for (const record of playerMap.values()) {
    const nameKey = String(record.player_name ?? "").toLowerCase();
    const playerId = nameMap.get(nameKey);
    if (playerId) {
      record.player_id = playerId;
      matched++;
    } else {
      record.player_id = null;
      unmatched++;
    }
  }

  console.log(`  Matched ${matched} players, ${unmatched} unmatched (will still be imported with null player_id)`);
}

// ---------------------------------------------------------------------------
// Upsert to Supabase
// ---------------------------------------------------------------------------

async function upsertToSupabase(playerMap: Map<PlayerKey, PffRecord>): Promise<void> {
  const rows = Array.from(playerMap.values()).map((r) => ({
    ...r,
    season: SEASON,
  }));

  const CHUNK = 200;
  let imported = 0;

  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await supabase
      .from("player_pff_grades" as never)
      .upsert(chunk as never, { onConflict: "pff_player_id,season" });

    if (error) {
      console.error(`Upsert failed for rows ${i + 1}–${i + chunk.length}:`, error.message);
      process.exit(1);
    }

    imported += chunk.length;
    console.log(`  Upserted ${imported}/${rows.length}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (!fs.existsSync(inputDir)) {
    console.error(`Directory not found: ${inputDir}`);
    process.exit(1);
  }

  const csvFiles = fs
    .readdirSync(inputDir)
    .filter((f) => f.toLowerCase().endsWith(".csv"))
    .map((f) => path.join(inputDir, f));

  if (!csvFiles.length) {
    console.error(`No CSV files found in ${inputDir}`);
    process.exit(1);
  }

  console.log(`Found ${csvFiles.length} CSV file(s):\n`);

  // Merge all CSVs into a single player map
  const playerMap = new Map<PlayerKey, PffRecord>();
  for (const file of csvFiles) {
    processFile(file, playerMap);
  }

  console.log(`\nTotal unique players: ${playerMap.size}`);

  // Resolve player_ids
  await resolvePlayerIds(playerMap);

  // Upsert
  console.log("\nUpserting to player_pff_grades...");
  await upsertToSupabase(playerMap);

  console.log("\nDone!");
  console.log(`Next step: npm run pff:spreadsheet`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
