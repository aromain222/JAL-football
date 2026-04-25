/**
 * Vercel Cron: drain the enrichment queue via ESPN + CFBD HTTP steps.
 *
 * Runs every 2 hours (configured in vercel.json).
 * Processes up to BATCH_SIZE pending queue entries per invocation:
 *   1. espn_resolve  — match player to ESPN profile URL
 *   2. espn_stats    — fetch season stats
 *   3. cfbd_school   — fill previous_school / destination from CFBD portal
 *
 * PFF scraping is handled separately by GitHub Actions (requires Playwright).
 *
 * Required env vars:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   CFBD_API_KEY
 *   CRON_SECRET
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchEspnPlayerStats } from "@/lib/espn/player-stats";
import { fetchCfbdTransferPortal, type CfbdClientConfig } from "@/lib/cfbd/player-season-stats";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const BATCH_SIZE = 12;
const ESPN_DELAY_MS = 700;
const ESPN_STATS_SEASON = 2025;
const ESPN_MIN_SCORE = 0.7;
const WORKER_ID = `vercel-cron-${Date.now()}`;

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

async function searchEspn(name: string) {
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
      return [{ id: a.id, displayName: a.displayName, team: a.team?.displayName, position: a.position?.abbreviation }];
    });
  } catch {
    return [];
  }
}

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

  const cfbdKey = process.env.CFBD_API_KEY;
  const transferYear = Number(process.env.TRANSFER_YEAR) || new Date().getFullYear();

  // Pre-load CFBD portal for school enrichment
  let cfbdPortal: Array<{
    firstName: string; lastName: string; position: string;
    origin: string; destination: string | null; stars: number | null;
  }> = [];
  if (cfbdKey) {
    try {
      const cfbdConfig: CfbdClientConfig = { apiKey: cfbdKey };
      cfbdPortal = await fetchCfbdTransferPortal({ year: transferYear, config: cfbdConfig });
    } catch { /* non-fatal */ }
  }

  // Claim batch using the Postgres function
  const { data: batchRaw, error: claimErr } = await db.rpc("claim_enrichment_batch", {
    p_batch_size: BATCH_SIZE,
    p_worker_id: WORKER_ID,
  });
  if (claimErr) {
    return NextResponse.json({ error: claimErr.message }, { status: 500 });
  }

  const batch = (batchRaw ?? []) as Array<{ id: string; player_id: string; attempts: number; max_attempts: number }>;
  if (!batch.length) {
    return NextResponse.json({ ok: true, message: "Queue empty", processed: 0 });
  }

  // Fetch player rows for the batch
  const playerIds = batch.map((e) => e.player_id);
  const { data: playersRaw } = await db
    .from("players")
    .select("id, first_name, last_name, position, previous_school, current_school, stars")
    .in("id", playerIds);

  const playerMap = new Map<string, typeof playersRaw[0]>(
    ((playersRaw ?? []) as Array<{ id: string; [k: string]: unknown }>).map((p) => [p.id, p])
  );

  const cfbdByName = new Map<string, typeof cfbdPortal>();
  for (const row of cfbdPortal) {
    const key = norm(`${row.firstName} ${row.lastName}`);
    const arr = cfbdByName.get(key) ?? [];
    arr.push(row);
    cfbdByName.set(key, arr);
  }

  const results: Record<string, unknown>[] = [];

  for (const entry of batch) {
    const player = playerMap.get(entry.player_id) as {
      id: string; first_name: string; last_name: string;
      position: string | null; previous_school: string | null;
      current_school: string | null; stars: number | null;
    } | undefined;

    if (!player) {
      await db.from("enrichment_queue").update({ status: "failed", last_error: "player not found" }).eq("id", entry.id);
      results.push({ player_id: entry.player_id, error: "player not found" });
      continue;
    }

    const stepResults: Record<string, unknown> = {};
    let anyError = false;

    // ── espn_resolve ────────────────────────────────────────────────────────
    try {
      const { data: existingLink } = await db
        .from("player_identity_links")
        .select("espn_url")
        .eq("player_id", player.id)
        .single();

      let espnUrl: string | null = existingLink?.espn_url ?? null;

      if (!espnUrl) {
        const name = `${player.first_name} ${player.last_name}`;
        await sleep(ESPN_DELAY_MS);
        const hits = await searchEspn(name);

        let best: (typeof hits[0] & { score: number }) | null = null;
        for (const hit of hits) {
          let score = tokenSim(name, hit.displayName);
          if (player.previous_school && hit.team && tokenSim(player.previous_school, hit.team) >= 0.6) score += 0.15;
          if (!best || score > best.score) best = { ...hit, score };
        }

        if (best && best.score >= ESPN_MIN_SCORE) {
          espnUrl = `https://www.espn.com/college-football/player/_/id/${best.id}/${norm(best.displayName).replace(/\s+/g, "-")}`;
          await db.from("player_identity_links").upsert({
            player_id: player.id, espn_url: espnUrl, roster_url: null,
            source: "espn", confidence: best.score, matched_team: best.team ?? null,
            notes: `ESPN search: ${best.displayName}`, last_checked_at: new Date().toISOString(),
          }, { onConflict: "player_id" });
        }
        stepResults.espn_resolve = { resolved: !!espnUrl, score: best?.score };
      } else {
        stepResults.espn_resolve = { skipped: "already_resolved" };
      }

      // ── espn_stats ──────────────────────────────────────────────────────
      if (espnUrl) {
        const { data: existingStats } = await db
          .from("player_stats").select("player_id")
          .eq("player_id", player.id).eq("season", ESPN_STATS_SEASON).single();

        if (!existingStats) {
          await sleep(ESPN_DELAY_MS);
          try {
            const mapped = await fetchEspnPlayerStats(espnUrl, { season: ESPN_STATS_SEASON });
            if (mapped) {
              await db.from("player_stats").upsert({
                player_id: player.id, season: mapped.season, games_played: mapped.games_played,
                starts: mapped.starts, offensive_snaps: null, defensive_snaps: null,
                special_teams_snaps: null, passing_yards: mapped.passing_yards,
                rushing_yards: mapped.rushing_yards, receiving_yards: mapped.receiving_yards,
                total_touchdowns: mapped.total_touchdowns, tackles: mapped.tackles,
                sacks: mapped.sacks, interceptions: mapped.interceptions,
                passes_defended: mapped.passes_defended, passing_tds: mapped.passing_tds,
                interceptions_thrown: mapped.interceptions_thrown,
                rushing_attempts: mapped.rushing_attempts, rushing_tds: mapped.rushing_tds,
                receptions: mapped.receptions, receiving_tds: mapped.receiving_tds,
                tackles_for_loss: mapped.tackles_for_loss, forced_fumbles: mapped.forced_fumbles,
                source: "espn",
              }, { onConflict: "player_id,season" });
              stepResults.espn_stats = { imported: true, games: mapped.games_played };
            } else {
              stepResults.espn_stats = { no_data: true };
            }
          } catch (e) { stepResults.espn_stats = { error: String(e) }; }
        } else {
          stepResults.espn_stats = { skipped: "already_present" };
        }
      }
    } catch (e) {
      anyError = true;
      stepResults.espn_error = String(e);
    }

    // ── cfbd_school ─────────────────────────────────────────────────────────
    if (cfbdPortal.length) {
      try {
        const key = norm(`${player.first_name} ${player.last_name}`);
        const candidates = cfbdByName.get(key) ?? [];
        if (candidates.length) {
          const pos = (player.position ?? "").toLowerCase();
          const picked = candidates.find((c) => c.position?.toLowerCase() === pos) ?? candidates[0];
          const patch: Record<string, unknown> = {};
          if (!player.previous_school && picked.origin) patch.previous_school = picked.origin;
          if (player.current_school === "Transfer Portal" && picked.destination) patch.current_school = picked.destination;
          if (player.stars == null && picked.stars != null) patch.stars = picked.stars;
          if (Object.keys(patch).length) {
            await db.from("players").update(patch).eq("id", player.id);
            stepResults.cfbd_school = patch;
          } else {
            stepResults.cfbd_school = { skipped: "nothing_to_patch" };
          }
        } else {
          stepResults.cfbd_school = { no_match: true };
        }
      } catch (e) {
        anyError = true;
        stepResults.cfbd_school_error = String(e);
      }
    }

    // ── finalize entry ───────────────────────────────────────────────────────
    if (anyError) {
      const exhausted = entry.attempts >= entry.max_attempts;
      await db.from("enrichment_queue").update({
        status: exhausted ? "failed" : "pending",
        last_error: JSON.stringify(stepResults),
      }).eq("id", entry.id);
    } else {
      await db.from("enrichment_queue").update({ status: "done" }).eq("id", entry.id);
      await db.from("players")
        .update({ enrichment_status: "partial" })
        .eq("id", player.id)
        .eq("enrichment_status", "unenriched");
    }

    results.push({ player_id: player.id, steps: stepResults, ok: !anyError });
  }

  return NextResponse.json({
    ok: true,
    ran_at: new Date().toISOString(),
    processed: batch.length,
    results,
  });
}
