/**
 * Sync players from Sportradar NCAA Football Transfer Portal API into Supabase.
 *
 * Prereqs:
 *   - .env or .env.local: SPORTRADAR_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   - Optional: SPORTRADAR_ACCESS_LEVEL=trial|production (default: trial)
 *   - Optional: TRANSFER_YEAR=2026 (default: current year)
 *
 * Run: npm run sync:portal
 *
 * The API does not include current_school or previous_school; we set current_school
 * to "Transfer Portal" as a placeholder. Staff can update schools manually or via
 * other data sources.
 */

import { config } from "dotenv";

// Load .env.local first (Next.js convention), then .env — scripts don't get these automatically
config({ path: ".env.local" });
config({ path: ".env" });

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import {
  fetchTransferPortal,
  mapSportradarPosition,
  parseBirthPlace,
  eligibilityRemaining
} from "@/lib/sportradar/transfer-portal";

type PlayerInsert = Database["public"]["Tables"]["players"]["Insert"];
type MeasurementInsert = Database["public"]["Tables"]["player_measurements"]["Insert"];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const apiKey = process.env.SPORTRADAR_API_KEY ?? process.env.SPORTS_RADAR_API_KEY;
const accessLevel = (process.env.SPORTRADAR_ACCESS_LEVEL as "trial" | "production") || "trial";
const transferYear = Number(process.env.TRANSFER_YEAR) || new Date().getFullYear();

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!apiKey) {
  console.error(
    "Missing SPORTRADAR_API_KEY (or SPORTS_RADAR_API_KEY). Get a key at https://developer.sportradar.com/"
  );
  process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, serviceRoleKey);

async function main() {
  console.log("Fetching Sportradar transfer portal...");
  const data = await fetchTransferPortal({ apiKey, accessLevel });
  const apiPlayers = data.league.transfer_portal_players;
  console.log(`API returned ${apiPlayers.length} players.`);

  if (apiPlayers.length === 0) {
    console.log("Nothing to sync.");
    return;
  }

  const sportradarIds = apiPlayers.map((p) => p.id);
  const { data: existing } = await supabase
    .from("players")
    .select("id, sportradar_id")
    .in("sportradar_id", sportradarIds);
  const idBySportradarId = new Map<string, string>();
  for (const row of existing ?? []) {
    if (row.sportradar_id) idBySportradarId.set(row.sportradar_id, row.id);
  }

  const players: PlayerInsert[] = [];
  const measurements: MeasurementInsert[] = [];

  for (const p of apiPlayers) {
    const { hometown, state } = parseBirthPlace(p.birth_place);
    const position = mapSportradarPosition(p.position);
    const ourId = idBySportradarId.get(p.id) ?? crypto.randomUUID();

    players.push({
      id: ourId,
      first_name: p.first_name,
      last_name: p.last_name,
      position,
      transfer_year: transferYear,
      current_school: "Transfer Portal",
      conference: null,
      previous_school: null,
      hometown,
      state,
      class_year: p.eligibility ?? "JR",
      eligibility_remaining: eligibilityRemaining(p.eligibility),
      stars: null,
      academic_status: null,
      status: "Portal",
      film_url: null,
      photo_url: null,
      x_handle: null,
      x_user_id: null,
      contact_window: null,
      notes: null,
      sportradar_id: p.id
    });

    if (p.height != null && p.height > 0 && p.weight != null && p.weight > 0) {
      measurements.push({
        player_id: ourId,
        height_in: p.height,
        weight_lbs: Math.round(p.weight),
        arm_length_in: null,
        forty_time: null,
        shuttle_time: null,
        vertical_jump: null,
        wing_span_in: null,
        verified_at: null
      });
    }
  }

  const { error: upsertError } = await supabase
    .from("players")
    .upsert(players, { onConflict: "sportradar_id" });

  if (upsertError) {
    console.error("Players upsert error:", upsertError);
    process.exit(1);
  }
  console.log(`Upserted ${players.length} players.`);

  if (measurements.length > 0) {
    const { error: measError } = await supabase
      .from("player_measurements")
      .upsert(measurements, { onConflict: "player_id" });
    if (measError) {
      console.error("Measurements upsert error:", measError);
    } else {
      console.log(`Upserted ${measurements.length} measurement rows.`);
    }
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
