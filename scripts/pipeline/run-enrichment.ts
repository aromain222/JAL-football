/**
 * Pipeline: consume enrichment_queue entries and enrich via ESPN + CFBD.
 *
 * For each claimed player:
 *   1. espn_resolve  — search ESPN for a profile URL (if missing)
 *   2. espn_stats    — fetch season stats from ESPN (if URL found)
 *   3. cfbd_school   — fill previous_school / destination_school via CFBD
 *
 * Safe to run concurrently — uses claim_enrichment_batch() with SKIP LOCKED.
 *
 * Usage:  npm run pipeline:enrich
 * Env:    NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *         CFBD_API_KEY
 *         WORKER_ID=worker-1   (optional, for multi-worker runs)
 *         BATCH_SIZE=10        (optional)
 */

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { fetchEspnPlayerStats } from "@/lib/espn/player-stats";
import { fetchCfbdTransferPortal, type CfbdClientConfig } from "@/lib/cfbd/player-season-stats";
import {
  createPipelineClient,
  claimBatch,
  markDone,
  markFailed,
  logStep,
  type QueueEntry,
} from "@/lib/pipeline/queue";
import type { SupabaseClient } from "@supabase/supabase-js";

// ── Config ───────────────────────────────────────────────────────────────────

const WORKER_ID = process.env.WORKER_ID ?? `worker-${Date.now()}`;
const BATCH_SIZE = Number(process.env.BATCH_SIZE) || 10;
const ESPN_DELAY_MS = 700;
const ESPN_MIN_SCORE = 0.7;
const ESPN_STATS_SEASON = 2025;
const CFBD_KEY = process.env.CFBD_API_KEY;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv|v)\b\.?/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSim(a: string, b: string): number {
  const ta = new Set(norm(a).split(" ").filter(Boolean));
  const tb = new Set(norm(b).split(" ").filter(Boolean));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const union = ta.size + tb.size - inter;
  return union ? inter / union : 0;
}

// ── ESPN search helper ────────────────────────────────────────────────────────

async function searchEspn(name: string): Promise<
  Array<{ id: string; displayName: string; team?: string; position?: string }>
> {
  const url =
    `https://site.api.espn.com/apis/common/v3/search` +
    `?query=${encodeURIComponent(name)}&limit=10&type=athletes&sport=football&league=college-football`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      results?: Array<{
        athlete?: {
          id?: string;
          displayName?: string;
          team?: { displayName?: string };
          position?: { abbreviation?: string };
        };
      }>;
    };
    return (data.results ?? []).flatMap((r) => {
      const a = r.athlete;
      if (!a?.id || !a?.displayName) return [];
      return [
        {
          id: a.id,
          displayName: a.displayName,
          team: a.team?.displayName,
          position: a.position?.abbreviation,
        },
      ];
    });
  } catch {
    return [];
  }
}

// ── Per-player enrichment steps ───────────────────────────────────────────────

interface PlayerRow {
  id: string;
  first_name: string;
  last_name: string;
  position: string | null;
  previous_school: string | null;
}

async function stepEspnResolve(
  db: SupabaseClient,
  entry: QueueEntry,
  player: PlayerRow
): Promise<string | null> {
  const t0 = Date.now();

  // Check if already resolved
  const { data: existing } = await db
    .from("player_identity_links")
    .select("espn_url")
    .eq("player_id", player.id)
    .single();
  if (existing?.espn_url) {
    await logStep(db, {
      queueEntryId: entry.id,
      playerId: player.id,
      step: "espn_resolve",
      status: "skipped",
      durationMs: Date.now() - t0,
      resultSummary: { reason: "already_resolved" },
    });
    return existing.espn_url;
  }

  const name = `${player.first_name} ${player.last_name}`;
  await sleep(ESPN_DELAY_MS);
  const hits = await searchEspn(name);

  if (!hits.length) {
    await logStep(db, {
      queueEntryId: entry.id,
      playerId: player.id,
      step: "espn_resolve",
      status: "no_data",
      durationMs: Date.now() - t0,
      resultSummary: { reason: "no_hits" },
    });
    return null;
  }

  let best: (typeof hits[0] & { score: number }) | null = null;
  for (const hit of hits) {
    let score = tokenSim(name, hit.displayName);
    if (player.previous_school && hit.team) {
      if (tokenSim(player.previous_school, hit.team) >= 0.6) score += 0.15;
    }
    if (!best || score > best.score) best = { ...hit, score };
  }

  if (!best || best.score < ESPN_MIN_SCORE) {
    await logStep(db, {
      queueEntryId: entry.id,
      playerId: player.id,
      step: "espn_resolve",
      status: "no_data",
      durationMs: Date.now() - t0,
      resultSummary: { best_score: best?.score, reason: "below_threshold" },
    });
    return null;
  }

  const espnUrl = `https://www.espn.com/college-football/player/_/id/${best.id}/${norm(best.displayName).replace(/\s+/g, "-")}`;
  const { error } = await db.from("player_identity_links").upsert(
    {
      player_id: player.id,
      espn_url: espnUrl,
      roster_url: null,
      source: "espn",
      confidence: best.score,
      matched_team: best.team ?? null,
      notes: `ESPN search: ${best.displayName}`,
      last_checked_at: new Date().toISOString(),
    },
    { onConflict: "player_id" }
  );

  await logStep(db, {
    queueEntryId: entry.id,
    playerId: player.id,
    step: "espn_resolve",
    status: error ? "failed" : "success",
    durationMs: Date.now() - t0,
    errorMessage: error?.message,
    resultSummary: { espn_url: espnUrl, score: best.score },
  });

  return error ? null : espnUrl;
}

async function stepEspnStats(
  db: SupabaseClient,
  entry: QueueEntry,
  player: PlayerRow,
  espnUrl: string | null
): Promise<void> {
  const t0 = Date.now();
  if (!espnUrl) {
    await logStep(db, {
      queueEntryId: entry.id,
      playerId: player.id,
      step: "espn_stats",
      status: "skipped",
      durationMs: 0,
      resultSummary: { reason: "no_espn_url" },
    });
    return;
  }

  // Check if stats already present for season
  const { data: existing } = await db
    .from("player_stats")
    .select("player_id")
    .eq("player_id", player.id)
    .eq("season", ESPN_STATS_SEASON)
    .single();
  if (existing) {
    await logStep(db, {
      queueEntryId: entry.id,
      playerId: player.id,
      step: "espn_stats",
      status: "skipped",
      durationMs: Date.now() - t0,
      resultSummary: { reason: "stats_already_present" },
    });
    return;
  }

  await sleep(ESPN_DELAY_MS);
  try {
    const mapped = await fetchEspnPlayerStats(espnUrl, { season: ESPN_STATS_SEASON });
    if (!mapped) {
      await logStep(db, {
        queueEntryId: entry.id,
        playerId: player.id,
        step: "espn_stats",
        status: "no_data",
        durationMs: Date.now() - t0,
      });
      return;
    }

    const { error } = await db.from("player_stats").upsert(
      {
        player_id: player.id,
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
        passes_defended: mapped.passes_defended,
        passing_tds: mapped.passing_tds,
        interceptions_thrown: mapped.interceptions_thrown,
        rushing_attempts: mapped.rushing_attempts,
        rushing_tds: mapped.rushing_tds,
        receptions: mapped.receptions,
        receiving_tds: mapped.receiving_tds,
        tackles_for_loss: mapped.tackles_for_loss,
        forced_fumbles: mapped.forced_fumbles,
        source: "espn",
      },
      { onConflict: "player_id,season" }
    );

    await logStep(db, {
      queueEntryId: entry.id,
      playerId: player.id,
      step: "espn_stats",
      status: error ? "failed" : "success",
      durationMs: Date.now() - t0,
      errorMessage: error?.message,
      resultSummary: { season: mapped.season, games_played: mapped.games_played },
    });
  } catch (err) {
    await logStep(db, {
      queueEntryId: entry.id,
      playerId: player.id,
      step: "espn_stats",
      status: "failed",
      durationMs: Date.now() - t0,
      errorMessage: String(err),
    });
  }
}

async function stepCfbdSchool(
  db: SupabaseClient,
  entry: QueueEntry,
  player: PlayerRow,
  cfbdPortal: Array<{
    firstName: string;
    lastName: string;
    position: string;
    origin: string;
    destination: string | null;
    stars: number | null;
  }>
): Promise<void> {
  const t0 = Date.now();
  const normName = (f: string, l: string) =>
    norm(`${f} ${l}`);

  const key = normName(player.first_name, player.last_name);
  const candidates = cfbdPortal.filter(
    (r) => normName(r.firstName, r.lastName) === key
  );

  if (!candidates.length) {
    await logStep(db, {
      queueEntryId: entry.id,
      playerId: player.id,
      step: "cfbd_school",
      status: "no_data",
      durationMs: Date.now() - t0,
    });
    return;
  }

  const pos = (player.position ?? "").toLowerCase();
  const picked =
    candidates.find((c) => c.position?.toLowerCase() === pos) ?? candidates[0];

  const { data: current } = await db
    .from("players")
    .select("previous_school, current_school, stars")
    .eq("id", player.id)
    .single();

  const patch: Record<string, unknown> = {};
  if (!current?.previous_school && picked.origin) patch.previous_school = picked.origin;
  if (current?.current_school === "Transfer Portal" && picked.destination)
    patch.current_school = picked.destination;
  if (current?.stars == null && picked.stars != null) patch.stars = picked.stars;

  if (!Object.keys(patch).length) {
    await logStep(db, {
      queueEntryId: entry.id,
      playerId: player.id,
      step: "cfbd_school",
      status: "skipped",
      durationMs: Date.now() - t0,
      resultSummary: { reason: "nothing_to_patch" },
    });
    return;
  }

  const { error } = await db.from("players").update(patch).eq("id", player.id);
  await logStep(db, {
    queueEntryId: entry.id,
    playerId: player.id,
    step: "cfbd_school",
    status: error ? "failed" : "success",
    durationMs: Date.now() - t0,
    errorMessage: error?.message,
    resultSummary: patch,
  });
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const db = createPipelineClient();

  // Pre-fetch CFBD portal once for school enrichment (shared across batch)
  let cfbdPortal: Awaited<ReturnType<typeof fetchCfbdTransferPortal>> = [];
  if (CFBD_KEY) {
    const cfbdConfig: CfbdClientConfig = { apiKey: CFBD_KEY };
    const year = Number(process.env.TRANSFER_YEAR) || new Date().getFullYear();
    try {
      cfbdPortal = await fetchCfbdTransferPortal({ year, config: cfbdConfig });
      console.log(`CFBD portal: ${cfbdPortal.length} rows loaded`);
    } catch (err) {
      console.warn("CFBD load failed:", err);
    }
  }

  // Claim batch
  const batch = await claimBatch(db, BATCH_SIZE, WORKER_ID);
  console.log(`Claimed ${batch.length} entries (worker=${WORKER_ID})`);
  if (!batch.length) {
    console.log("Queue empty — nothing to do.");
    return;
  }

  // Fetch player rows for the batch
  const playerIds = batch.map((e) => e.player_id);
  const { data: playersRaw } = await db
    .from("players")
    .select("id, first_name, last_name, position, previous_school")
    .in("id", playerIds);

  const playerMap = new Map<string, PlayerRow>(
    ((playersRaw ?? []) as PlayerRow[]).map((p) => [p.id, p])
  );

  let done = 0;
  let failed = 0;

  for (const entry of batch) {
    const player = playerMap.get(entry.player_id);
    if (!player) {
      await markFailed(db, entry.id, "player row not found");
      failed++;
      continue;
    }

    try {
      const espnUrl = await stepEspnResolve(db, entry, player);
      await stepEspnStats(db, entry, player, espnUrl);
      await stepCfbdSchool(db, entry, player, cfbdPortal);

      await markDone(db, entry.id);

      // Update enrichment_status to partial (pff_scrape still pending)
      await db
        .from("players")
        .update({ enrichment_status: "partial" })
        .eq("id", player.id)
        .eq("enrichment_status", "unenriched");

      done++;
    } catch (err) {
      const msg = String(err);
      console.error(`Entry ${entry.id} failed: ${msg}`);
      await markFailed(db, entry.id, msg);
      failed++;
    }
  }

  console.log(`Batch complete. done=${done} failed=${failed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
