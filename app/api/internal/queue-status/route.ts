/**
 * GET /api/internal/queue-status
 *
 * Returns a snapshot of the enrichment queue and recent run statistics.
 * Used for monitoring the pipeline health from the dashboard or CI.
 *
 * Auth: CRON_SECRET bearer token (same secret used by Vercel Cron).
 * Returns 200 with no auth check if CRON_SECRET is not set (dev mode).
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Missing Supabase credentials" }, { status: 500 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  }) as any;

  const [
    { data: queueRaw },
    { data: recentRuns },
    { data: recentJobs },
    { data: cursors },
    { data: playerCounts },
  ] = await Promise.all([
    db.from("enrichment_queue").select("status"),
    db.from("enrichment_runs")
      .select("step, status, ran_at")
      .order("ran_at", { ascending: false })
      .limit(100),
    db.from("enrichment_jobs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(5),
    db.from("sync_cursors").select("key, value, updated_at"),
    db.from("players").select("enrichment_status"),
  ]);

  // Queue counts by status
  const queueCounts: Record<string, number> = {
    pending: 0, claimed: 0, done: 0, failed: 0, skipped: 0,
  };
  for (const r of (queueRaw ?? []) as Array<{ status: string }>) {
    if (r.status in queueCounts) queueCounts[r.status]++;
  }

  // Recent run step breakdown (last 100 runs)
  const stepSummary: Record<string, { success: number; failed: number; skipped: number; no_data: number }> = {};
  for (const r of (recentRuns ?? []) as Array<{ step: string; status: string }>) {
    if (!stepSummary[r.step]) stepSummary[r.step] = { success: 0, failed: 0, skipped: 0, no_data: 0 };
    const s = r.status as "success" | "failed" | "skipped" | "no_data";
    if (s in stepSummary[r.step]) stepSummary[r.step][s]++;
  }

  // Player enrichment status counts
  const enrichmentCounts: Record<string, number> = { unenriched: 0, partial: 0, complete: 0 };
  for (const r of (playerCounts ?? []) as Array<{ enrichment_status: string }>) {
    if (r.enrichment_status in enrichmentCounts) enrichmentCounts[r.enrichment_status]++;
  }

  return NextResponse.json({
    as_of: new Date().toISOString(),
    queue: queueCounts,
    enrichment: enrichmentCounts,
    steps: stepSummary,
    recent_jobs: recentJobs ?? [],
    cursors: Object.fromEntries(
      ((cursors ?? []) as Array<{ key: string; value: string; updated_at: string }>)
        .map((c) => [c.key, { value: c.value, updated_at: c.updated_at }])
    ),
  });
}
