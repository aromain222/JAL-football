import {
  claimQueueBatch,
  computeRetryAt,
  createWorkerId,
  buildNormalizedPayload,
  fetchProfileWithRetry,
  parseTimestamp,
  supabase,
} from "@/scripts/lib/portal-pipeline";

const batchSize = Math.max(1, Number(process.env.PORTAL_INGEST_BATCH_SIZE) || 25);
const workerId = createWorkerId("processIngestionQueue");

async function main() {
  const claimed = await claimQueueBatch("normalize", batchSize, workerId);

  if (!claimed.length) {
    console.log("No normalize-stage queue rows available.");
    return;
  }

  let normalized = 0;
  let retried = 0;
  let failed = 0;

  for (const row of claimed) {
    try {
      const profile = await fetchProfileWithRetry(row.external_player_id);
      const normalizedPayload = buildNormalizedPayload({ queue: row, profile });
      const rawStatsJson = profile?.seasons ?? [];
      const sourceUpdatedAt = parseTimestamp(profile?.team?.id ? row.source_updated_at : row.source_updated_at);

      const { error } = await supabase
        .from("portal_ingestion_queue" as never)
        .update({
          pipeline_stage: "enrich",
          status: "pending",
          locked_at: null,
          locked_by: null,
          started_at: row.started_at ?? new Date().toISOString(),
          completed_at: null,
          error_message: null,
          normalized_payload: normalizedPayload,
          raw_stats_json: rawStatsJson as never,
          metadata: {
            ...((row.metadata as Record<string, unknown> | null) ?? {}),
            normalized_at: new Date().toISOString(),
            normalized_season_count: Array.isArray(profile?.seasons) ? profile.seasons.length : 0,
          } as never,
          stat_profile_used: (normalizedPayload as Record<string, unknown>).stat_profile_used as string,
          source_updated_at: sourceUpdatedAt ?? row.source_updated_at,
        } as never)
        .eq("id", row.id);

      if (error) throw error;
      normalized += 1;
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
          error_message: error instanceof Error ? error.message : "Unknown normalize error",
          next_attempt_at: nextAttemptAt,
          completed_at: terminal ? new Date().toISOString() : null,
        } as never)
        .eq("id", row.id);

      if (updateError) {
        console.error(`Failed to update queue failure state for ${row.id}:`, updateError);
      }

      if (terminal) failed += 1;
      else retried += 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        claimed: claimed.length,
        normalized,
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
