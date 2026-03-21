/**
 * Report players missing stats.
 *
 * Outputs:
 *  - players with no player_stats rows at all
 *  - players missing stats for a target season
 *
 * Prereqs: .env.local / .env:
 *  - NEXT_PUBLIC_SUPABASE_URL
 *  - SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional:
 *  - TRANSFER_YEAR=2026 (default current year)
 *  - CFBD_SEASON=2025 (default TRANSFER_YEAR-1)
 *
 * Run: npm run report:missing-stats
 */

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

// Allow piping to `head` without crashing on EPIPE.
process.stdout.on("error", (err: any) => {
  if (err?.code === "EPIPE") process.exit(0);
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const transferYear = Number(process.env.TRANSFER_YEAR) || new Date().getFullYear();
const season = Number(process.env.CFBD_SEASON) || transferYear - 1;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, serviceRoleKey);

async function main() {
  const { data: players, error } = await supabase
    .from("players")
    .select("id, first_name, last_name, position, current_school, previous_school");

  if (error) {
    console.error("Fetch players error:", error);
    process.exit(1);
  }

  const { data: stats, error: statsErr } = await supabase
    .from("player_stats")
    .select("player_id, season");

  if (statsErr) {
    console.error("Fetch player_stats error:", statsErr);
    process.exit(1);
  }

  const seasonsByPlayer = new Map<string, Set<number>>();
  for (const row of stats ?? []) {
    const set = seasonsByPlayer.get(row.player_id) ?? new Set<number>();
    set.add(row.season);
    seasonsByPlayer.set(row.player_id, set);
  }

  const noStats: typeof players = [];
  const missingSeason: typeof players = [];

  for (const p of players ?? []) {
    const seasons = seasonsByPlayer.get(p.id);
    if (!seasons || seasons.size === 0) {
      noStats.push(p);
      missingSeason.push(p);
      continue;
    }
    if (!seasons.has(season)) {
      missingSeason.push(p);
    }
  }

  console.log(`Players total: ${(players ?? []).length}`);
  console.log(`Target season: ${season}`);
  console.log(`No stats at all: ${noStats.length}`);
  console.log(`Missing season ${season}: ${missingSeason.length}`);
  console.log("");

  const format = (p: (typeof players)[number]) =>
    `${p.last_name}, ${p.first_name} | ${p.position} | prev=${p.previous_school ?? "-"} | cur=${p.current_school}`;

  console.log("=== NO STATS AT ALL ===");
  for (const p of noStats.sort((a, b) => a.last_name.localeCompare(b.last_name))) {
    console.log(format(p));
  }
  console.log("");
  console.log(`=== MISSING SEASON ${season} ===`);
  for (const p of missingSeason.sort((a, b) => a.last_name.localeCompare(b.last_name))) {
    console.log(format(p));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

