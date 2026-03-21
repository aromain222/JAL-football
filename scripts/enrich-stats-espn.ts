/**
 * Backfill player_stats from ESPN athlete pages for players with saved espn_url in player_identity_links.
 *
 * Prereqs:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional:
 * - ESPN_STATS_LIMIT=50
 * - ESPN_STATS_SEASON=2025
 * - ESPN_STATS_DELAY_MS=800
 * - ESPN_STATS_ONLY_MISSING=1
 *
 * Run:
 *   npm run enrich:stats:espn
 */

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { fetchEspnPlayerStats } from "@/lib/espn/player-stats";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const limit = Number(process.env.ESPN_STATS_LIMIT) || 50;
const season = Number(process.env.ESPN_STATS_SEASON) || 2025;
const delayMs = Number(process.env.ESPN_STATS_DELAY_MS) || 800;
const onlyMissing =
  process.env.ESPN_STATS_ONLY_MISSING === "0"
    ? false
    : process.env.ESPN_STATS_ONLY_MISSING === "false"
      ? false
      : true;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  const [{ data: linksRaw, error }, { data: existingStatsRaw, error: existingStatsError }] = await Promise.all([
    supabase
      .from("player_identity_links")
      .select("player_id, espn_url")
      .not("espn_url", "is", null),
    supabase.from("player_stats").select("player_id").eq("season", season)
  ]);

  if (error) {
    console.error("Fetch player_identity_links error:", error);
    process.exit(1);
  }

  if (existingStatsError) {
    console.error("Fetch existing player_stats error:", existingStatsError);
    process.exit(1);
  }

  const links = (linksRaw ?? []) as Array<{ player_id: string; espn_url: string | null }>;
  const playersWithSeasonStats = new Set((existingStatsRaw ?? []).map((row) => row.player_id));

  const scopedLinks = onlyMissing
    ? links.filter((link) => !playersWithSeasonStats.has(link.player_id)).slice(0, limit)
    : links.slice(0, limit);

  if (!scopedLinks.length) {
    console.log("No players with espn_url found.");
    return;
  }

  console.log(
    `ESPN stats backfill for ${scopedLinks.length} players (season ${season}, delay ${delayMs}ms, onlyMissing=${onlyMissing})...`
  );

  let imported = 0;
  let skipped = 0;
  let noData = 0;
  let errors = 0;

  for (let index = 0; index < scopedLinks.length; index++) {
    const link = scopedLinks[index];
    if (index > 0) await sleep(delayMs);

    try {
      if (onlyMissing) {
        if (playersWithSeasonStats.has(link.player_id)) {
          skipped++;
          continue;
        }
      }

      const mapped = await fetchEspnPlayerStats(link.espn_url!, { season });
      if (!mapped) {
        noData++;
        console.log(`[${index + 1}/${scopedLinks.length}] ${link.player_id} -> no usable ESPN stats`);
        continue;
      }

      const row = {
        player_id: link.player_id,
        season: mapped.season,
        games_played: mapped.games_played,
        starts: mapped.starts,
        offensive_snaps: null,
        defensive_snaps: null,
        special_teams_snaps: null,
        passing_yards: mapped.passing_yards,
        rushing_yards: mapped.rushing_yards,
        receiving_yards: mapped.receiving_yards,
        total_touchdowns: mapped.total_touchdowns,
        tackles: mapped.tackles,
        sacks: mapped.sacks,
        interceptions: mapped.interceptions,
        passes_defended: mapped.passes_defended,
        passing_tds: mapped.passing_tds,
        interceptions_thrown: mapped.interceptions_thrown,
        rushing_attempts: mapped.rushing_attempts,
        rushing_tds: mapped.rushing_tds,
        receptions: mapped.receptions,
        receiving_tds: mapped.receiving_tds,
        tackles_for_loss: mapped.tackles_for_loss,
        forced_fumbles: mapped.forced_fumbles,
        source: "espn"
      };

      const { error: upsertError } = await supabase
        .from("player_stats" as never)
        .upsert(row as never, { onConflict: "player_id,season" });

      if (upsertError) {
        errors++;
        console.error(`[${index + 1}/${scopedLinks.length}] Upsert failed for ${link.player_id}:`, upsertError.message);
        continue;
      }

      imported++;
      playersWithSeasonStats.add(link.player_id);
      console.log(`[${index + 1}/${scopedLinks.length}] ${link.player_id} -> imported`);
    } catch (fetchError) {
      errors++;
      console.error(
        `[${index + 1}/${scopedLinks.length}] ESPN fetch failed for ${link.player_id}:`,
        fetchError instanceof Error ? fetchError.message : String(fetchError)
      );
    }
  }

  console.log("");
  console.log(`Done. Imported: ${imported}`);
  console.log(`Skipped existing season rows: ${skipped}`);
  console.log(`No usable data: ${noData}`);
  console.log(`Errors: ${errors}`);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
