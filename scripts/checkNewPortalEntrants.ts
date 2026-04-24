import {
  PORTAL_SOURCE,
  buildPortalPayload,
  buildQueueRow,
  chunk,
  fetchPortalPlayers,
  mapPortalPlayerToMeasurement,
  mapPortalPlayerToPlayerInsert,
  nowIso,
  supabase,
  transferYear,
} from "@/scripts/lib/portal-pipeline";
import { mapSportradarPosition, type SportradarTransferPortalPlayer } from "@/lib/sportradar/transfer-portal";

type ExistingPlayer = {
  id: string;
  sportradar_id: string | null;
  first_name: string;
  last_name: string;
  position: string;
  position_group: string | null;
  current_school: string | null;
  first_seen_at: string;
  last_seen_at: string;
  previous_school: string | null;
  conference: string | null;
  photo_url: string | null;
  x_handle: string | null;
  x_user_id: string | null;
  notes: string | null;
  pff_enrichment_status: string;
  portal_source: string | null;
  active_in_portal: boolean;
  status: string | null;
};

type ExistingQueue = {
  source: string;
  external_player_id: string;
  first_seen_at: string;
  status: string;
  pipeline_stage: string;
  pff_enrichment_status: string;
  payload_hash: string;
};

function normalizeString(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/['’.(),]/g, "")
    .replace(/&/g, " and ")
    .replace(/\bjunior\b/g, "jr")
    .replace(/\bsenior\b/g, "sr")
    .replace(/\bsaint\b/g, "st")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizedPlayerKey(fullName: string, position: string | null | undefined) {
  return `${normalizeString(fullName)}::${normalizeString(position)}`;
}

function chooseBestExistingPlayer(
  entrantsPlayer: SportradarTransferPortalPlayer,
  candidates: ExistingPlayer[]
) {
  if (!candidates.length) return null;

  const targetPosition = mapSportradarPosition(entrantsPlayer.position);
  return [...candidates].sort((left, right) => {
    const leftPositionMatch = (left.position_group ?? left.position) === targetPosition ? 1 : 0;
    const rightPositionMatch = (right.position_group ?? right.position) === targetPosition ? 1 : 0;
    if (rightPositionMatch !== leftPositionMatch) return rightPositionMatch - leftPositionMatch;

    const leftActive = left.active_in_portal ? 1 : 0;
    const rightActive = right.active_in_portal ? 1 : 0;
    if (rightActive !== leftActive) return rightActive - leftActive;

    const leftCommitted = left.status?.toLowerCase() === "committed" ? 0 : 1;
    const rightCommitted = right.status?.toLowerCase() === "committed" ? 0 : 1;
    if (rightCommitted !== leftCommitted) return rightCommitted - leftCommitted;

    return Date.parse(right.last_seen_at) - Date.parse(left.last_seen_at);
  })[0] ?? null;
}

async function main() {
  const seenAt = nowIso();
  const portal = await fetchPortalPlayers();
  const entrants = portal.league.transfer_portal_players;

  if (!entrants.length) {
    console.log("No transfer portal entrants returned by Sportradar.");
    return;
  }

  const sportradarIds = entrants.map((player) => player.id);
  const [{ data: existingPlayers, error: playersError }, { data: existingQueues, error: queueError }] =
    await Promise.all([
      supabase
        .from("players")
        .select(
          "id, sportradar_id, first_name, last_name, position, position_group, current_school, first_seen_at, last_seen_at, previous_school, conference, photo_url, x_handle, x_user_id, notes, pff_enrichment_status, portal_source, active_in_portal, status"
        ),
      supabase
        .from("portal_ingestion_queue")
        .select("source, external_player_id, first_seen_at, status, pipeline_stage, pff_enrichment_status, payload_hash")
        .eq("source", PORTAL_SOURCE)
        .in("external_player_id", sportradarIds),
    ]);

  if (playersError) throw playersError;
  if (queueError) throw queueError;

  const playerBySportradarId = new Map<string, ExistingPlayer>();
  const playersByNormalizedKey = new Map<string, ExistingPlayer[]>();
  for (const row of (existingPlayers ?? []) as ExistingPlayer[]) {
    if (row.sportradar_id) playerBySportradarId.set(row.sportradar_id, row as ExistingPlayer);
    const key = normalizedPlayerKey(`${row.first_name} ${row.last_name}`, row.position_group ?? row.position);
    const existing = playersByNormalizedKey.get(key) ?? [];
    existing.push(row as ExistingPlayer);
    playersByNormalizedKey.set(key, existing);
  }

  const queueByExternalId = new Map<string, ExistingQueue>();
  for (const row of (existingQueues ?? []) as ExistingQueue[]) {
    queueByExternalId.set(row.external_player_id, row as ExistingQueue);
  }

  const resolvedExistingByEntrantId = new Map<string, ExistingPlayer | null>();
  for (const player of entrants) {
    const exact = playerBySportradarId.get(player.id) ?? null;
    if (exact) {
      resolvedExistingByEntrantId.set(player.id, exact);
      continue;
    }

    const key = normalizedPlayerKey(player.full_name, mapSportradarPosition(player.position));
    const nameCandidates = playersByNormalizedKey.get(key) ?? [];
    resolvedExistingByEntrantId.set(player.id, chooseBestExistingPlayer(player, nameCandidates));
  }

  const playerRows = entrants.map((player) =>
    mapPortalPlayerToPlayerInsert(player, resolvedExistingByEntrantId.get(player.id) ?? null, transferYear, seenAt)
  );

  const playerRowsBySportradarId = new Map(playerRows.map((row) => [row.sportradar_id ?? "", row]));
  const seenExistingIds = new Set(
    [...resolvedExistingByEntrantId.values()]
      .filter((row): row is ExistingPlayer => Boolean(row?.id))
      .map((row) => row.id)
  );

  for (const batch of chunk(playerRows, 250)) {
    const { error } = await supabase.from("players" as never).upsert(batch as never, { onConflict: "id" });
    if (error) throw error;
  }

  const measurementRows = playerRows
    .map((row) => {
        const source = row.sportradar_id ? entrants.find((player) => player.id === row.sportradar_id) : null;
        if (!source || !row.id) return null;
        return mapPortalPlayerToMeasurement(row.id, source);
      })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  for (const batch of chunk(measurementRows, 250)) {
    const { error } = await supabase
      .from("player_measurements" as never)
      .upsert(batch as never, { onConflict: "player_id" });
    if (error) throw error;
  }

  const newQueueRows = entrants
    .filter((player) => !queueByExternalId.has(player.id))
    .map((player) => {
      const mappedPlayer = playerRowsBySportradarId.get(player.id);
      if (!mappedPlayer?.id) throw new Error(`Mapped player missing for sportradar_id=${player.id}`);
      const payload = buildPortalPayload(player, transferYear);
      return buildQueueRow({
        externalPlayerId: player.id,
        playerId: mappedPlayer.id,
        payload,
        positionGroup: mappedPlayer.position,
        existingQueue: null,
        currentTransferYear: transferYear,
        seenAt,
        sourceUpdatedAt: mappedPlayer.portal_entry_updated_at,
      });
    });

  for (const batch of chunk(newQueueRows, 250)) {
    if (!batch.length) continue;
    const { error } = await supabase.from("portal_ingestion_queue" as never).insert(batch as never);
    if (error) throw error;
  }

  const existingQueueIds = entrants
    .filter((player) => queueByExternalId.has(player.id))
    .map((player) => player.id);

  for (const batch of chunk(existingQueueIds, 250)) {
    if (!batch.length) continue;
    const { error } = await supabase
      .from("portal_ingestion_queue" as never)
      .update({
        active_in_portal: true,
        last_seen_at: seenAt,
        error_message: null,
      } as never)
      .eq("source", PORTAL_SOURCE)
      .in("external_player_id", batch);
    if (error) throw error;
  }

  for (const player of entrants) {
    const mappedPlayer = playerRowsBySportradarId.get(player.id);
    if (!mappedPlayer?.id || !queueByExternalId.has(player.id)) continue;
    const { error } = await supabase
      .from("portal_ingestion_queue" as never)
      .update({
        player_id: mappedPlayer.id,
        active_in_portal: true,
        last_seen_at: seenAt,
        error_message: null,
      } as never)
      .eq("source", PORTAL_SOURCE)
      .eq("external_player_id", player.id);
    if (error) throw error;
  }

  const missingCommittedIds = ((existingPlayers ?? []) as ExistingPlayer[])
    .filter(
      (row) =>
        row.portal_source === PORTAL_SOURCE &&
        row.active_in_portal &&
        row.status?.toLowerCase() === "committed" &&
        !seenExistingIds.has(row.id) &&
        !(row.sportradar_id && sportradarIds.includes(row.sportradar_id))
    )
    .map((row) => row.id);

  for (const batch of chunk(missingCommittedIds, 250)) {
    if (!batch.length) continue;

    const { error: deactivatePlayersError } = await supabase
      .from("players" as never)
      .update({
        active_in_portal: false,
        portal_removed_at: seenAt,
      } as never)
      .in("id", batch);
    if (deactivatePlayersError) throw deactivatePlayersError;

    const { error: deactivateQueueError } = await supabase
      .from("portal_ingestion_queue" as never)
      .update({
        active_in_portal: false,
      } as never)
      .in("player_id", batch);
    if (deactivateQueueError) throw deactivateQueueError;
  }

  console.log(
    JSON.stringify(
      {
        entrants_seen: entrants.length,
        player_rows_upserted: playerRows.length,
        measurement_rows_upserted: measurementRows.length,
        queue_rows_inserted: newQueueRows.length,
        existing_players_matched_by_name: [...resolvedExistingByEntrantId.values()].filter(
          (row) => Boolean(row?.id && !row?.sportradar_id)
        ).length,
        committed_players_marked_inactive: missingCommittedIds.length,
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
