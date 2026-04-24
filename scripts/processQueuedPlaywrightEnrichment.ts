import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import {
  createWorkerId,
  deriveStatProfileUsed,
  nowIso,
  supabase,
  type DbPlayerInsert,
  type DbPlayerStatsInsert,
  type DbPortalQueueRow,
} from "@/scripts/lib/portal-pipeline";

const execFile = promisify(execFileCallback);

const MIN_QUEUE_SIZE = 10;
const CLAIM_BATCH_SIZE = 10;
const workerId = createWorkerId("processQueuedPlaywrightEnrichment");
const cwd = process.cwd();

type QueueRow = DbPortalQueueRow;

type ScraperInput = {
  name: string;
  school: string | null;
  position: string | null;
};

type ScraperResult = {
  input: ScraperInput;
  status: "ok" | "not_found" | "error";
  error: string | null;
  position_group: string;
  stats: {
    total_snaps: number | null;
    usage_splits: Record<string, number | null>;
    snap_alignment: Record<string, number | null>;
    position_specific: Record<string, number | null>;
  };
  raw: Record<string, unknown>;
  missing_fields: string[];
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function toNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function positionForQueue(
  row: QueueRow,
  normalizedPlayer: Record<string, unknown>,
  payload: Record<string, unknown>
) {
  return (
    toNullableString(row.position_group) ??
    toNullableString(normalizedPlayer.position_group) ??
    toNullableString(normalizedPlayer.position) ??
    toNullableString(payload.position_group) ??
    toNullableString(payload.position) ??
    "LB"
  );
}

function buildScraperInput(row: QueueRow): ScraperInput {
  const normalizedPayload = asRecord(row.normalized_payload);
  const normalizedPlayer = asRecord(normalizedPayload.player);
  const payload = asRecord(row.payload);

  const firstName =
    toNullableString(normalizedPlayer.first_name) ??
    toNullableString(payload.first_name) ??
    null;
  const lastName =
    toNullableString(normalizedPlayer.last_name) ??
    toNullableString(payload.last_name) ??
    null;
  const combinedName = [firstName, lastName].filter(Boolean).join(" ").trim();

  return {
    name: combinedName || toNullableString(payload.full_name) || row.external_player_id,
    school:
      toNullableString(normalizedPlayer.previous_school) ??
      toNullableString(payload.previous_school) ??
      toNullableString(payload.school) ??
      null,
    position: positionForQueue(row, normalizedPlayer, payload),
  };
}

function scrapeSeasonForRow(row: QueueRow) {
  return Math.max(2000, row.transfer_year - 1);
}

async function countQueuedRows() {
  const { count, error } = await supabase
    .from("portal_ingestion_queue" as never)
    .select("*", { count: "exact", head: true })
    .eq("pff_enrichment_status", "queued")
    .in("status", ["pending", "retry"]);

  if (error) {
    throw new Error(`Failed counting queued enrichment rows: ${error.message}`);
  }

  return count ?? 0;
}

async function selectOldestQueuedRows(limit: number) {
  const { data, error } = await supabase
    .from("portal_ingestion_queue" as never)
    .select("*")
    .eq("pff_enrichment_status", "queued")
    .in("status", ["pending", "retry"])
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`Failed selecting queued enrichment rows: ${error.message}`);
  }

  return (data ?? []) as QueueRow[];
}

async function markRowInProgress(row: QueueRow) {
  const timestamp = nowIso();
  const { data, error } = await supabase
    .from("portal_ingestion_queue" as never)
    .update({
      status: "processing",
      pff_enrichment_status: "in_progress",
      locked_at: timestamp,
      locked_by: workerId,
      started_at: row.started_at ?? timestamp,
      last_attempt_at: timestamp,
      attempt_count: row.attempt_count + 1,
      error_message: null,
      completed_at: null,
    } as never)
    .eq("id", row.id)
    .eq("pff_enrichment_status", "queued")
    .in("status", ["pending", "retry"])
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed claiming row ${row.id}: ${error.message}`);
  }

  return (data as QueueRow | null) ?? null;
}

async function claimQueuedRows(limit: number) {
  const candidates = await selectOldestQueuedRows(limit);
  const claimed: QueueRow[] = [];

  for (const candidate of candidates) {
    const row = await markRowInProgress(candidate);
    if (row) claimed.push(row);
  }

  return claimed;
}

async function runScraperForSeason(rows: QueueRow[], season: number) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `portal-pff-${season}-`));
  const inputPath = path.join(tempDir, "players.json");
  const outDir = path.join(tempDir, "output");

  fs.writeFileSync(
    inputPath,
    JSON.stringify(rows.map((row) => buildScraperInput(row)), null, 2)
  );

  const tsxBinary = path.resolve(cwd, "node_modules", ".bin", "tsx");
  const scriptPath = path.resolve(cwd, "scripts", "pff-scrape-player-scouting.ts");

  try {
    await execFile(
      tsxBinary,
      [scriptPath, "--input", inputPath, "--out", outDir, "--season", String(season)],
      { cwd, maxBuffer: 20 * 1024 * 1024 }
    );

    const aggregatePath = path.join(outDir, "player-scouting-results.json");
    const parsed = JSON.parse(fs.readFileSync(aggregatePath, "utf8")) as {
      players?: ScraperResult[];
    };
    const players = asArray<ScraperResult>(parsed.players);

    if (players.length !== rows.length) {
      throw new Error(
        `Scraper returned ${players.length} results for ${rows.length} queued rows in season ${season}`
      );
    }

    return players;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function mapPlayerUpsert(row: QueueRow, result: ScraperResult): DbPlayerInsert {
  const normalizedPayload = asRecord(row.normalized_payload);
  const normalizedPlayer = asRecord(normalizedPayload.player);
  const payload = asRecord(row.payload);
  const input = result.input;
  const nameParts = input.name.trim().split(/\s+/);
  const playerId = row.player_id ?? crypto.randomUUID();
  const position = positionForQueue(row, normalizedPlayer, payload) as DbPlayerInsert["position"];
  const resolvedLastName =
    toNullableString(normalizedPlayer.last_name) ??
    toNullableString(payload.last_name) ??
    nameParts.slice(1).join(" ") ??
    null;

  return {
    id: playerId,
    first_name:
      toNullableString(normalizedPlayer.first_name) ??
      toNullableString(payload.first_name) ??
      nameParts[0] ??
      "Unknown",
    last_name: resolvedLastName && resolvedLastName.trim() ? resolvedLastName : "Player",
    position,
    position_group: position,
    transfer_year: row.transfer_year,
    current_school:
      toNullableString(normalizedPlayer.current_school) ??
      toNullableString(payload.current_school) ??
      "Transfer Portal",
    conference:
      toNullableString(normalizedPlayer.conference) ??
      toNullableString(payload.conference) ??
      null,
    previous_school:
      toNullableString(normalizedPlayer.previous_school) ??
      input.school ??
      toNullableString(payload.previous_school) ??
      null,
    hometown:
      toNullableString(normalizedPlayer.hometown) ??
      toNullableString(payload.hometown) ??
      null,
    state:
      toNullableString(normalizedPlayer.state) ??
      toNullableString(payload.state) ??
      null,
    class_year:
      toNullableString(normalizedPlayer.class_year) ??
      toNullableString(payload.class_year) ??
      "JR",
    eligibility_remaining:
      toNullableNumber(normalizedPlayer.eligibility_remaining) ??
      toNullableNumber(payload.eligibility_remaining) ??
      1,
    stars: toNullableNumber(normalizedPlayer.stars) ?? toNullableNumber(payload.stars),
    academic_status:
      toNullableString(normalizedPlayer.academic_status) ??
      toNullableString(payload.academic_status) ??
      null,
    status: "Portal",
    film_url:
      toNullableString(normalizedPlayer.film_url) ??
      toNullableString(payload.film_url) ??
      null,
    photo_url:
      toNullableString(normalizedPlayer.photo_url) ??
      toNullableString(payload.photo_url) ??
      null,
    x_handle:
      toNullableString(normalizedPlayer.x_handle) ??
      toNullableString(payload.x_handle) ??
      null,
    x_user_id:
      toNullableString(normalizedPlayer.x_user_id) ??
      toNullableString(payload.x_user_id) ??
      null,
    contact_window:
      toNullableString(normalizedPlayer.contact_window) ??
      toNullableString(payload.contact_window) ??
      null,
    notes:
      toNullableString(normalizedPlayer.notes) ??
      toNullableString(payload.notes) ??
      null,
    sportradar_id: row.external_player_id,
    portal_source:
      toNullableString(normalizedPlayer.portal_source) ??
      row.source,
    portal_source_player_id:
      toNullableString(normalizedPlayer.portal_source_player_id) ??
      row.external_player_id,
    portal_entry_updated_at: row.source_updated_at,
    portal_last_synced_at: nowIso(),
    portal_removed_at: null,
    active_in_portal: row.active_in_portal,
    first_seen_at: row.first_seen_at,
    last_seen_at: row.last_seen_at,
    pff_enrichment_status: "completed",
  };
}

function pickExistingStatsRow(row: QueueRow, season: number) {
  const normalizedPayload = asRecord(row.normalized_payload);
  const statsRows = asArray<Record<string, unknown>>(normalizedPayload.stats_rows);
  return (
    statsRows.find((statsRow) => toNullableNumber(statsRow.season) === season) ??
    statsRows.find((statsRow) => toNullableNumber(statsRow.season) != null) ??
    null
  );
}

function mapStatsPositionGroup(positionGroup: string | null, resultPositionGroup: string) {
  if (positionGroup) return positionGroup as DbPlayerStatsInsert["position_group"];
  return resultPositionGroup === "EDGE_DL"
    ? ("EDGE" as DbPlayerStatsInsert["position_group"])
    : (resultPositionGroup as DbPlayerStatsInsert["position_group"]);
}

function mapStatsUpsert(
  row: QueueRow,
  playerId: string,
  season: number,
  result: ScraperResult
): DbPlayerStatsInsert {
  const existing = pickExistingStatsRow(row, season) ?? {};
  const usage = result.stats.usage_splits;
  const alignment = result.stats.snap_alignment;
  const positional = result.stats.position_specific;
  const normalizedPayload = asRecord(row.normalized_payload);

  return {
    player_id: playerId,
    season,
    season_type: toNullableString(existing.season_type) ?? "regular",
    position_group: mapStatsPositionGroup(row.position_group, result.position_group),
    games_played: toNullableNumber(existing.games_played),
    starts: toNullableNumber(existing.starts),
    offensive_snaps: usage.offense ?? toNullableNumber(existing.offensive_snaps),
    defensive_snaps: usage.defense ?? toNullableNumber(existing.defensive_snaps),
    special_teams_snaps: usage.special_teams ?? toNullableNumber(existing.special_teams_snaps),
    passing_attempts: toNullableNumber(existing.passing_attempts),
    passing_completions: toNullableNumber(existing.passing_completions),
    passing_yards: toNullableNumber(existing.passing_yards),
    passing_tds: toNullableNumber(existing.passing_tds),
    interceptions_thrown: toNullableNumber(existing.interceptions_thrown),
    rushing_attempts: toNullableNumber(existing.rushing_attempts),
    rushing_yards: toNullableNumber(existing.rushing_yards),
    rushing_tds: toNullableNumber(existing.rushing_tds),
    receptions: positional.receptions ?? toNullableNumber(existing.receptions),
    targets: positional.targets ?? toNullableNumber(existing.targets),
    receiving_yards: positional.yards ?? toNullableNumber(existing.receiving_yards),
    receiving_tds: toNullableNumber(existing.receiving_tds),
    total_touchdowns: toNullableNumber(existing.total_touchdowns),
    tackles: toNullableNumber(existing.tackles),
    tackles_for_loss: toNullableNumber(existing.tackles_for_loss),
    sacks: positional.sacks ?? toNullableNumber(existing.sacks),
    forced_fumbles: toNullableNumber(existing.forced_fumbles),
    fumbles_recovered: toNullableNumber(existing.fumbles_recovered),
    quarterback_hurries: toNullableNumber(existing.quarterback_hurries),
    run_stops: toNullableNumber(existing.run_stops),
    interceptions: positional.interceptions ?? toNullableNumber(existing.interceptions),
    passes_defended: positional.pass_breakups ?? toNullableNumber(existing.passes_defended),
    snaps_slot: positional.slot_snaps ?? alignment.slot ?? toNullableNumber(existing.snaps_slot),
    snaps_box: alignment.box ?? toNullableNumber(existing.snaps_box),
    snaps_boundary: alignment.corner ?? toNullableNumber(existing.snaps_boundary),
    snaps_inline: alignment.inline ?? toNullableNumber(existing.snaps_inline),
    snaps_wide: positional.wide_snaps ?? alignment.wide ?? toNullableNumber(existing.snaps_wide),
    snaps_pass_rush: usage.pass_rush ?? alignment.pass_rush ?? toNullableNumber(existing.snaps_pass_rush),
    snaps_run_defense: usage.run_defense ?? alignment.run_defense ?? toNullableNumber(existing.snaps_run_defense),
    source: toNullableString(existing.source) ?? row.source,
    source_player_id: row.external_player_id,
    source_updated_at: row.source_updated_at,
    stat_profile_used:
      row.stat_profile_used ??
      toNullableString(normalizedPayload.stat_profile_used) ??
      deriveStatProfileUsed(mapStatsPositionGroup(row.position_group, result.position_group)),
    alignment_data: result.stats.snap_alignment as never,
    raw_stats_json: result as never,
    pff_enrichment_status: "completed",
    active_in_portal: row.active_in_portal,
    first_seen_at: row.first_seen_at,
    last_seen_at: row.last_seen_at,
  };
}

async function markRowFailed(row: QueueRow, message: string) {
  const { error } = await supabase
    .from("portal_ingestion_queue" as never)
    .update({
      status: "failed",
      pff_enrichment_status: "failed",
      locked_at: null,
      locked_by: null,
      completed_at: nowIso(),
      error_message: message,
    } as never)
    .eq("id", row.id);

  if (error) {
    throw new Error(`Failed marking queue row ${row.id} as failed: ${error.message}`);
  }
}

async function finalizeSuccess(row: QueueRow, playerId: string, result: ScraperResult) {
  const { error } = await supabase
    .from("portal_ingestion_queue" as never)
    .update({
      player_id: playerId,
      pipeline_stage: "sync",
      status: "complete",
      pff_enrichment_status: "completed",
      locked_at: null,
      locked_by: null,
      completed_at: nowIso(),
      error_message: null,
      enrichment_payload: {
        scraped_result: result,
        completed_at: nowIso(),
      } as never,
      raw_stats_json: result as never,
      alignment_data: result.stats.snap_alignment as never,
    } as never)
    .eq("id", row.id);

  if (error) {
    throw new Error(`Failed finalizing queue row ${row.id}: ${error.message}`);
  }
}

async function syncSuccessfulResult(row: QueueRow, result: ScraperResult) {
  const season = scrapeSeasonForRow(row);
  const playerUpsert = mapPlayerUpsert(row, result);
  const playerId = playerUpsert.id ?? row.player_id ?? crypto.randomUUID();
  playerUpsert.id = playerId;
  const statsUpsert = mapStatsUpsert(row, playerId, season, result);

  const { error: playerError } = await supabase
    .from("players" as never)
    .upsert(playerUpsert as never, { onConflict: "id" });

  if (playerError) {
    throw new Error(`Player upsert failed for queue row ${row.id}: ${playerError.message}`);
  }

  const { error: statsError } = await supabase
    .from("player_stats" as never)
    .upsert(statsUpsert as never, { onConflict: "player_id,season" });

  if (statsError) {
    throw new Error(`player_stats upsert failed for queue row ${row.id}: ${statsError.message}`);
  }

  await finalizeSuccess(row, playerId, result);
}

async function processSeasonGroup(rows: QueueRow[], season: number) {
  let results: ScraperResult[];

  try {
    results = await runScraperForSeason(rows, season);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown Playwright enrichment failure";
    for (const row of rows) {
      await markRowFailed(row, message);
    }
    return { completed: 0, failed: rows.length };
  }

  let completed = 0;
  let failed = 0;

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const result = results[index];

    try {
      if (result.status !== "ok") {
        await markRowFailed(row, result.error ?? `Scraper returned status=${result.status}`);
        failed += 1;
        continue;
      }

      await syncSuccessfulResult(row, result);
      completed += 1;
    } catch (error) {
      await markRowFailed(
        row,
        error instanceof Error ? error.message : "Unknown sync failure"
      );
      failed += 1;
    }
  }

  return { completed, failed };
}

async function main() {
  const queuedCount = await countQueuedRows();

  if (queuedCount < MIN_QUEUE_SIZE) {
    console.log(
      JSON.stringify(
        {
          queued_count: queuedCount,
          claimed: 0,
          completed: 0,
          failed: 0,
          message: `Queued enrichment rows below threshold (${MIN_QUEUE_SIZE}).`,
        },
        null,
        2
      )
    );
    return;
  }

  const claimed = await claimQueuedRows(CLAIM_BATCH_SIZE);

  if (!claimed.length) {
    console.log(
      JSON.stringify(
        {
          queued_count: queuedCount,
          claimed: 0,
          completed: 0,
          failed: 0,
          message: "No queued rows were claimed.",
        },
        null,
        2
      )
    );
    return;
  }

  const seasonGroups = new Map<number, QueueRow[]>();
  for (const row of claimed) {
    const season = scrapeSeasonForRow(row);
    seasonGroups.set(season, [...(seasonGroups.get(season) ?? []), row]);
  }

  let completed = 0;
  let failed = 0;

  for (const [season, rows] of seasonGroups.entries()) {
    const outcome = await processSeasonGroup(rows, season);
    completed += outcome.completed;
    failed += outcome.failed;
  }

  console.log(
    JSON.stringify(
      {
        queued_count: queuedCount,
        claimed: claimed.length,
        completed,
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
