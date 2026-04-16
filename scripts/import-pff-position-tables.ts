/**
 * Migrates PFF data from the raw position-specific Supabase tables
 * (CB, LB, RB, OL, QB, S, TE, DL/Edge) into player_pff_grades.
 *
 * These tables were created by an earlier direct-import step and contain
 * the same raw column names as the PFF spreadsheet. This script normalizes
 * and upserts the data so the app can display it.
 *
 * Usage:
 *   npm run pff:import-positions [-- --season 2025] [--dry-run]
 */

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { createHash, randomUUID } from "node:crypto";
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

const DRY_RUN = process.argv.includes("--dry-run");
const seasonArg = process.argv.find((a) => a.startsWith("--season="))?.split("=")[1]
  ?? process.argv[process.argv.indexOf("--season") + 1];
const SEASON = seasonArg ? Number(seasonArg) : Number(process.env.PFF_SEASON ?? new Date().getFullYear());

type Row = Record<string, unknown>;

function normName(v: string | null | undefined): string {
  return (v ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normTeam(v: string | null | undefined): string {
  return (v ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function syntheticId(player: string, pos: string, team: string | null, season: number): number {
  const seed = `${normName(player)}|${pos.toUpperCase()}|${normTeam(team)}|${season}`;
  const hex = createHash("sha256").update(seed).digest("hex").slice(0, 8);
  return -1 * ((parseInt(hex, 16) % 2_000_000_000) + 1);
}

function num(v: unknown): number | null {
  if (v == null || v === "" || v === "—" || v === "-") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function int(v: unknown): number | null {
  const n = num(v);
  return n == null ? null : Math.round(n);
}

function sumCols(row: Row, ...keys: string[]): number | null {
  let total = 0; let found = false;
  for (const k of keys) {
    const n = num(row[k]);
    if (n != null) { total += n; found = true; }
  }
  return found ? Math.round(total) : null;
}

// ---------------------------------------------------------------------------
// Fetch all rows from a position table (handles slash in table name via RPC)
// ---------------------------------------------------------------------------
async function fetchTable(tableName: string): Promise<Row[]> {
  // Supabase JS client can't handle "/" in table names — use raw SQL via rpc
  const { data, error } = await supabase.rpc("exec_sql_select" as never, {
    sql: `SELECT * FROM "${tableName}"`,
  } as never);
  if (error) {
    // Fallback: try direct .from() for normal names
    const { data: d2, error: e2 } = await supabase.from(tableName as never).select("*");
    if (e2) { console.error(`  Failed to fetch "${tableName}":`, e2.message); return []; }
    return (d2 ?? []) as Row[];
  }
  return (data ?? []) as Row[];
}

// ---------------------------------------------------------------------------
// Build player lookup map (normalized name → uuid)
// ---------------------------------------------------------------------------
async function buildPlayerMap(): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from("players" as never)
    .select("id, first_name, last_name");
  if (error || !data) { console.error("Failed to fetch players:", error?.message); process.exit(1); }
  const map = new Map<string, string>();
  for (const p of data as Array<{ id: string; first_name: string; last_name: string }>) {
    const key = normName(`${p.first_name} ${p.last_name}`);
    if (!map.has(key)) map.set(key, p.id); // first match wins
  }
  return map;
}

// ---------------------------------------------------------------------------
// Position-specific record builders
// ---------------------------------------------------------------------------

function buildCb(row: Row, playerId: string | null, season: number): Row {
  return {
    pff_player_id: syntheticId(row["Player"] as string, "CB", row["Team"] as string, season),
    player_name: row["Player"],
    position: "CB",
    team_name: row["Team"],
    season,
    player_id: playerId,
    grades_coverage_db: num(row["Coverage"]),
    grades_defense: num(row["Defense"]),
    grades_tackle_db: num(row["Tackle"]),
    snaps_defense: int(row["Pass Play Snaps"]),
    stats_pff_coverage_snaps: int(row["Cov Snaps"]),
    stats_targets_allowed: int(row["Tgts Allow"]),
    stats_receptions_allowed: int(row["Rec Allow"]),
    stats_yards_allowed: int(row["Yds Allow"]),
    stats_tds_allowed: int(row["TDs Allow"]),
    stats_interceptions_def: int(row["INTs"]),
    stats_pass_breakups: int(row["PBU"]),
    stats_passer_rating_allowed: num(row["QBR Allow"]),
    stats_yards_per_coverage_snap: num(row["Yds/CovSnap"]),
    stats_tackles: int(row["Tackles"]),
    stats_assists: int(row["Assists"]),
    snaps_slot_cb: sumCols(row, "Slot Corner — SCBiL", "Slot Corner — SCBiR", "Slot Corner — SCBL",
      "Slot Corner — SCBoL", "Slot Corner — SCBoR", "Slot Corner — SCBR"),
    snaps_outside_cb: sumCols(row, "Wide Corner — LCB", "Wide Corner — RCB"),
  };
}

function buildS(row: Row, playerId: string | null, season: number): Row {
  return {
    pff_player_id: syntheticId(row["Player"] as string, "S", row["Team"] as string, season),
    player_name: row["Player"],
    position: "S",
    team_name: row["Team"],
    season,
    player_id: playerId,
    grades_coverage_db: num(row["Coverage"]),
    grades_defense: num(row["Defense"]),
    grades_run_defense_lb: num(row["Run Def"]),
    grades_tackle_db: num(row["Tackle"]),
    snaps_defense: int(row["Pass Play Snaps"]),
    stats_pff_coverage_snaps: int(row["Cov Snaps"]),
    stats_targets_allowed: int(row["Tgts Allow"]),
    stats_receptions_allowed: int(row["Rec Allow"]),
    stats_yards_allowed: int(row["Yds Allow"]),
    stats_tds_allowed: int(row["TDs Allow"]),
    stats_interceptions_def: int(row["INTs"]),
    stats_pass_breakups: int(row["PBU"]),
    stats_passer_rating_allowed: num(row["QBR Allow"]),
    stats_yards_per_coverage_snap: num(row["Yds/CovSnap"]),
    stats_tackles: int(row["Tackles"]),
    stats_assists: int(row["Assists"]),
    snaps_free_safety: sumCols(row, "Free Safety — FS", "Free Safety — FSL", "Free Safety — FSR"),
    snaps_strong_safety: sumCols(row, "Box — SS", "Box — SSL", "Box — SSR"),
  };
}

function buildLb(row: Row, playerId: string | null, season: number): Row {
  return {
    pff_player_id: syntheticId(row["Player"] as string, "LB", row["Team"] as string, season),
    player_name: row["Player"],
    position: "LB",
    team_name: row["Team"],
    season,
    player_id: playerId,
    grades_coverage_lb: num(row["Coverage"]),
    grades_defense: num(row["Defense"]),
    grades_run_defense_lb: num(row["Run Def"]),
    grades_tackle: num(row["Tackle"]),
    grades_pass_rush_lb: num(row["Pass Rush"]),
    snaps_defense: int(row["Pass Play Snaps"]),
    stats_pff_coverage_snaps: int(row["Cov Snaps"]),
    stats_pass_rush_snaps: int(row["PR Snaps"]),
    stats_tackles: int(row["Tackles"]),
    stats_assists: int(row["Assists"]),
    stats_stops_lb: int(row["Stops"]),
    stats_missed_tackles: int(row["Missed Tkls"]),
    stats_forced_fumbles: int(row["Forced Fmbl"]),
    stats_targets_allowed: int(row["Tgts Allow"]),
    stats_receptions_allowed: int(row["Rec Allow"]),
    stats_interceptions_def: int(row["INTs"]),
    stats_pass_breakups: int(row["PBU"]),
    stats_passer_rating_allowed: num(row["QBR Allow"]),
    stats_pressures: int(row["Pressures"]),
    stats_sacks: num(row["Sacks"]),
  };
}

function buildOl(row: Row, playerId: string | null, season: number): Row {
  return {
    pff_player_id: syntheticId(row["Player"] as string, "OL", row["Team"] as string, season),
    player_name: row["Player"],
    position: "OL",
    team_name: row["Team"],
    season,
    player_id: playerId,
    grades_overall: num(row["Overall"]),
    grades_pass_block: num(row["Pass Block"]),
    grades_run_block: num(row["Run Block"]),
    snaps_offense: int(row["Snaps"]),
    stats_pass_block_snaps: int(row["PB Snaps"]),
    stats_run_block_snaps: int(row["RB Snaps"]),
    stats_pressures_allowed: int(row["Press Allow"]),
    stats_sacks_allowed: int(row["Sacks Allow"]),
    stats_hits_allowed: int(row["Hits Allow"]),
    stats_hurries_allowed: int(row["Hurries Allow"]),
    stats_penalties: int(row["Penalties"]),
    snaps_at_left_tackle: int(row["OLine — LT"]),
    snaps_at_left_guard: int(row["OLine — LG"]),
    snaps_at_center: int(row["OLine — C"]),
    snaps_at_right_guard: int(row["OLine — RG"]),
    snaps_at_right_tackle: int(row["OLine — RT"]),
  };
}

function buildQb(row: Row, playerId: string | null, season: number): Row {
  return {
    pff_player_id: syntheticId(row["Player"] as string, "QB", row["Team"] as string, season),
    player_name: row["Player"],
    position: "QB",
    team_name: row["Team"],
    season,
    player_id: playerId,
    grades_offense: num(row["Offense"]),
    grades_pass: num(row["Pass Grade"]),
    snaps_offense: int(row["Pass Snaps"]),
    stats_attempts: int(row["Att"]),
    stats_completions: int(row["Comp"]),
    stats_passing_yards: int(row["Yds"]),
    stats_passing_tds: int(row["TDs"]),
    stats_interceptions: int(row["INTs"]),
    stats_big_time_throws: int(row["BTT"]),
    stats_turnover_worthy_plays: int(row["TWP"]),
    stats_yards_per_attempt: num(row["YPA"]),
    stats_adjusted_completion_pct: num(row["Adj Comp%"]),
    stats_pressure_to_sack: num(row["Pr→Sack%"]),
    stats_time_to_throw: num(row["TTT"]),
  };
}

function buildRb(row: Row, playerId: string | null, season: number): Row {
  return {
    pff_player_id: syntheticId(row["Player"] as string, "RB", row["Team"] as string, season),
    player_name: row["Player"],
    position: "RB",
    team_name: row["Team"],
    season,
    player_id: playerId,
    grades_offense: num(row["Offense"]),
    grades_run_rb: num(row["Run Grade"]),
    grades_pass_block_rb: num(row["Pass Block"]),
    grades_pass_route: num(row["Recv Grade"]),
    snaps_offense: int(row["Run Plays"]),
    stats_carries: int(row["Carries"]),
    stats_rushing_yards: int(row["Yds"]),
    stats_rushing_tds: int(row["TDs"]),
    stats_first_downs_rushing: int(row["1st Downs"]),
    stats_yards_after_contact: num(row["YAC"]),
    stats_yards_after_contact_per_carry: num(row["YAC/Car"]),
    stats_broken_tackles: int(row["Broken Tkls"]),
    stats_elusive_rating: num(row["Elusive Rtg"]),
    stats_fumbles: int(row["Fumbles"]),
    stats_targets: int(row["Tgts"]),
    stats_receptions: int(row["Rec"]),
    stats_receiving_yards: int(row["Rec Yds"]),
    stats_yards_per_route_run: num(row["Y/RR"]),
  };
}

function buildTe(row: Row, playerId: string | null, season: number): Row {
  return {
    pff_player_id: syntheticId(row["Player"] as string, "TE", row["Team"] as string, season),
    player_name: row["Player"],
    position: "TE",
    team_name: row["Team"],
    season,
    player_id: playerId,
    grades_offense: num(row["Offense"]),
    grades_pass_route: num(row["Route Grade"]),
    grades_run_block: num(row["Block Grade"]),
    snaps_offense: int(row["Pass Plays"]),
    stats_targets: int(row["Tgts"]),
    stats_receptions: int(row["Rec"]),
    stats_catch_rate: num(row["Catch%"]),
    stats_receiving_yards: int(row["Yds"]),
    stats_receiving_tds: int(row["TDs"]),
    stats_drops: int(row["Drops"]),
    stats_adot: num(row["ADOT"]),
    stats_yac_per_reception: num(row["YAC/Rec"]),
    stats_yards_per_route_run: num(row["Y/RR"]),
    stats_pass_block_snaps: int(row["Pass Blocks"]),
    snaps_inline_te: int(row["Inline Snaps"]),
  };
}

function buildDlEdge(row: Row, playerId: string | null, season: number): Row {
  const pos = ((row["Pos"] as string) ?? "EDGE").toUpperCase();
  const mappedPos = ["DT", "NT", "DL"].includes(pos) ? "DL" : "EDGE";
  return {
    pff_player_id: syntheticId(row["Player"] as string, mappedPos, row["Team"] as string, season),
    player_name: row["Player"],
    position: mappedPos,
    team_name: row["Team"],
    season,
    player_id: playerId,
    grades_defense: num(row["Defense"]),
    grades_pass_rush: num(row["Pass Rush"]),
    grades_run_defense_dl: num(row["Run Def"]),
    grades_tackle: num(row["Tackle"]),
    snaps_defense: int(row["Pass Play Snaps"]),
    stats_pass_rush_snaps: int(row["PR Snaps"]),
    stats_pressures: int(row["Pressures"]),
    stats_sacks: num(row["Sacks"]),
    stats_run_stops: int(row["Stops"]),
    stats_tackles: int(row["Tackles"]),
    stats_assists: int(row["Assists"]),
    stats_missed_tackles: int(row["Missed Tkls"]),
    stats_forced_fumbles: int(row["Forced Fmbl"]),
    stats_run_stop_pct: num(row["Stop%"]),
    snaps_at_left_end: sumCols(row, "DLine — LE", "DLine — LEO", "DLine — LOLB"),
    snaps_at_right_end: sumCols(row, "DLine — RE", "DLine — REO", "DLine — ROLB"),
    snaps_interior_dl: sumCols(row, "DLine — DLT", "DLine — DRT", "DLine — NT", "DLine — NLT", "DLine — NRT"),
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const TABLES: Array<{
  name: string;
  build: (row: Row, playerId: string | null, season: number) => Row;
}> = [
  { name: "CB", build: buildCb },
  { name: "S", build: buildS },
  { name: "LB", build: buildLb },
  { name: "OL", build: buildOl },
  { name: "QB", build: buildQb },
  { name: "RB", build: buildRb },
  { name: "TE", build: buildTe },
  { name: "DL/Edge", build: buildDlEdge },
];

async function main() {
  console.log(`\nPFF Position Tables → player_pff_grades`);
  console.log(`Season: ${SEASON}`);
  if (DRY_RUN) console.log(`DRY RUN — no writes\n`);

  const playerMap = await buildPlayerMap();
  console.log(`Loaded ${playerMap.size} players for name matching.\n`);

  let totalInserted = 0;
  let totalUnmatched = 0;

  for (const { name, build } of TABLES) {
    process.stdout.write(`Processing "${name}" ... `);

    // Fetch rows — handle DL/Edge via direct SQL workaround
    let rows: Row[] = [];
    if (name === "DL/Edge") {
      // Use raw select with escaped table name — Supabase REST may reject slash
      // Try direct .from() first; if it fails the table may not exist
      const { data, error } = await (supabase as unknown as { from: (t: string) => { select: (s: string) => Promise<{ data: unknown; error: { message: string } | null }> } })
        .from("DL/Edge")
        .select("*");
      if (error) {
        console.log(`⚠ skipped (${error.message})`);
        continue;
      }
      rows = (data ?? []) as Row[];
    } else {
      const { data, error } = await supabase.from(name as never).select("*");
      if (error) {
        console.log(`⚠ skipped (${error.message})`);
        continue;
      }
      rows = (data ?? []) as Row[];
    }

    console.log(`${rows.length} rows`);

    const records: Row[] = [];
    let unmatched = 0;

    for (const row of rows) {
      const playerName = (row["Player"] as string | undefined)?.trim();
      if (!playerName) continue;

      const playerId = playerMap.get(normName(playerName)) ?? null;
      if (!playerId) unmatched++;

      const record = build(row, playerId, SEASON);

      // Strip null/undefined fields (keep pff_player_id + season always)
      const cleaned: Row = {};
      for (const [k, v] of Object.entries(record)) {
        if (k === "pff_player_id" || k === "season" || k === "player_name" || k === "position") {
          cleaned[k] = v;
        } else if (v !== null && v !== undefined) {
          cleaned[k] = v;
        }
      }
      records.push(cleaned);
    }

    console.log(`  Matched: ${rows.length - unmatched}  Unmatched: ${unmatched}`);
    totalUnmatched += unmatched;

    if (DRY_RUN || records.length === 0) continue;

    const CHUNK = 200;
    for (let i = 0; i < records.length; i += CHUNK) {
      const chunk = records.slice(i, i + CHUNK);
      const { error } = await supabase
        .from("player_pff_grades" as never)
        .upsert(chunk as never, { onConflict: "pff_player_id,season" });
      if (error) {
        console.error(`  Upsert error (rows ${i}-${i + chunk.length}):`, error.message);
      } else {
        process.stdout.write(`  Upserted ${Math.min(i + CHUNK, records.length)}/${records.length}\r`);
      }
    }
    console.log(`  Done ✓`);
    totalInserted += records.length;
  }

  console.log(`\nComplete. Upserted ${totalInserted} records. Unmatched names: ${totalUnmatched}.`);
  if (totalUnmatched > 0) {
    console.log(`  Run 'npm run pff:sync-players' after this to create player entries for unmatched rows.`);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
