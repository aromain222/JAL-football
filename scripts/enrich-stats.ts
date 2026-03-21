/**
 * Enrich players with seasonal stats (and height/weight) from Sportradar Player Profile API.
 * Uses sportradar_id to fetch each player's profile; maps games_played, starts, passing/rushing/
 * receiving yards, total_touchdowns, tackles, sacks, interceptions, passes_defended into
 * player_stats, and height/weight into player_measurements.
 *
 * Arm length / wing span are NOT in the NCAA API; they would require combine or pro day data elsewhere.
 *
 * Trial API limit: strict (often 1 req/2–3 sec or daily cap). Script throttles and retries on 429.
 *
 * Run: npm run enrich:stats
 * Optional: ENRICH_STATS_DELAY_MS=2500 (default trial 2500, production 500)
 */

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import {
  fetchPlayerProfile,
  mapProfileStatsToOurSchema
} from "@/lib/sportradar/player-profile";

type MeasurementInsert = Database["public"]["Tables"]["player_measurements"]["Insert"];
type StatInsert = Database["public"]["Tables"]["player_stats"]["Insert"];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const apiKey = process.env.SPORTRADAR_API_KEY ?? process.env.SPORTS_RADAR_API_KEY;
const accessLevel = (process.env.SPORTRADAR_ACCESS_LEVEL as "trial" | "production") || "trial";
const baseUrl = process.env.SPORTRADAR_BASE_URL;
const delayMs =
  process.env.ENRICH_STATS_DELAY_MS != null
    ? parseInt(process.env.ENRICH_STATS_DELAY_MS, 10)
    : accessLevel === "trial"
      ? 60_000
      : 500;
const RETRY_AFTER_429_MS = 90_000;
const INITIAL_COOLDOWN_MS = 60_000;
const RETRY_AFTER_NETWORK_MS = 15_000;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!apiKey) {
  console.error("Missing SPORTRADAR_API_KEY (or SPORTS_RADAR_API_KEY)");
  process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, serviceRoleKey);

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchProfileWithRetry(srId: string): Promise<Awaited<ReturnType<typeof fetchPlayerProfile>>> {
  try {
    return await fetchPlayerProfile(srId, { apiKey, accessLevel, ...(baseUrl ? { baseUrl } : {}) });
  } catch (err) {
    const is429 =
      err instanceof Error && err.message.includes("429");
    if (is429) {
      console.warn(`  429 rate limit — waiting ${RETRY_AFTER_429_MS / 1000}s before retry...`);
      await sleep(RETRY_AFTER_429_MS);
      return fetchPlayerProfile(srId, { apiKey, accessLevel, ...(baseUrl ? { baseUrl } : {}) });
    }
    const isNetwork =
      err instanceof Error &&
      (err.message.includes("ENOTFOUND") ||
        err.message.includes("EAI_AGAIN") ||
        err.message.includes("ECONNRESET") ||
        err.message.includes("ETIMEDOUT") ||
        err.message.includes("fetch failed"));
    if (isNetwork) {
      console.warn(`  Network/DNS error — waiting ${RETRY_AFTER_NETWORK_MS / 1000}s then retry...`);
      await sleep(RETRY_AFTER_NETWORK_MS);
      return fetchPlayerProfile(srId, { apiKey, accessLevel, ...(baseUrl ? { baseUrl } : {}) });
    }
    throw err;
  }
}

async function main() {
  const { data: players, error: fetchError } = await supabase
    .from("players")
    .select("id, sportradar_id")
    .not("sportradar_id", "is", null);

  if (fetchError) {
    console.error("Fetch players error:", fetchError);
    process.exit(1);
  }
  if (!players?.length) {
    console.log("No players with sportradar_id to enrich.");
    return;
  }

  console.log(`Enriching stats for ${players.length} players (throttle ${delayMs}ms per request, retry on 429)...`);
  if (INITIAL_COOLDOWN_MS > 0) {
    console.log(`  Initial cooldown ${INITIAL_COOLDOWN_MS / 1000}s (avoid 429 on first request)...`);
    await sleep(INITIAL_COOLDOWN_MS);
  }
  let measurementsUpserted = 0;
  let statsUpserted = 0;
  let errors = 0;

  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    const srId = p.sportradar_id!;
    if (i > 0) await sleep(delayMs);

    try {
      const profile = await fetchProfileWithRetry(srId);
      if (!profile) {
        continue;
      }

      if (profile.height != null && profile.height > 0 && profile.weight != null && profile.weight > 0) {
        const meas: MeasurementInsert = {
          player_id: p.id,
          height_in: profile.height,
          weight_lbs: Math.round(profile.weight),
          arm_length_in: null,
          forty_time: null,
          shuttle_time: null,
          vertical_jump: null,
          wing_span_in: null,
          verified_at: null
        };
        const { error: me } = await supabase
          .from("player_measurements")
          .upsert(meas, { onConflict: "player_id" });
        if (!me) measurementsUpserted++;
      }

      if (profile.seasons?.length) {
        const toUpsert: StatInsert[] = [];
        for (const season of profile.seasons) {
          const team = season.teams?.[0];
          if (!team) continue;
          const mapped = mapProfileStatsToOurSchema(team.statistics, season.year);
          toUpsert.push({
            player_id: p.id,
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
            passes_defended: mapped.passes_defended
          });
        }
        if (toUpsert.length > 0) {
          const { error: se } = await supabase
            .from("player_stats")
            .upsert(toUpsert, { onConflict: "player_id,season" });
          if (!se) statsUpserted += toUpsert.length;
        }
      }
    } catch (err) {
      errors++;
      console.error(`Error for sportradar_id ${srId}:`, err);
    }

    if ((i + 1) % 50 === 0) {
      console.log(`  ... ${i + 1}/${players.length}`);
    }
  }

  console.log(`Done. Measurements upserted: ${measurementsUpserted}, stats rows: ${statsUpserted}, errors: ${errors}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
