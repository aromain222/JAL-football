/**
 * Pipeline queue helpers.
 *
 * All writes use the service-role client (bypasses RLS).
 * Call createPipelineClient() once per process and pass it through.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function createPipelineClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } }) as any;
}

// ── Types ────────────────────────────────────────────────────────────────────

export type QueueStatus = "pending" | "claimed" | "done" | "failed" | "skipped";
export type StepName = "espn_resolve" | "espn_stats" | "cfbd_stats" | "cfbd_school" | "pff_scrape";
export type StepStatus = "success" | "failed" | "skipped" | "no_data";

export interface QueueEntry {
  id: string;
  player_id: string;
  status: QueueStatus;
  priority: number;
  attempts: number;
  max_attempts: number;
  claimed_at: string | null;
  claimed_by: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface EnqueueOptions {
  priority?: number;       // 1 (urgent) – 10 (low), default 5
  maxAttempts?: number;    // default 3
}

// ── Enqueue ──────────────────────────────────────────────────────────────────

/**
 * Add a player to the enrichment queue.
 * No-ops if there is already a pending/claimed entry (partial unique index).
 */
export async function enqueuePlayer(
  db: SupabaseClient,
  playerId: string,
  opts: EnqueueOptions = {}
): Promise<void> {
  await db.from("enrichment_queue").insert({
    player_id: playerId,
    status: "pending",
    priority: opts.priority ?? 5,
    max_attempts: opts.maxAttempts ?? 3,
  });
  // ignore duplicate-index error (player already queued)
}

/**
 * Enqueue many players; skips already-queued players in bulk.
 */
export async function enqueuePlayers(
  db: SupabaseClient,
  playerIds: string[],
  opts: EnqueueOptions = {}
): Promise<number> {
  if (playerIds.length === 0) return 0;
  const rows = playerIds.map((id) => ({
    player_id: id,
    status: "pending",
    priority: opts.priority ?? 5,
    max_attempts: opts.maxAttempts ?? 3,
  }));
  const { error } = await db
    .from("enrichment_queue")
    .insert(rows);
  // Partial inserts on conflict are not guaranteed — count rows where insert succeeded
  if (error?.code === "23505") return 0; // all were duplicate
  if (error) throw new Error(`enqueuePlayers: ${error.message}`);
  return playerIds.length;
}

// ── Claim ────────────────────────────────────────────────────────────────────

/**
 * Atomically claim up to `batchSize` pending entries.
 * Uses FOR UPDATE SKIP LOCKED — safe for concurrent workers.
 */
export async function claimBatch(
  db: SupabaseClient,
  batchSize: number,
  workerId: string
): Promise<QueueEntry[]> {
  const { data, error } = await db.rpc("claim_enrichment_batch", {
    p_batch_size: batchSize,
    p_worker_id: workerId,
  });
  if (error) throw new Error(`claimBatch: ${error.message}`);
  return (data ?? []) as QueueEntry[];
}

// ── Completion ────────────────────────────────────────────────────────────────

export async function markDone(db: SupabaseClient, entryId: string): Promise<void> {
  const { error } = await db
    .from("enrichment_queue")
    .update({ status: "done" })
    .eq("id", entryId);
  if (error) throw new Error(`markDone: ${error.message}`);
}

export async function markFailed(
  db: SupabaseClient,
  entryId: string,
  errorMsg: string
): Promise<void> {
  const { data: entry } = await db
    .from("enrichment_queue")
    .select("attempts, max_attempts")
    .eq("id", entryId)
    .single();

  const exhausted = entry ? entry.attempts >= entry.max_attempts : true;
  const { error } = await db
    .from("enrichment_queue")
    .update({
      status: exhausted ? "failed" : "pending",
      last_error: errorMsg,
    })
    .eq("id", entryId);
  if (error) throw new Error(`markFailed: ${error.message}`);
}

export async function markSkipped(db: SupabaseClient, entryId: string): Promise<void> {
  const { error } = await db
    .from("enrichment_queue")
    .update({ status: "skipped" })
    .eq("id", entryId);
  if (error) throw new Error(`markSkipped: ${error.message}`);
}

// ── Step logging ──────────────────────────────────────────────────────────────

export async function logStep(
  db: SupabaseClient,
  opts: {
    queueEntryId: string | null;
    playerId: string;
    step: StepName;
    status: StepStatus;
    durationMs?: number;
    errorMessage?: string;
    resultSummary?: Record<string, unknown>;
  }
): Promise<void> {
  await db.from("enrichment_runs").insert({
    queue_entry_id: opts.queueEntryId,
    player_id: opts.playerId,
    step: opts.step,
    status: opts.status,
    duration_ms: opts.durationMs ?? null,
    error_message: opts.errorMessage ?? null,
    result_summary: opts.resultSummary ?? null,
  });
}

// ── Queue status ───────────────────────────────────────────────────────────────

export interface QueueStatusSummary {
  pending: number;
  claimed: number;
  done: number;
  failed: number;
  skipped: number;
}

export async function getQueueStatus(db: SupabaseClient): Promise<QueueStatusSummary> {
  const { data, error } = await db
    .from("enrichment_queue")
    .select("status");
  if (error) throw new Error(`getQueueStatus: ${error.message}`);
  const rows = (data ?? []) as Array<{ status: string }>;
  const counts: QueueStatusSummary = { pending: 0, claimed: 0, done: 0, failed: 0, skipped: 0 };
  for (const r of rows) {
    const s = r.status as QueueStatus;
    if (s in counts) counts[s]++;
  }
  return counts;
}

// ── Sync cursors ──────────────────────────────────────────────────────────────

export async function getCursor(db: SupabaseClient, key: string): Promise<string | null> {
  const { data } = await db.from("sync_cursors").select("value").eq("key", key).single();
  return data?.value ?? null;
}

export async function setCursor(db: SupabaseClient, key: string, value: string): Promise<void> {
  await db
    .from("sync_cursors")
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
}
