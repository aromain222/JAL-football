/**
 * Pipeline: re-queue failed enrichment_queue entries for retry.
 *
 * Resets status from 'failed' back to 'pending' and clears last_error,
 * optionally resetting attempt counts so max_attempts applies fresh.
 *
 * Usage:  npm run pipeline:requeue-failed
 * Env:    NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *         RESET_ATTEMPTS=true   (default: false — preserves attempt count)
 */

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { createPipelineClient, getQueueStatus } from "@/lib/pipeline/queue";

const RESET_ATTEMPTS = process.env.RESET_ATTEMPTS === "true";

async function main() {
  const db = createPipelineClient();

  const before = await getQueueStatus(db);
  console.log("Queue before:", before);

  const patch: Record<string, unknown> = {
    status: "pending",
    last_error: null,
    claimed_at: null,
    claimed_by: null,
  };
  if (RESET_ATTEMPTS) patch.attempts = 0;

  const { data, error } = await db
    .from("enrichment_queue")
    .update(patch)
    .eq("status", "failed")
    .select("id");

  if (error) throw new Error(`Requeue failed: ${error.message}`);

  const count = (data ?? []).length;
  console.log(`Re-queued ${count} failed entries (reset_attempts=${RESET_ATTEMPTS})`);

  const after = await getQueueStatus(db);
  console.log("Queue after:", after);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
