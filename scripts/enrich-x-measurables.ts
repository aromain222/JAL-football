import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { enrichPlayerFromX } from "@/lib/x/enrich";

type PlayerRow = Pick<
  Database["public"]["Tables"]["players"]["Row"],
  "id" | "first_name" | "last_name" | "current_school" | "previous_school" | "x_handle"
>;

type MeasurementUpsert = Database["public"]["Tables"]["player_measurements"]["Insert"];
type XEnrichmentUpsert = Database["public"]["Tables"]["player_x_enrichments"]["Insert"];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bearerToken = process.env.BEARER_API_KEY;
const delayMs = Number(process.env.X_ENRICH_DELAY_MS ?? "1500");
const limit = Number(process.env.X_ENRICH_LIMIT ?? "0");

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

if (!bearerToken) {
  console.error("Missing BEARER_API_KEY");
  process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  const { data: existingMeasurements, error: existingMeasurementsError } = await supabase
    .from("player_measurements")
    .select("*");

  if (existingMeasurementsError) {
    console.error("Fetch player_measurements error:", existingMeasurementsError);
    process.exit(1);
  }

  const existingMeasurementsByPlayerId = new Map(
    (existingMeasurements ?? []).map((row) => [row.player_id, row])
  );

  const { data: players, error } = await supabase
    .from("players")
    .select("id, first_name, last_name, current_school, previous_school, x_handle")
    .order("last_name");

  if (error) {
    console.error("Fetch players error:", error);
    process.exit(1);
  }

  const scopedPlayers = (players ?? []).slice(0, limit > 0 ? limit : undefined);

  console.log(`X enrich run for ${scopedPlayers.length} players...`);

  let enriched = 0;
  let withSources = 0;
  let measurablesUpdated = 0;
  let errors = 0;

  for (let index = 0; index < scopedPlayers.length; index++) {
    const player = scopedPlayers[index];
    if (index > 0) {
      await sleep(delayMs);
    }

    const fullName = `${player.first_name} ${player.last_name}`.trim();
    const school = deriveSearchSchool(player);

    if (!school) {
      console.log(`Skipping ${fullName}: no usable school for query.`);
      continue;
    }

    try {
      const result = await enrichPlayerFromX({
        bearerToken,
        name: fullName,
        school,
        ...(player.x_handle ? { handle: player.x_handle } : {})
      });

      const xHandle = player.x_handle ?? null;
      const xUserId = extractUserIdFromSources(result.sources);

      const xUpsert: XEnrichmentUpsert = {
        player_id: player.id,
        x_handle: xHandle,
        x_user_id: xUserId,
        measurables: result.measurables,
        track: result.track,
        offers: result.offers,
        sources: result.sources
      };

      const { error: xError } = await supabase
        .from("player_x_enrichments")
        .upsert(xUpsert, { onConflict: "player_id" });

      if (xError) {
        errors++;
        console.error(`X upsert error for ${fullName}:`, xError.message);
        continue;
      }

      enriched++;

      if (result.sources.length > 0) {
        withSources++;
      }

      const measurementUpdate = buildMeasurementUpsert(
        player.id,
        result.measurables,
        existingMeasurementsByPlayerId.get(player.id) ?? null
      );
      if (measurementUpdate) {
        const { error: measurementError } = await supabase
          .from("player_measurements")
          .upsert(measurementUpdate, { onConflict: "player_id" });

        if (measurementError) {
          errors++;
          console.error(`Measurement upsert error for ${fullName}:`, measurementError.message);
        } else {
          measurablesUpdated++;
        }
      }

      console.log(
        `[${index + 1}/${scopedPlayers.length}] ${fullName} | sources=${result.sources.length} offers=${result.offers.length}`
      );
    } catch (runError) {
      errors++;
      console.error(`X enrich error for ${fullName}:`, runError);
    }
  }

  console.log("");
  console.log(`Done. Enriched rows: ${enriched}`);
  console.log(`Rows with usable sources: ${withSources}`);
  console.log(`Measurement rows updated: ${measurablesUpdated}`);
  console.log(`Errors: ${errors}`);
}

function deriveSearchSchool(player: PlayerRow) {
  const previousSchool = player.previous_school?.trim();
  if (previousSchool) return previousSchool;

  const currentSchool = player.current_school?.trim();
  if (!currentSchool || currentSchool.toLowerCase() === "transfer portal") return null;
  return currentSchool;
}

function buildMeasurementUpsert(
  playerId: string,
  measurables: Awaited<ReturnType<typeof enrichPlayerFromX>>["measurables"],
  current: Database["public"]["Tables"]["player_measurements"]["Row"] | null
): MeasurementUpsert | null {
  const forty = parseNumeric(measurables.forty_time);
  const arm = parseNumeric(measurables.arm_length);

  if (forty === null && arm === null) return null;

  return {
    player_id: playerId,
    height_in: current?.height_in ?? null,
    weight_lbs: current?.weight_lbs ?? null,
    arm_length_in: arm ?? current?.arm_length_in ?? null,
    forty_time: forty ?? current?.forty_time ?? null,
    shuttle_time: current?.shuttle_time ?? null,
    vertical_jump: current?.vertical_jump ?? null,
    wing_span_in: current?.wing_span_in ?? null,
    verified_at: current?.verified_at ?? null
  };
}

function parseNumeric(value: string | null) {
  if (!value) return null;
  const parsed = Number(value.replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function extractHandleFromSources(sources: Array<{ id: string }>) {
  return null;
}

function extractUserIdFromSources(sources: Array<{ id: string }>) {
  const bioSource = sources.find((source) => source.id.startsWith("bio:"));
  return bioSource ? bioSource.id.replace("bio:", "") : null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
