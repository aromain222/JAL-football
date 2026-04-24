import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database.types";
import {
  eligibilityRemaining,
  fetchTransferPortal,
  mapSportradarPosition,
  parseBirthPlace,
  type SportradarTransferPortalPlayer,
} from "@/lib/sportradar/transfer-portal";
import {
  fetchPlayerProfile,
  type SportradarPlayerProfile,
  type SportradarSeason,
  type SportradarSeasonStats,
} from "@/lib/sportradar/player-profile";

export const PORTAL_SOURCE = "sportradar_transfer_portal";
export const PORTAL_QUEUE_STAGES = ["normalize", "enrich", "sync"] as const;
export const PORTAL_QUEUE_STATUSES = ["pending", "processing", "complete", "retry", "failed", "skipped"] as const;
export const PFF_ENRICHMENT_STATUSES = ["pending", "queued", "in_progress", "completed", "not_found", "failed", "skipped"] as const;

export type PortalQueueStage = (typeof PORTAL_QUEUE_STAGES)[number];
export type PortalQueueStatus = (typeof PORTAL_QUEUE_STATUSES)[number];
export type PffEnrichmentStatus = (typeof PFF_ENRICHMENT_STATUSES)[number];
export type DbPlayerRow = Database["public"]["Tables"]["players"]["Row"];
export type DbPlayerInsert = Database["public"]["Tables"]["players"]["Insert"];
export type DbPlayerMeasurementInsert = Database["public"]["Tables"]["player_measurements"]["Insert"];
export type DbPlayerStatsInsert = Database["public"]["Tables"]["player_stats"]["Insert"];
export type DbPortalQueueRow = Database["public"]["Tables"]["portal_ingestion_queue"]["Row"];
export type DbPortalQueueInsert = Database["public"]["Tables"]["portal_ingestion_queue"]["Insert"];
type PositionGroup = DbPlayerInsert["position"];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const apiKey = process.env.SPORTRADAR_API_KEY ?? process.env.SPORTS_RADAR_API_KEY;
const accessLevel = (process.env.SPORTRADAR_ACCESS_LEVEL as "trial" | "production") || "trial";
const baseUrl = process.env.SPORTRADAR_BASE_URL;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

export const transferYear = Number(process.env.TRANSFER_YEAR) || new Date().getFullYear();

export const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export function requireSportradarConfig() {
  if (!apiKey) {
    throw new Error("Missing SPORTRADAR_API_KEY (or SPORTS_RADAR_API_KEY)");
  }

  return {
    apiKey,
    accessLevel,
    ...(baseUrl ? { baseUrl } : {}),
  };
}

export function createWorkerId(scriptName: string) {
  return `${scriptName}:${process.pid}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function parseTimestamp(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function chunk<T>(items: T[], size: number) {
  if (size <= 0) return [items];
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stableJson(value: Json): Json {
  if (Array.isArray(value)) return value.map((item) => stableJson(item as Json));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nestedValue]) => [key, stableJson((nestedValue ?? null) as Json)])
    );
  }
  return value;
}

export function hashJson(value: Json) {
  return crypto.createHash("sha256").update(JSON.stringify(stableJson(value))).digest("hex");
}

export function deriveStatProfileUsed(positionGroup: PositionGroup | null | undefined) {
  switch (positionGroup) {
    case "QB":
      return "qb_passing";
    case "RB":
      return "skill_rusher";
    case "WR":
    case "TE":
      return "skill_receiver";
    case "OL":
      return "offensive_line";
    case "EDGE":
      return "front_pass_rush";
    case "DL":
      return "front_run_defense";
    case "LB":
      return "box_defender";
    case "CB":
    case "S":
      return "coverage_defender";
    case "ST":
      return "special_teams";
    default:
      return "generic";
  }
}

export function buildPortalPayload(player: SportradarTransferPortalPlayer, currentTransferYear = transferYear) {
  const positionGroup = mapSportradarPosition(player.position);
  const birthPlace = parseBirthPlace(player.birth_place);
  return {
    transfer_year: currentTransferYear,
    sportradar_id: player.id,
    updated: parseTimestamp(player.updated),
    first_name: player.first_name,
    last_name: player.last_name,
    full_name: player.full_name,
    position: player.position,
    position_group: positionGroup,
    height_in: player.height || null,
    weight_lbs: player.weight ? Math.round(player.weight) : null,
    eligibility: player.eligibility ?? null,
    eligibility_remaining: eligibilityRemaining(player.eligibility),
    hometown: birthPlace.hometown,
    state: birthPlace.state,
    birth_place: player.birth_place ?? null,
  } satisfies Json;
}

export function mapPortalPlayerToPlayerInsert(
  player: SportradarTransferPortalPlayer,
  existingPlayer: Pick<
    DbPlayerRow,
    | "id"
    | "first_seen_at"
    | "previous_school"
    | "conference"
    | "photo_url"
    | "x_handle"
    | "x_user_id"
    | "notes"
    | "pff_enrichment_status"
  > | null,
  currentTransferYear = transferYear,
  seenAt = nowIso()
): DbPlayerInsert {
  const positionGroup = mapSportradarPosition(player.position);
  const { hometown, state } = parseBirthPlace(player.birth_place);

  return {
    id: existingPlayer?.id ?? crypto.randomUUID(),
    first_name: player.first_name,
    last_name: player.last_name,
    position: positionGroup,
    position_group: positionGroup,
    transfer_year: currentTransferYear,
    current_school: "Transfer Portal",
    conference: existingPlayer?.conference ?? null,
    previous_school: existingPlayer?.previous_school ?? null,
    hometown,
    state,
    class_year: player.eligibility ?? "JR",
    eligibility_remaining: eligibilityRemaining(player.eligibility),
    stars: null,
    academic_status: null,
    status: "Portal",
    film_url: null,
    photo_url: existingPlayer?.photo_url ?? null,
    x_handle: existingPlayer?.x_handle ?? null,
    x_user_id: existingPlayer?.x_user_id ?? null,
    contact_window: null,
    notes: existingPlayer?.notes ?? null,
    sportradar_id: player.id,
    portal_source: PORTAL_SOURCE,
    portal_source_player_id: player.id,
    portal_entry_updated_at: parseTimestamp(player.updated),
    portal_last_synced_at: seenAt,
    portal_removed_at: null,
    active_in_portal: true,
    first_seen_at: existingPlayer?.first_seen_at ?? seenAt,
    last_seen_at: seenAt,
    pff_enrichment_status: existingPlayer?.pff_enrichment_status ?? "pending",
  };
}

export function mapPortalPlayerToMeasurement(
  playerId: string,
  player: SportradarTransferPortalPlayer
): DbPlayerMeasurementInsert | null {
  if (!player.height || !player.weight) return null;

  return {
    player_id: playerId,
    height_in: player.height,
    weight_lbs: Math.round(player.weight),
    arm_length_in: null,
    forty_time: null,
    shuttle_time: null,
    vertical_jump: null,
    wing_span_in: null,
    verified_at: null,
  };
}

export function buildQueueRow(
  args: {
    externalPlayerId: string;
    playerId: string;
    payload: Json;
    positionGroup: PositionGroup;
    existingQueue: Pick<
      DbPortalQueueRow,
      "first_seen_at" | "status" | "pipeline_stage" | "pff_enrichment_status" | "payload_hash"
    > | null;
    currentTransferYear?: number;
    seenAt?: string;
    sourceUpdatedAt?: string | null;
    priority?: number;
  }
): DbPortalQueueInsert {
  const seenAt = args.seenAt ?? nowIso();
  const currentTransferYear = args.currentTransferYear ?? transferYear;
  const payloadHash = hashJson(args.payload);
  const payloadChanged = payloadHash !== args.existingQueue?.payload_hash;

  return {
    source: PORTAL_SOURCE,
    external_player_id: args.externalPlayerId,
    player_id: args.playerId,
    transfer_year: currentTransferYear,
    position_group: args.positionGroup,
    pipeline_stage: payloadChanged ? "normalize" : (args.existingQueue?.pipeline_stage ?? "normalize"),
    status: payloadChanged ? "pending" : (args.existingQueue?.status ?? "pending"),
    priority: args.priority ?? 100,
    attempt_count: 0,
    max_attempts: 5,
    next_attempt_at: seenAt,
    last_attempt_at: null,
    started_at: null,
    completed_at: null,
    locked_at: null,
    locked_by: null,
    error_message: null,
    payload_hash: payloadHash,
    payload: args.payload,
    normalized_payload: {},
    enrichment_payload: {},
    raw_stats_json: {},
    alignment_data: {},
    metadata: {},
    stat_profile_used: deriveStatProfileUsed(args.positionGroup),
    pff_enrichment_status: args.existingQueue?.pff_enrichment_status ?? "pending",
    active_in_portal: true,
    first_seen_at: args.existingQueue?.first_seen_at ?? seenAt,
    last_seen_at: seenAt,
    source_updated_at: args.sourceUpdatedAt ?? null,
  };
}

export async function fetchPortalPlayers() {
  return fetchTransferPortal(requireSportradarConfig());
}

export async function fetchProfileWithRetry(playerId: string, maxRetries = 2) {
  let attempt = 0;
  while (true) {
    try {
      return await fetchPlayerProfile(playerId, requireSportradarConfig());
    } catch (error) {
      attempt += 1;
      if (attempt > maxRetries) throw error;
      await sleep(2_000 * attempt);
    }
  }
}

export function teamDisplayName(team: { market?: string; name?: string } | null | undefined) {
  if (!team) return null;
  const parts = [team.market, team.name].filter(Boolean);
  return parts.length ? parts.join(" ") : null;
}

export function chooseRelevantSeason(profile: SportradarPlayerProfile, currentTransferYear = transferYear) {
  const seasons = [...(profile.seasons ?? [])].sort((left, right) => right.year - left.year);
  return (
    seasons.find((season) => season.year <= currentTransferYear - 1 && season.teams?.some((team) => team.statistics)) ??
    seasons.find((season) => season.teams?.some((team) => team.statistics)) ??
    null
  );
}

function getTeamStats(season: SportradarSeason): SportradarSeasonStats | undefined {
  return season.teams?.find((team) => team.statistics)?.statistics;
}

export function mapSeasonStatsToRow(args: {
  playerId: string;
  season: SportradarSeason;
  positionGroup: PositionGroup;
  statProfileUsed: string;
  activeInPortal: boolean;
  firstSeenAt: string;
  lastSeenAt: string;
  sourcePlayerId: string;
}): DbPlayerStatsInsert {
  const statistics = getTeamStats(args.season);
  const passing = statistics?.passing;
  const rushing = statistics?.rushing;
  const receiving = statistics?.receiving;
  const defense = statistics?.defense;
  const totalTouchdowns =
    (passing?.touchdowns ?? 0) + (rushing?.touchdowns ?? 0) + (receiving?.touchdowns ?? 0);

  return {
    player_id: args.playerId,
    season: args.season.year,
    season_type: args.season.type?.toLowerCase() || "regular",
    position_group: args.positionGroup,
    games_played: statistics?.games_played ?? null,
    starts: statistics?.games_started ?? null,
    offensive_snaps: null,
    defensive_snaps: null,
    special_teams_snaps: null,
    passing_attempts: passing?.attempts ?? null,
    passing_completions: passing?.completions ?? null,
    passing_yards: passing?.yards ?? null,
    passing_tds: passing?.touchdowns ?? null,
    interceptions_thrown: passing?.interceptions ?? null,
    rushing_attempts: rushing?.attempts ?? null,
    rushing_yards: rushing?.yards ?? null,
    rushing_tds: rushing?.touchdowns ?? null,
    receptions: receiving?.receptions ?? null,
    targets: null,
    receiving_yards: receiving?.yards ?? null,
    receiving_tds: receiving?.touchdowns ?? null,
    total_touchdowns: totalTouchdowns || null,
    tackles: defense?.combined ?? defense?.tackles ?? null,
    tackles_for_loss: null,
    sacks: defense?.sacks != null ? Number(defense.sacks) : null,
    forced_fumbles: null,
    fumbles_recovered: null,
    quarterback_hurries: null,
    run_stops: null,
    interceptions: defense?.interceptions ?? null,
    passes_defended: defense?.passes_defended ?? null,
    snaps_slot: null,
    snaps_box: null,
    snaps_boundary: null,
    snaps_inline: null,
    snaps_wide: null,
    snaps_pass_rush: null,
    snaps_run_defense: null,
    source: PORTAL_SOURCE,
    source_player_id: args.sourcePlayerId,
    source_updated_at: null,
    stat_profile_used: args.statProfileUsed,
    alignment_data: {},
    raw_stats_json: (statistics ?? {}) as Json,
    pff_enrichment_status: "pending",
    active_in_portal: args.activeInPortal,
    first_seen_at: args.firstSeenAt,
    last_seen_at: args.lastSeenAt,
  };
}

export function buildNormalizedPayload(args: {
  queue: Pick<DbPortalQueueRow, "payload" | "player_id" | "external_player_id" | "position_group" | "first_seen_at" | "last_seen_at" | "transfer_year">;
  profile: SportradarPlayerProfile | null;
}) {
  const payload = (args.queue.payload ?? {}) as Record<string, Json>;
  const positionGroup = (args.queue.position_group ?? payload.position_group ?? "LB") as PositionGroup;
  const statProfileUsed = deriveStatProfileUsed(positionGroup);
  const profile = args.profile;
  const birthPlace = parseBirthPlace(profile?.birth_place);
  const previousSchool = teamDisplayName(profile?.team);
  const seasons = profile?.seasons ?? [];

  const statsRows = seasons
    .filter((season: SportradarSeason) => season.teams?.some((team) => team.statistics))
    .map((season: SportradarSeason) =>
      mapSeasonStatsToRow({
        playerId: args.queue.player_id!,
        season,
        positionGroup,
        statProfileUsed,
        activeInPortal: true,
        firstSeenAt: args.queue.first_seen_at,
        lastSeenAt: args.queue.last_seen_at,
        sourcePlayerId: args.queue.external_player_id,
      })
    );

  return {
    player: {
      id: args.queue.player_id,
      first_name: (payload.first_name as string | null) ?? profile?.first_name ?? "",
      last_name: (payload.last_name as string | null) ?? profile?.last_name ?? "",
      position: positionGroup,
      position_group: positionGroup,
      previous_school: previousSchool,
      current_school: "Transfer Portal",
      class_year: profile?.eligibility ?? payload.eligibility ?? null,
      eligibility_remaining: profile?.eligibility
        ? eligibilityRemaining(profile.eligibility)
        : (payload.eligibility_remaining as number | null) ?? null,
      hometown: birthPlace.hometown ?? (payload.hometown as string | null) ?? null,
      state: birthPlace.state ?? (payload.state as string | null) ?? null,
      active_in_portal: true,
      first_seen_at: args.queue.first_seen_at,
      last_seen_at: args.queue.last_seen_at,
      portal_last_synced_at: nowIso(),
      pff_enrichment_status: "queued" as PffEnrichmentStatus,
    },
    measurement: {
      player_id: args.queue.player_id,
      height_in: profile?.height ?? ((payload.height_in as number | null) ?? null),
      weight_lbs: profile?.weight ?? ((payload.weight_lbs as number | null) ?? null),
      arm_length_in: null,
      forty_time: null,
      shuttle_time: null,
      vertical_jump: null,
      wing_span_in: null,
      verified_at: null,
    },
    stat_profile_used: statProfileUsed,
    stats_rows: statsRows,
    raw_stats_json: (profile?.seasons ?? []) as unknown as Json,
    selected_season_year:
      chooseRelevantSeason(profile ?? ({ seasons: [] } as unknown as SportradarPlayerProfile), args.queue.transfer_year)?.year ??
      null,
  } satisfies Json;
}

export function buildAlignmentDataFromPffRow(row: Record<string, unknown>) {
  const entries = Object.entries(row)
    .filter(([key, value]) => key.startsWith("snaps_") && typeof value === "number" && Number.isFinite(value))
    .sort(([left], [right]) => left.localeCompare(right));

  return Object.fromEntries(
    entries.map(([key, value]) => [key.replace(/^snaps_/, ""), value])
  ) as Json;
}

export function computeRetryAt(attemptCount: number, baseDelayMs = 5 * 60_000) {
  return new Date(Date.now() + Math.max(1, attemptCount) * baseDelayMs).toISOString();
}

export async function claimQueueBatch(stage: PortalQueueStage, batchSize: number, workerId: string) {
  const { data, error } = await supabase.rpc("claim_portal_ingestion_queue" as never, {
    p_pipeline_stage: stage,
    p_batch_size: batchSize,
    p_worker_id: workerId,
  } as never);

  if (error) {
    throw new Error(`Failed to claim queue batch for stage=${stage}: ${error.message}`);
  }

  return (data ?? []) as DbPortalQueueRow[];
}
