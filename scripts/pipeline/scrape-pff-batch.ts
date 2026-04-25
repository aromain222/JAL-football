/**
 * Pipeline: PFF queue consumer — runs in GitHub Actions with Chromium available.
 *
 * Claims entries from enrichment_queue, searches PFF for each player by name,
 * fetches grades + snap alignment data via the premium PFF API (requires an
 * active PFF session cookie stored in PLAYWRIGHT_USER_DATA_DIR), and upserts
 * results into player_pff_grades.
 *
 * Usage:  npm run pipeline:scrape-pff
 * Env:    NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *         PFF_EMAIL, PFF_PASSWORD   (used for automatic login if session expired)
 *         PLAYWRIGHT_USER_DATA_DIR  (default: .playwright-pff)
 *         BATCH_SIZE=5              (default: 5 — keep low to avoid rate limits)
 *         PFF_SEASON=2025           (default: 2025)
 *         WORKER_ID=pff-worker
 *
 * Notes:
 *   - This script requires a paid PFF Premium subscription.
 *   - Run pff-session.ts first to warm up the Playwright session cookie.
 *   - The GitHub Actions workflow schedules this nightly after sync-portal.
 */

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import path from "node:path";
import { chromium } from "playwright";
import {
  createPipelineClient,
  claimBatch,
  markDone,
  markFailed,
  logStep,
  type QueueEntry,
} from "@/lib/pipeline/queue";
import type { SupabaseClient } from "@supabase/supabase-js";

// ── Config ────────────────────────────────────────────────────────────────────

const WORKER_ID = process.env.WORKER_ID ?? `pff-worker-${Date.now()}`;
const BATCH_SIZE = Number(process.env.BATCH_SIZE) || 5;
const PFF_SEASON = Number(process.env.PFF_SEASON) || 2025;
const USER_DATA_DIR = path.resolve(
  process.env.PLAYWRIGHT_USER_DATA_DIR ?? ".playwright-pff"
);
const PFF_EMAIL = process.env.PFF_EMAIL;
const PFF_PASSWORD = process.env.PFF_PASSWORD;
const REQUEST_DELAY_MS = 1200;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

// ── PFF API helpers (reuse premium.pff.com session) ──────────────────────────

type PffApiPlayer = {
  id: number;
  first_name: string;
  last_name: string;
  position: string | null;
  team?: { abbreviation?: string | null } | null;
};

type PffGradeRow = {
  player_id: number;
  season: number;
  grades_overall?: number | null;
  grades_offense?: number | null;
  grades_defense?: number | null;
  grades_pass?: number | null;
  grades_pass_route?: number | null;
  grades_run_rb?: number | null;
  grades_pass_block?: number | null;
  grades_run_block?: number | null;
  grades_pass_rush?: number | null;
  grades_run_defense_dl?: number | null;
  grades_run_defense_lb?: number | null;
  grades_coverage_db?: number | null;
  grades_coverage_lb?: number | null;
  grades_tackle?: number | null;
  grades_tackle_db?: number | null;
  snaps_offense?: number | null;
  snaps_defense?: number | null;
  snaps_at_left_guard?: number | null;
  snaps_at_right_guard?: number | null;
  snaps_at_center?: number | null;
  snaps_at_left_tackle?: number | null;
  snaps_at_right_tackle?: number | null;
  stats_pressures_allowed?: number | null;
  stats_sacks_allowed?: number | null;
  stats_pass_block_snaps?: number | null;
  stats_pressures?: number | null;
  stats_sacks?: number | null;
};

async function fetchPffJson<T>(page: import("playwright").Page, url: string): Promise<T | null> {
  await sleep(REQUEST_DELAY_MS);
  try {
    const res = await page.evaluate(
      async (u: string) => {
        const r = await fetch(u, { credentials: "include" });
        if (!r.ok) return { ok: false, status: r.status, body: null };
        const body = await r.json();
        return { ok: true, status: r.status, body };
      },
      url
    );
    if (!res.ok) return null;
    return res.body as T;
  } catch {
    return null;
  }
}

async function searchPffPlayer(
  page: import("playwright").Page,
  name: string
): Promise<PffApiPlayer[]> {
  const url = `https://premium.pff.com/api/v1/players?league=ncaa&name=${encodeURIComponent(name)}`;
  const data = await fetchPffJson<{ players?: PffApiPlayer[] }>(page, url);
  return data?.players ?? [];
}

async function fetchPffGrades(
  page: import("playwright").Page,
  pffId: number
): Promise<PffGradeRow | null> {
  const url = `https://premium.pff.com/api/v1/player/stats?league=ncaa&player_id=${pffId}&season=${PFF_SEASON}&season_type=REGPO`;
  const data = await fetchPffJson<{ player_grades?: PffGradeRow[] }>(page, url);
  return data?.player_grades?.[0] ?? null;
}

async function fetchPffSnaps(
  page: import("playwright").Page,
  pffId: number,
  slug: string
): Promise<Record<string, number | null> | null> {
  const url = `https://premium.pff.com/api/v1/player/snaps?league=ncaa&player_id=${pffId}&season=${PFF_SEASON}&season_type=REGPO&slug=${slug}`;
  const data = await fetchPffJson<{ player_snaps?: Array<Record<string, unknown>> }>(page, url);
  const row = data?.player_snaps?.[0];
  if (!row) return null;
  // Extract alignment snaps
  return {
    snaps_at_left_guard: (row.snaps_at_left_guard as number) ?? null,
    snaps_at_right_guard: (row.snaps_at_right_guard as number) ?? null,
    snaps_at_center: (row.snaps_at_center as number) ?? null,
    snaps_at_left_tackle: (row.snaps_at_left_tackle as number) ?? null,
    snaps_at_right_tackle: (row.snaps_at_right_tackle as number) ?? null,
    snaps_in_box_lb: (row.snaps_in_box as number) ?? null,
    snaps_off_ball_lb: (row.snaps_off_ball as number) ?? null,
  };
}

// ── Ensure PFF session is active ──────────────────────────────────────────────

async function ensurePffSession(page: import("playwright").Page): Promise<boolean> {
  await page.goto("https://premium.pff.com/ncaa/players", { waitUntil: "domcontentloaded", timeout: 30_000 });
  const url = page.url();
  if (url.includes("login") || url.includes("signin")) {
    if (!PFF_EMAIL || !PFF_PASSWORD) {
      console.error("PFF session expired and no credentials available. Set PFF_EMAIL + PFF_PASSWORD.");
      return false;
    }
    console.log("PFF session expired — logging in...");
    try {
      await page.fill('input[type="email"]', PFF_EMAIL);
      await page.fill('input[type="password"]', PFF_PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForURL((u) => !u.toString().includes("login"), { timeout: 20_000 });
    } catch {
      console.error("Auto-login failed.");
      return false;
    }
  }
  return true;
}

// ── Per-player PFF step ───────────────────────────────────────────────────────

interface PlayerRow {
  id: string;
  first_name: string;
  last_name: string;
  position: string | null;
  previous_school: string | null;
}

async function stepPffScrape(
  db: SupabaseClient,
  page: import("playwright").Page,
  entry: QueueEntry,
  player: PlayerRow
): Promise<void> {
  const t0 = Date.now();

  // Check if already have recent PFF data
  const { data: existing } = await db
    .from("player_pff_grades")
    .select("id, season")
    .eq("player_id", player.id)
    .eq("season", PFF_SEASON)
    .not("grades_overall", "is", null)
    .single();

  if (existing) {
    await logStep(db, {
      queueEntryId: entry.id,
      playerId: player.id,
      step: "pff_scrape",
      status: "skipped",
      durationMs: Date.now() - t0,
      resultSummary: { reason: "already_has_grades" },
    });
    return;
  }

  const name = `${player.first_name} ${player.last_name}`;
  const candidates = await searchPffPlayer(page, name);

  if (!candidates.length) {
    await logStep(db, {
      queueEntryId: entry.id,
      playerId: player.id,
      step: "pff_scrape",
      status: "no_data",
      durationMs: Date.now() - t0,
      resultSummary: { reason: "pff_search_no_results" },
    });
    return;
  }

  // Score candidates by name similarity + position match
  const normPos = (player.position ?? "").toUpperCase();
  let best: (PffApiPlayer & { score: number }) | null = null;
  for (const c of candidates) {
    const nameSim = tokenSim(name, `${c.first_name} ${c.last_name}`);
    const posBonus = (c.position ?? "").toUpperCase() === normPos ? 0.2 : 0;
    const score = nameSim + posBonus;
    if (!best || score > best.score) best = { ...c, score };
  }

  if (!best || best.score < 0.6) {
    await logStep(db, {
      queueEntryId: entry.id,
      playerId: player.id,
      step: "pff_scrape",
      status: "no_data",
      durationMs: Date.now() - t0,
      resultSummary: { reason: "no_confident_match", best_score: best?.score },
    });
    return;
  }

  const pffId = best.id;
  const slug = slugify(`${best.first_name} ${best.last_name}`);

  const [grades, snaps] = await Promise.all([
    fetchPffGrades(page, pffId),
    fetchPffSnaps(page, pffId, slug),
  ]);

  if (!grades) {
    await logStep(db, {
      queueEntryId: entry.id,
      playerId: player.id,
      step: "pff_scrape",
      status: "no_data",
      durationMs: Date.now() - t0,
      resultSummary: { pff_id: pffId, reason: "no_grade_data" },
    });
    return;
  }

  const upsertRow: Record<string, unknown> = {
    player_id: player.id,
    pff_player_id: String(pffId),
    season: PFF_SEASON,
    position: best.position ?? player.position,
    team: best.team?.abbreviation ?? null,
    grades_overall: grades.grades_overall ?? null,
    grades_offense: grades.grades_offense ?? null,
    grades_defense: grades.grades_defense ?? null,
    grades_pass: grades.grades_pass ?? null,
    grades_pass_route: grades.grades_pass_route ?? null,
    grades_run_rb: grades.grades_run_rb ?? null,
    grades_pass_block: grades.grades_pass_block ?? null,
    grades_run_block: grades.grades_run_block ?? null,
    grades_pass_rush: grades.grades_pass_rush ?? null,
    grades_run_defense_dl: grades.grades_run_defense_dl ?? null,
    grades_run_defense_lb: grades.grades_run_defense_lb ?? null,
    grades_coverage_db: grades.grades_coverage_db ?? null,
    grades_coverage_lb: grades.grades_coverage_lb ?? null,
    grades_tackle: grades.grades_tackle ?? null,
    grades_tackle_db: grades.grades_tackle_db ?? null,
    snaps_offense: grades.snaps_offense ?? null,
    snaps_defense: grades.snaps_defense ?? null,
    stats_pressures_allowed: grades.stats_pressures_allowed ?? null,
    stats_sacks_allowed: grades.stats_sacks_allowed ?? null,
    stats_pass_block_snaps: grades.stats_pass_block_snaps ?? null,
    stats_pressures: grades.stats_pressures ?? null,
    stats_sacks: grades.stats_sacks ?? null,
    ...(snaps ?? {}),
  };

  const { error } = await db
    .from("player_pff_grades")
    .upsert(upsertRow, { onConflict: "player_id,season" });

  if (!error) {
    // Mark player enrichment complete
    await db
      .from("players")
      .update({ enrichment_status: "complete" })
      .eq("id", player.id);
  }

  await logStep(db, {
    queueEntryId: entry.id,
    playerId: player.id,
    step: "pff_scrape",
    status: error ? "failed" : "success",
    durationMs: Date.now() - t0,
    errorMessage: error?.message,
    resultSummary: {
      pff_id: pffId,
      grades_overall: grades.grades_overall,
      has_snaps: !!snaps,
    },
  });
}

function tokenSim(a: string, b: string): number {
  const norm = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const ta = new Set(norm(a).split(" ").filter(Boolean));
  const tb = new Set(norm(b).split(" ").filter(Boolean));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const union = ta.size + tb.size - inter;
  return union ? inter / union : 0;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const db = createPipelineClient();

  // Claim only entries that haven't had a successful pff_scrape yet
  const batch = await claimBatch(db, BATCH_SIZE, WORKER_ID);
  console.log(`Claimed ${batch.length} entries (worker=${WORKER_ID})`);
  if (!batch.length) {
    console.log("No entries to process.");
    return;
  }

  // Filter to those that still need PFF (no successful pff_scrape run)
  const { data: recentSuccess } = await db
    .from("enrichment_runs")
    .select("player_id")
    .in("player_id", batch.map((e) => e.player_id))
    .eq("step", "pff_scrape")
    .eq("status", "success");

  const alreadyDone = new Set(
    ((recentSuccess ?? []) as Array<{ player_id: string }>).map((r) => r.player_id)
  );

  const toProcess = batch.filter((e) => !alreadyDone.has(e.player_id));
  const toSkip = batch.filter((e) => alreadyDone.has(e.player_id));

  // Mark already-done entries as done immediately
  for (const e of toSkip) await markDone(db, e.id);

  if (!toProcess.length) {
    console.log("All entries already have PFF data.");
    return;
  }

  // Fetch player rows
  const { data: playersRaw } = await db
    .from("players")
    .select("id, first_name, last_name, position, previous_school")
    .in("id", toProcess.map((e) => e.player_id));

  const playerMap = new Map<string, PlayerRow>(
    ((playersRaw ?? []) as PlayerRow[]).map((p) => [p.id, p])
  );

  // Launch persistent Playwright context (reuses cookies from prior session)
  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: true,
    viewport: { width: 1280, height: 900 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });

  const page = await context.newPage();
  const sessionOk = await ensurePffSession(page);
  if (!sessionOk) {
    await context.close();
    process.exit(1);
  }

  let done = 0;
  let failed = 0;

  for (const entry of toProcess) {
    const player = playerMap.get(entry.player_id);
    if (!player) {
      await markFailed(db, entry.id, "player row not found");
      failed++;
      continue;
    }

    try {
      await stepPffScrape(db, page, entry, player);
      await markDone(db, entry.id);
      done++;
    } catch (err) {
      const msg = String(err);
      console.error(`PFF scrape failed for ${player.first_name} ${player.last_name}: ${msg}`);
      await markFailed(db, entry.id, msg);
      failed++;
    }
  }

  await context.close();
  console.log(`PFF batch complete. done=${done} failed=${failed} skipped=${toSkip.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
