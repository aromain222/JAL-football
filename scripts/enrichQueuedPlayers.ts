import {
  buildAlignmentDataFromPffRow,
  claimQueueBatch,
  computeRetryAt,
  createWorkerId,
  supabase,
} from "@/scripts/lib/portal-pipeline";

const batchSize = Math.max(1, Number(process.env.PORTAL_ENRICH_BATCH_SIZE) || 25);
const workerId = createWorkerId("enrichQueuedPlayers");

async function findPffRecord(queueRow: { player_id: string | null; position_group: string | null; transfer_year: number }, playerName: string | null) {
  const targetSeason = queueRow.transfer_year - 1;

  if (queueRow.player_id) {
    const { data: byId, error: byIdError } = await supabase
      .from("player_pff_grades" as never)
      .select("*")
      .eq("player_id", queueRow.player_id)
      .eq("season", targetSeason)
      .limit(1);

    if (byIdError) throw byIdError;
    if (Array.isArray(byId) && byId.length) return byId[0] as Record<string, unknown>;
  }

  if (!playerName) return null;

  const { data: byName, error: byNameError } = await supabase
    .from("player_pff_grades" as never)
    .select("*")
    .eq("player_name", playerName)
    .eq("season", targetSeason)
    .limit(5);

  if (byNameError) throw byNameError;
  if (!Array.isArray(byName) || !byName.length) return null;

  return (
    byName.find((row) => {
      const candidate = row as Record<string, unknown>;
      return queueRow.position_group ? candidate.position === queueRow.position_group : true;
    }) ?? (byName[0] as Record<string, unknown>)
  );
}

async function main() {
  const claimed = await claimQueueBatch("enrich", batchSize, workerId);

  if (!claimed.length) {
    console.log("No enrich-stage queue rows available.");
    return;
  }

  let enriched = 0;
  let notFound = 0;
  let retried = 0;
  let failed = 0;

  for (const row of claimed) {
    try {
      const normalizedPayload = (row.normalized_payload ?? {}) as Record<string, unknown>;
      const playerPayload = ((normalizedPayload.player as Record<string, unknown> | undefined) ?? {}) as Record<
        string,
        unknown
      >;
      const playerName = [playerPayload.first_name, playerPayload.last_name].filter(Boolean).join(" ").trim() || null;

      const pffRecord = await findPffRecord(row, playerName);
      const pffStatus = pffRecord ? "completed" : "not_found";
      const alignmentData = pffRecord ? buildAlignmentDataFromPffRow(pffRecord) : {};

      const { error } = await supabase
        .from("portal_ingestion_queue" as never)
        .update({
          pipeline_stage: "sync",
          status: "pending",
          locked_at: null,
          locked_by: null,
          error_message: null,
          pff_enrichment_status: pffStatus,
          alignment_data: alignmentData as never,
          enrichment_payload: {
            pff_record: pffRecord,
            enriched_at: new Date().toISOString(),
          } as never,
          normalized_payload: {
            ...normalizedPayload,
            player: {
              ...playerPayload,
              pff_enrichment_status: pffStatus,
            },
          } as never,
        } as never)
        .eq("id", row.id);

      if (error) throw error;
      enriched += 1;
      if (!pffRecord) notFound += 1;
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
          error_message: error instanceof Error ? error.message : "Unknown enrich error",
          next_attempt_at: nextAttemptAt,
          pff_enrichment_status: terminal ? "failed" : "in_progress",
          completed_at: terminal ? new Date().toISOString() : null,
        } as never)
        .eq("id", row.id);

      if (updateError) {
        console.error(`Failed to update enrichment failure state for ${row.id}:`, updateError);
      }

      if (terminal) failed += 1;
      else retried += 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        claimed: claimed.length,
        enriched,
        not_found: notFound,
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
