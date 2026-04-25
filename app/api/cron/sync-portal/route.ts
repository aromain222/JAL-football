/**
 * Vercel Cron: automated transfer portal pipeline
 *
 * Runs daily at 6 AM UTC (configured in vercel.json).
 * Steps:
 *   1. Sportradar — upsert new portal players + measurements
 *   2. CFBD       — enrich previous_school / current_school / stars by name match
 *   3. ESPN URL   — resolve ESPN profile URLs for unlinked players (≤ 25/run)
 *   4. ESPN stats — backfill season stats for players with URL but no stats (≤ 25/run)
 *
 * PFF grades require a paid PFF subscription and browser automation — handled
 * separately via the pff:download / pff:import npm scripts.
 *
 * Required env vars:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   SPORTRADAR_API_KEY (or SPORTS_RADAR_API_KEY)
 *   CFBD_API_KEY
 *   CRON_SECRET (Vercel sets this automatically in production)
 *
 * Optional:
 *   SPORTRADAR_ACCESS_LEVEL=trial|production (default: trial)
 *   TRANSFER_YEAR=2026 (default: current year)
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  fetchTransferPortal,
  mapSportradarPosition,
  parseBirthPlace,
  eligibilityRemaining
} from "@/lib/sportradar/transfer-portal";
import { fetchCfbdTransferPortal, type CfbdClientConfig } from "@/lib/cfbd/player-season-stats";
import { fetchEspnPlayerStats } from "@/lib/espn/player-stats";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const ESPN_LIMIT_PER_RUN = 25;
const ESPN_DELAY_MS = 600;
const ESPN_STATS_SEASON = 2025;
const ESPN_MIN_SCORE = 0.7;

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

function makeNameKey(first: string, last: string): string {
  return norm(`${first} ${last}`);
}

async function searchEspn(
  name: string
): Promise<Array<{ id: string; displayName: string; team?: string; position?: string }>> {
  const url =
    `https://site.api.espn.com/apis/common/v3/search` +
    `?query=${encodeURIComponent(name)}&limit=10&type=athletes&sport=football&league=college-football`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      signal: AbortSignal.timeout(10_000)
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

  const sportradarKey = process.env.SPORTRADAR_API_KEY ?? process.env.SPORTS_RADAR_API_KEY;
  const cfbdKey = process.env.CFBD_API_KEY;
  const accessLevel = (process.env.SPORTRADAR_ACCESS_LEVEL as "trial" | "production") || "trial";
  const transferYear = Number(process.env.TRANSFER_YEAR) || new Date().getFullYear();

  // Use any-typed client to avoid complex Supabase generic inference issues
  // (same pattern used in scripts that work with player_measurements, player_stats, etc.)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  }) as any;

  const steps: Record<string, unknown> = {};

  // ── Step 1: Sportradar sync ────────────────────────────────────────────────
  if (!sportradarKey) {
    steps.sportradar = { skipped: true, reason: "No SPORTRADAR_API_KEY" };
  } else {
    try {
      const data = await fetchTransferPortal({ apiKey: sportradarKey, accessLevel });
      const apiPlayers = data.league.transfer_portal_players;

      const { data: existing } = await supabase
        .from("players")
        .select("id, sportradar_id")
        .in("sportradar_id", apiPlayers.map((p: { id: string }) => p.id));

      const idBySportradarId = new Map<string, string>(
        ((existing ?? []) as Array<{ id: string; sportradar_id: string | null }>)
          .filter((r) => r.sportradar_id)
          .map((r) => [r.sportradar_id!, r.id])
      );

      const players: Array<Record<string, unknown>> = [];
      const measurements: Array<Record<string, unknown>> = [];

      for (const p of apiPlayers) {
        const { hometown, state } = parseBirthPlace(p.birth_place);
        const ourId = idBySportradarId.get(p.id) ?? crypto.randomUUID();

        players.push({
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
          sportradar_id: p.id
        });

        if (p.height > 0 && p.weight > 0) {
          measurements.push({
            player_id: ourId,
            height_in: p.height,
            weight_lbs: Math.round(p.weight),
            arm_length_in: null,
            forty_time: null,
            shuttle_time: null,
            vertical_jump: null,
            wing_span_in: null,
            verified_at: null
          });
        }
      }

      const { error: upsertErr } = await supabase
        .from("players")
        .upsert(players, { onConflict: "sportradar_id" });

      let measurementsUpserted = 0;
      if (!upsertErr && measurements.length > 0) {
        const { error: measErr } = await supabase
          .from("player_measurements")
          .upsert(measurements, { onConflict: "player_id" });
        if (!measErr) measurementsUpserted = measurements.length;
      }

      steps.sportradar = {
        fetched: apiPlayers.length,
        upserted: players.length,
        measurements: measurementsUpserted,
        error: upsertErr?.message ?? null
      };
    } catch (err) {
      steps.sportradar = { error: String(err) };
    }
  }

  // ── Step 2: CFBD school enrichment ────────────────────────────────────────
  if (!cfbdKey) {
    steps.cfbd = { skipped: true, reason: "No CFBD_API_KEY" };
  } else {
    try {
      const cfbdConfig: CfbdClientConfig = { apiKey: cfbdKey };
      const portal = await fetchCfbdTransferPortal({ year: transferYear, config: cfbdConfig });

      const byName = new Map<string, typeof portal>();
      for (const row of portal) {
        const key = makeNameKey(row.firstName, row.lastName);
        const arr = byName.get(key) ?? [];
        arr.push(row);
        byName.set(key, arr);
      }

      const { data: playersRaw } = await supabase
        .from("players")
        .select("id, first_name, last_name, position, previous_school, current_school, stars")
        .not("sportradar_id", "is", null);

      let updated = 0;
      for (const p of (playersRaw ?? []) as Array<{
        id: string;
        first_name: string;
        last_name: string;
        position: string | null;
        previous_school: string | null;
        current_school: string | null;
        stars: number | null;
      }>) {
        const key = makeNameKey(p.first_name, p.last_name);
        const candidates = byName.get(key) ?? [];
        if (!candidates.length) continue;

        const pos = String(p.position ?? "").toLowerCase();
        const picked =
          candidates.find((c) => String(c.position ?? "").toLowerCase() === pos) ?? candidates[0];

        const patch: Record<string, unknown> = {};
        if (!p.previous_school && picked.origin) patch.previous_school = picked.origin;
        if (p.current_school === "Transfer Portal" && picked.destination) patch.current_school = picked.destination;
        if (p.stars == null && picked.stars != null) patch.stars = picked.stars;
        if (Object.keys(patch).length === 0) continue;

        const { error } = await supabase.from("players").update(patch).eq("id", p.id);
        if (!error) updated++;
      }

      steps.cfbd = { portal_rows: portal.length, players_updated: updated };
    } catch (err) {
      steps.cfbd = { error: String(err) };
    }
  }

  // ── Step 3: ESPN URL resolution ────────────────────────────────────────────
  try {
    const { data: allPlayers } = await supabase
      .from("players")
      .select("id, first_name, last_name, previous_school, player_identity_links(espn_url)")
      .limit(ESPN_LIMIT_PER_RUN * 4);

    const needsEspn = ((allPlayers ?? []) as Array<{
      id: string;
      first_name: string;
      last_name: string;
      previous_school: string | null;
      player_identity_links: Array<{ espn_url: string | null }> | { espn_url: string | null } | null;
    }>)
      .filter((p) => {
        const link = Array.isArray(p.player_identity_links)
          ? p.player_identity_links[0]
          : p.player_identity_links;
        return !link?.espn_url;
      })
      .slice(0, ESPN_LIMIT_PER_RUN);

    let espnFound = 0;
    let espnMissed = 0;

    for (const p of needsEspn) {
      const name = `${p.first_name} ${p.last_name}`;
      await sleep(ESPN_DELAY_MS);

      const hits = await searchEspn(name);
      if (!hits.length) { espnMissed++; continue; }

      let best: (typeof hits[0] & { score: number }) | null = null;
      for (const hit of hits) {
        let score = tokenSim(name, hit.displayName);
        if (p.previous_school && hit.team) {
          if (tokenSim(p.previous_school, hit.team) >= 0.6) score += 0.15;
        }
        if (!best || score > best.score) best = { ...hit, score };
      }

      if (!best || best.score < ESPN_MIN_SCORE) { espnMissed++; continue; }

      const espnUrl = `https://www.espn.com/college-football/player/_/id/${best.id}/${norm(best.displayName).replace(/\s+/g, "-")}`;
      const { error } = await supabase
        .from("player_identity_links")
        .upsert({
          player_id: p.id,
          espn_url: espnUrl,
          roster_url: null,
          source: "espn",
          confidence: best.score,
          matched_team: best.team ?? null,
          notes: `ESPN search: ${best.displayName}`,
          last_checked_at: new Date().toISOString()
        }, { onConflict: "player_id" });
      if (!error) espnFound++;
      else espnMissed++;
    }

    steps.espn_resolve = { processed: needsEspn.length, resolved: espnFound, missed: espnMissed };
  } catch (err) {
    steps.espn_resolve = { error: String(err) };
  }

  // ── Step 4: ESPN stats backfill ────────────────────────────────────────────
  try {
    const [{ data: linksRaw }, { data: existingStats }] = await Promise.all([
      supabase.from("player_identity_links").select("player_id, espn_url").not("espn_url", "is", null),
      supabase.from("player_stats").select("player_id").eq("season", ESPN_STATS_SEASON)
    ]);

    const withStats = new Set(
      ((existingStats ?? []) as Array<{ player_id: string }>).map((r) => r.player_id)
    );
    const toBackfill = ((linksRaw ?? []) as Array<{ player_id: string; espn_url: string | null }>)
      .filter((l) => l.espn_url && !withStats.has(l.player_id))
      .slice(0, ESPN_LIMIT_PER_RUN);

    let imported = 0;
    let noData = 0;
    let errors = 0;

    for (let i = 0; i < toBackfill.length; i++) {
      const link = toBackfill[i];
      if (i > 0) await sleep(ESPN_DELAY_MS);

      try {
        const mapped = await fetchEspnPlayerStats(link.espn_url!, { season: ESPN_STATS_SEASON });
        if (!mapped) { noData++; continue; }

        const { error: upErr } = await supabase
          .from("player_stats")
          .upsert({
            player_id: link.player_id,
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
            source: "espn"
          }, { onConflict: "player_id,season" });

        if (!upErr) { imported++; withStats.add(link.player_id); }
        else errors++;
      } catch {
        errors++;
      }
    }

    steps.espn_stats = { processed: toBackfill.length, imported, no_data: noData, errors };
  } catch (err) {
    steps.espn_stats = { error: String(err) };
  }

  return NextResponse.json({ ok: true, ran_at: new Date().toISOString(), steps });
}
