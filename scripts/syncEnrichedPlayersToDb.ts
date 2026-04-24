import {
  claimQueueBatch,
  computeRetryAt,
  createWorkerId,
  chunk,
  supabase,
  type DbPlayerInsert,
  type DbPlayerMeasurementInsert,
  type DbPlayerStatsInsert,
} from "@/scripts/lib/portal-pipeline";

const batchSize = Math.max(1, Number(process.env.PORTAL_SYNC_BATCH_SIZE) || 25);
const workerId = createWorkerId("syncEnrichedPlayersToDb");

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function main() {
  const claimed = await claimQueueBatch("sync", batchSize, workerId);

  if (!claimed.length) {
    console.log("No sync-stage queue rows available.");
    return;
  }

  let synced = 0;
  let retried = 0;
  let failed = 0;

  for (const row of claimed) {
    try {
      const normalizedPayload = asRecord(row.normalized_payload);
      const player = normalizedPayload.player as DbPlayerInsert | undefined;
      const measurement = normalizedPayload.measurement as DbPlayerMeasurementInsert | undefined;
      const statsRows = Array.isArray(normalizedPayload.stats_rows)
        ? (normalizedPayload.stats_rows as DbPlayerStatsInsert[])
        : [];

      if (!player?.id) {
        throw new Error(`Queue row ${row.id} is missing normalized player payload`);
      }

      const playerUpsert: DbPlayerInsert = {
        ...player,
        id: player.id,
        active_in_portal: row.active_in_portal,
        first_seen_at: row.first_seen_at,
        last_seen_at: row.last_seen_at,
        pff_enrichment_status: row.pff_enrichment_status,
      };

      const { error: playerError } = await supabase
        .from("players" as never)
        .upsert(playerUpsert as never, { onConflict: "id" });
      if (playerError) throw playerError;

      if (measurement?.player_id) {
        const { error: measurementError } = await supabase
          .from("player_measurements" as never)
          .upsert(measurement as never, { onConflict: "player_id" });
        if (measurementError) throw measurementError;
      }

      const statUpserts = statsRows.map((statsRow) => ({
        ...statsRow,
        player_id: player.id,
        position_group: player.position_group ?? player.position,
        stat_profile_used: row.stat_profile_used ?? statsRow.stat_profile_used ?? null,
        alignment_data:
          statsRow.season === (normalizedPayload.selected_season_year as number | null)
            ? row.alignment_data
            : statsRow.alignment_data,
        raw_stats_json: statsRow.raw_stats_json ?? row.raw_stats_json,
        pff_enrichment_status: row.pff_enrichment_status,
        active_in_portal: row.active_in_portal,
        first_seen_at: row.first_seen_at,
        last_seen_at: row.last_seen_at,
        source_player_id: row.external_player_id,
      }));

      for (const batch of chunk(statUpserts, 250)) {
        if (!batch.length) continue;
        const { error: statsError } = await supabase
          .from("player_stats" as never)
          .upsert(batch as never, { onConflict: "player_id,season" });
        if (statsError) throw statsError;
      }

      const { error: queueError } = await supabase
        .from("portal_ingestion_queue" as never)
        .update({
          status: "complete",
          pipeline_stage: "sync",
          locked_at: null,
          locked_by: null,
          error_message: null,
          completed_at: new Date().toISOString(),
        } as never)
        .eq("id", row.id);
      if (queueError) throw queueError;

      synced += 1;
    } catch (error) {
      const attemptCount = row.attempt_count + 1;
      const nextAttemptAt = computeRetryAt(attemptCount);
      const terminal = attemptCount >= row.max_attempts;

      const { error: updateError } = await supabase
        .from("portal_ingestion_queue" as never)
        .update({
          status: terminal ? "failed" : "retry",
          locked_at: null,
          locked_by: null,
          error_message: error instanceof Error ? error.message : "Unknown sync error",
          next_attempt_at: nextAttemptAt,
          completed_at: terminal ? new Date().toISOString() : null,
        } as never)
        .eq("id", row.id);

      if (updateError) {
        console.error(`Failed to update sync failure state for ${row.id}:`, updateError);
      }

      if (terminal) failed += 1;
      else retried += 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        claimed: claimed.length,
        synced,
        retried,
        failed,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
