/**
 * Pipeline: sync new transfer portal entries from Sportradar + enqueue for enrichment.
 *
 * Detects new players (not yet in DB) and status changes, logs portal events,
 * and enqueues new players for downstream enrichment.
 *
 * Usage:  npm run pipeline:sync-portal
 * Env:    SPORTRADAR_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *         SPORTRADAR_ACCESS_LEVEL=trial|production  (default: trial)
 *         TRANSFER_YEAR=2026                        (default: current year)
 */

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import {
  fetchTransferPortal,
  mapSportradarPosition,
  parseBirthPlace,
  eligibilityRemaining,
} from "@/lib/sportradar/transfer-portal";
import {
  createPipelineClient,
  enqueuePlayers,
  setCursor,
  getCursor,
} from "@/lib/pipeline/queue";

const apiKey = process.env.SPORTRADAR_API_KEY ?? process.env.SPORTS_RADAR_API_KEY;
const accessLevel =
  (process.env.SPORTRADAR_ACCESS_LEVEL as "trial" | "production") || "trial";
const transferYear = Number(process.env.TRANSFER_YEAR) || new Date().getFullYear();

if (!apiKey) {
  console.error("Missing SPORTRADAR_API_KEY");
  process.exit(1);
}

async function main() {
  const db = createPipelineClient();

  console.log("Fetching Sportradar transfer portal...");
  const data = await fetchTransferPortal({ apiKey: apiKey!, accessLevel });
  const apiPlayers = data.league.transfer_portal_players;
  console.log(`API returned ${apiPlayers.length} players.`);

  // Fetch existing sportradar_id → player.id mapping
  const { data: existing } = await db
    .from("players")
    .select("id, sportradar_id, status")
    .in(
      "sportradar_id",
      apiPlayers.map((p: { id: string }) => p.id)
    );

  const existingMap = new Map<string, { id: string; status: string }>(
    ((existing ?? []) as Array<{ id: string; sportradar_id: string | null; status: string }>)
      .filter((r) => r.sportradar_id)
      .map((r) => [r.sportradar_id!, { id: r.id, status: r.status }])
  );

  const playerRows: Array<Record<string, unknown>> = [];
  const measurementRows: Array<Record<string, unknown>> = [];
  const newPlayerIds: string[] = [];
  const portalEvents: Array<Record<string, unknown>> = [];

  for (const p of apiPlayers) {
    const { hometown, state } = parseBirthPlace(p.birth_place);
    const existing = existingMap.get(p.id);
    const isNew = !existing;
    const ourId = existing?.id ?? crypto.randomUUID();

    if (isNew) newPlayerIds.push(ourId);

    playerRows.push({
      id: ourId,
      first_name: p.first_name,
      last_name: p.last_name,
      position: mapSportradarPosition(p.position),
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
      sportradar_id: p.id,
      portal_entered_at: isNew ? new Date().toISOString() : undefined,
    });

    if (p.height > 0 && p.weight > 0) {
      measurementRows.push({
        player_id: ourId,
        height_in: p.height,
        weight_lbs: Math.round(p.weight),
        arm_length_in: null,
        forty_time: null,
        shuttle_time: null,
        vertical_jump: null,
        wing_span_in: null,
        verified_at: null,
      });
    }

    if (isNew) {
      portalEvents.push({
        player_id: ourId,
        sportradar_id: p.id,
        event_type: "entered",
        old_status: null,
        new_status: "Portal",
        source: "sportradar",
        raw_payload: p as unknown as Record<string, unknown>,
      });
    }
  }

  // Upsert players
  const { error: upsertErr } = await db
    .from("players")
    .upsert(playerRows, { onConflict: "sportradar_id" });
  if (upsertErr) throw new Error(`Player upsert failed: ${upsertErr.message}`);

  // Upsert measurements
  let measurementsUpserted = 0;
  if (measurementRows.length > 0) {
    const { error: measErr } = await db
      .from("player_measurements")
      .upsert(measurementRows, { onConflict: "player_id" });
    if (!measErr) measurementsUpserted = measurementRows.length;
  }

  // Log portal events
  if (portalEvents.length > 0) {
    await db.from("player_portal_events").insert(portalEvents);
  }

  // Enqueue new players for enrichment
  let enqueued = 0;
  if (newPlayerIds.length > 0) {
    enqueued = await enqueuePlayers(db, newPlayerIds, { priority: 3 });
  }

  // Update cursor
  await setCursor(db, "sportradar_portal_last_sync", new Date().toISOString());

  const lastSync = await getCursor(db, "sportradar_portal_last_sync");
  console.log(`Sync complete. last_cursor=${lastSync}`);
  console.log({
    total_from_api: apiPlayers.length,
    new_players: newPlayerIds.length,
    upserted: playerRows.length,
    measurements: measurementsUpserted,
    portal_events: portalEvents.length,
    enqueued,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
