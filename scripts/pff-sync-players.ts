/**
 * PFF Player Sync
 *
 * Creates `players` table entries for any PFF records that have player_id = null
 * (i.e., players who appear in PFF data but were never matched to our players table).
 * After inserting, back-fills player_pff_grades.player_id for those records.
 *
 * Usage:
 *   npm run pff:sync-players              # create missing players
 *   npm run pff:sync-players -- --dry-run # preview only, no writes
 */

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

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

const DRY_RUN = process.argv.includes("--dry-run");

// ---------------------------------------------------------------------------
// Position mapping: PFF text → position_group enum
// ---------------------------------------------------------------------------

type PositionGroup = "QB" | "RB" | "WR" | "TE" | "OL" | "EDGE" | "DL" | "LB" | "CB" | "S" | "ST";

const POSITION_MAP: Record<string, PositionGroup> = {
  // QB
  QB: "QB",
  // RB
  HB: "RB", RB: "RB", FB: "RB",
  // WR
  WR: "WR", SE: "WR", FL: "WR",
  // TE
  TE: "TE",
  // OL
  OL: "OL", OT: "OL", OG: "OL", C: "OL",
  LT: "OL", RT: "OL", LG: "OL", RG: "OL",
  T: "OL", G: "OL",
  // EDGE
  EDGE: "EDGE", DE: "EDGE",
  // DL
  DT: "DL", DL: "DL", NT: "DL", NG: "DL",
  // LB
  LB: "LB", ILB: "LB", OLB: "LB", MLB: "LB",
  LILB: "LB", RILB: "LB", LOLB: "LB", ROLB: "LB",
  // CB
  CB: "CB", NCB: "CB", DB: "CB",
  // S
  S: "S", FS: "S", SS: "S",
  // ST
  K: "ST", P: "ST", LS: "ST",
};

function mapPosition(pos: string | null | undefined): PositionGroup | null {
  if (!pos) return null;
  return POSITION_MAP[pos.toUpperCase().trim()] ?? null;
}

// ---------------------------------------------------------------------------
// Name parsing
// ---------------------------------------------------------------------------

function parseName(fullName: string): { first_name: string; last_name: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { first_name: parts[0], last_name: "" };
  const first_name = parts[0];
  const last_name = parts.slice(1).join(" ");
  return { first_name, last_name };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\nPFF Player Sync${DRY_RUN ? " (DRY RUN)" : ""}\n`);

  // Fetch all PFF records with no linked player
  console.log("Fetching unmatched PFF records (player_id IS NULL)...");
  const { data: unmatched, error } = await supabase
    .from("player_pff_grades" as never)
    .select("id, pff_player_id, player_name, position, team_name, season")
    .is("player_id", null)
    .order("season", { ascending: false });

  if (error) {
    console.error("Failed to fetch PFF records:", error.message);
    process.exit(1);
  }

  if (!unmatched || unmatched.length === 0) {
    console.log("No unmatched PFF records found. All players are already linked.");
    return;
  }

  // Deduplicate by pff_player_id — keep the row with the most recent season
  const byPffId = new Map<number, {
    id: string;
    pff_player_id: number;
    player_name: string;
    position: string | null;
    team_name: string | null;
    season: number;
  }>();
  for (const row of unmatched as Array<{
    id: string;
    pff_player_id: number;
    player_name: string;
    position: string | null;
    team_name: string | null;
    season: number;
  }>) {
    const existing = byPffId.get(row.pff_player_id);
    if (!existing || row.season > existing.season) {
      byPffId.set(row.pff_player_id, row);
    }
  }

  console.log(`Found ${unmatched.length} unmatched rows → ${byPffId.size} unique PFF players\n`);

  // Build list of players to create
  type PlayerInsert = {
    first_name: string;
    last_name: string;
    position: PositionGroup;
    transfer_year: number;
    current_school: string;
    class_year: string;
    eligibility_remaining: number;
    status: string;
  };

  const toCreate: Array<PlayerInsert & { pff_player_id: number }> = [];
  const skipped: string[] = [];

  for (const row of byPffId.values()) {
    const position = mapPosition(row.position);
    if (!position) {
      skipped.push(`${row.player_name} (position "${row.position ?? "unknown"}" not mappable)`);
      continue;
    }
    const { first_name, last_name } = parseName(row.player_name);
    if (!first_name || !last_name) {
      skipped.push(`${row.player_name} (could not parse name)`);
      continue;
    }
    toCreate.push({
      pff_player_id: row.pff_player_id,
      first_name,
      last_name,
      position,
      transfer_year: row.season,
      current_school: row.team_name ?? "Unknown",
      class_year: "Unknown",
      eligibility_remaining: 1,
      status: "Portal",
    });
  }

  if (skipped.length) {
    console.log(`Skipping ${skipped.length} players (unmappable):`);
    for (const s of skipped) console.log(`  - ${s}`);
    console.log();
  }

  console.log(`Will create ${toCreate.length} players:`);
  for (const p of toCreate) {
    console.log(`  ${p.first_name} ${p.last_name} | ${p.position} | ${p.current_school} | season ${p.transfer_year}`);
  }
  console.log();

  if (DRY_RUN) {
    console.log("DRY RUN — no changes written.");
    return;
  }

  if (toCreate.length === 0) {
    console.log("Nothing to create.");
    return;
  }

  // Insert players (exclude pff_player_id from insert)
  const inserts = toCreate.map(({ pff_player_id: _id, ...rest }) => rest);
  const { data: created, error: insertErr } = await supabase
    .from("players" as never)
    .insert(inserts as never)
    .select("id, first_name, last_name");

  if (insertErr || !created) {
    console.error("Failed to insert players:", insertErr?.message ?? "no data returned");
    process.exit(1);
  }

  console.log(`Created ${(created as Array<{ id: string }>).length} players.\n`);

  // Back-fill player_pff_grades.player_id for each newly created player
  console.log("Back-filling player_pff_grades.player_id...");
  let linked = 0;

  for (const newPlayer of created as Array<{ id: string; first_name: string; last_name: string }> ) {
    const match = toCreate.find(
      (p) => p.first_name === newPlayer.first_name && p.last_name === newPlayer.last_name
    );
    if (!match) continue;

    const { error: updateErr } = await supabase
      .from("player_pff_grades" as never)
      .update({ player_id: newPlayer.id } as never)
      .eq("pff_player_id", match.pff_player_id as never)
      .is("player_id", null);

    if (updateErr) {
      console.warn(`  Failed to link ${newPlayer.first_name} ${newPlayer.last_name}:`, updateErr.message);
    } else {
      linked++;
    }
  }

  console.log(`Linked ${linked}/${(created as Array<{ id: string }>).length} players in player_pff_grades.\n`);
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
