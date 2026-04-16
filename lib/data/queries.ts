import { unstable_noStore as noStore } from "next/cache";
import { cookies } from "next/headers";
import { getDemoState } from "@/lib/data/demo-store";
import { getConferenceForSchool } from "@/lib/football";
import { calculateFit } from "@/lib/scoring";
import {
  DashboardMetrics,
  Player,
  PlayerFitResult,
  PlayerPffGrade,
  PlayerSchemeContext,
  // PlayerPffGrade re-used as cast target for raw pffStats
  Profile,
  PlayerSourceNote,
  PlayersPageResult,
  ShortlistBoardItem,
  ShortlistItem,
  Team,
  TeamNeed
} from "@/lib/types";
import {
  createSupabaseAdminClient,
  createSupabaseDataClient,
  createSupabaseServerClient,
  hasSupabaseEnv,
  hasSupabaseServiceRoleEnv
} from "@/lib/supabase/server";
import { demoProfile, demoTeam } from "@/lib/data/demo";
import { resolveScheme } from "@/lib/scheme/registry";
import { selectFeaturedStats } from "@/lib/scheme/featuredStats";
import { computeSchemeDelta, generateSchemeSummary } from "@/lib/scheme/schemeFit";
import { detectArchetype } from "@/lib/archetypes";
import { choosePreferredPffRow } from "@/lib/pff/summary";
import { normalizeWorkspaceRole } from "@/lib/workspace-role";

export interface PlayerFilters {
  position?: string;
  search?: string;
  heightMin?: number;
  heightMax?: number;
  weightMin?: number;
  weightMax?: number;
  armLengthMin?: number;
  fortyMax?: number;
  classYear?: string;
  yearsRemaining?: number;
  yearsRemainingMin?: number;
  school?: string;
  conference?: string;
  minFit?: number;
  needId?: string;
  page?: number;
  pageSize?: number;
  archetype?: string;
}

function matchesSearch(player: Player, search?: string) {
  if (!search) return true;
  const haystack = `${player.first_name} ${player.last_name} ${player.current_school}`.toLowerCase();
  return haystack.includes(search.toLowerCase());
}

function deriveFullNameFromEmail(email?: string | null) {
  const local = email?.split("@")[0]?.trim();
  if (!local) return "Coach";

  return local
    .replace(/[._-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function resolveWorkspaceTeam(admin: ReturnType<typeof createSupabaseAdminClient>) {
  const defaultTeamId = process.env.DEFAULT_TEAM_ID;

  if (defaultTeamId) {
    const { data: explicitTeamRaw } = await admin
      .from("teams")
      .select("*")
      .eq("id", defaultTeamId)
      .maybeSingle();
    const explicitTeam = (explicitTeamRaw as Team | null) ?? null;
    if (explicitTeam) return explicitTeam;
  }

  const { data: firstTeamRaw } = await admin
    .from("teams")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return (firstTeamRaw as Team | null) ?? null;
}

function getDemoMetrics(): DashboardMetrics {
  const state = getDemoState();
  return {
    activeNeeds: state.needs.filter((need) => need.status === "active").length,
    totalPlayers: state.players.length,
    shortlistedPlayers: state.shortlists.length,
    recentReviews: state.reviews.length
  };
}

function logDataAccessIssue(scope: string, message: string) {
  console.error(`[data:${scope}] ${message}`);
}

async function isAnonymousWorkspaceRequest() {
  if (!hasSupabaseEnv()) return true;

  try {
    const supabase = createSupabaseServerClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    return !user;
  } catch {
    return true;
  }
}

export async function getViewerContext() {
  noStore();
  const roleOverride = normalizeWorkspaceRole(cookies().get("workspace-role")?.value);

  if (!hasSupabaseEnv()) {
    const state = getDemoState();
    return {
      profile: roleOverride ? { ...state.profile, role: roleOverride } : state.profile,
      team: state.team
    };
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    if (!hasSupabaseServiceRoleEnv()) {
      return { profile: demoProfile, team: demoTeam };
    }

    const admin = createSupabaseAdminClient();
    const defaultProfileId = process.env.DEFAULT_PROFILE_ID;

    let profile = null as Profile | null;
    if (defaultProfileId) {
      const { data: defaultProfileRaw } = await admin
        .from("profiles")
        .select("*")
        .eq("id", defaultProfileId)
        .maybeSingle();
      profile = (defaultProfileRaw as Profile | null) ?? null;
    }

    const team =
      profile
        ? ((await admin.from("teams").select("*").eq("id", profile.team_id).maybeSingle()).data as Team | null) ??
          null
        : await resolveWorkspaceTeam(admin);

    const resolvedProfile = profile
      ? profile
      : {
          ...demoProfile,
          team_id: (team ?? demoTeam).id
        };
    const resolvedTeam = team ?? demoTeam;

    return {
      profile: roleOverride
        ? { ...resolvedProfile, role: roleOverride }
        : resolvedProfile,
      team: resolvedTeam
    };
  }

  const { data: profileRaw } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  let profile = profileRaw as Profile | null;

  let team = null as Team | null;
  if (!profile && hasSupabaseServiceRoleEnv()) {
    const admin = createSupabaseAdminClient();
    const fallbackTeam = await resolveWorkspaceTeam(admin);

    if (fallbackTeam) {
      const provisionalProfile = {
        id: user.id,
        team_id: fallbackTeam.id,
        full_name: deriveFullNameFromEmail(user.email),
        role: "Coach"
      };

      const { data: insertedProfileRaw } = await supabase
        .from("profiles" as never)
        .insert(provisionalProfile as never)
        .select("*")
        .maybeSingle();

      profile = (insertedProfileRaw as Profile | null) ?? provisionalProfile;
      team = fallbackTeam;
    }
  }

  if (!team) {
    const teamId = profile?.team_id ?? demoTeam.id;
    const { data: teamRaw } = await supabase
      .from("teams")
      .select("*")
      .eq("id", teamId)
      .maybeSingle();
    team = (teamRaw as Team | null) ?? null;
  }

  return {
    profile:
      roleOverride
        ? { ...(profile ?? demoProfile), role: roleOverride }
        : profile ?? demoProfile,
    team: team ?? demoTeam
  };
}

export async function getWorkspaceMembers() {
  noStore();

  if (!hasSupabaseEnv()) {
    return [demoProfile];
  }

  try {
    const { team } = await getViewerContext();
    const supabase = createSupabaseDataClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("team_id", team.id)
      .order("created_at", { ascending: true });

    if (error) {
      logDataAccessIssue("workspace-members", error.message);
      return [demoProfile];
    }

    return (data as Profile[] | null) ?? [demoProfile];
  } catch (error) {
    logDataAccessIssue("workspace-members", error instanceof Error ? error.message : "unknown error");
    return [demoProfile];
  }
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  noStore();
  if (!hasSupabaseEnv()) {
    return getDemoMetrics();
  }

  const supabase = createSupabaseDataClient();
  const [
    { count: activeNeeds, error: activeNeedsError },
    { count: totalPlayers, error: totalPlayersError },
    { count: shortlistedPlayers, error: shortlistedPlayersError },
    { count: recentReviews, error: recentReviewsError }
  ] =
    await Promise.all([
      supabase.from("team_needs").select("*", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("players").select("*", { count: "exact", head: true }),
      supabase.from("shortlists").select("*", { count: "exact", head: true }),
      supabase
        .from("player_reviews")
        .select("*", { count: "exact", head: true })
        .gte("created_at", new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString())
    ]);

  const metricErrors = [
    activeNeedsError,
    totalPlayersError,
    shortlistedPlayersError,
    recentReviewsError
  ].filter(Boolean);

  if (metricErrors.length > 0) {
    logDataAccessIssue(
      "dashboard-metrics",
      metricErrors.map((error) => error?.message ?? "unknown error").join(" | ")
    );

    if (await isAnonymousWorkspaceRequest()) {
      return getDemoMetrics();
    }
  }

  if (
    (activeNeeds ?? 0) === 0 &&
    (totalPlayers ?? 0) === 0 &&
    (shortlistedPlayers ?? 0) === 0 &&
    (recentReviews ?? 0) === 0 &&
    await isAnonymousWorkspaceRequest()
  ) {
    logDataAccessIssue("dashboard-metrics", "All metrics resolved to zero for anonymous request; using demo fallback.");
    return getDemoMetrics();
  }

  return {
    activeNeeds: activeNeeds ?? 0,
    totalPlayers: totalPlayers ?? 0,
    shortlistedPlayers: shortlistedPlayers ?? 0,
    recentReviews: recentReviews ?? 0
  };
}

export async function getNeeds() {
  noStore();
  if (!hasSupabaseEnv()) {
    return getDemoState().needs;
  }

  try {
    const { team } = await getViewerContext();
    const supabase = createSupabaseDataClient();
    const { data, error } = await supabase
      .from("team_needs")
      .select("*")
      .eq("team_id", team.id)
      .order("created_at", { ascending: false });

    if (error) {
      logDataAccessIssue("needs", error.message);
      if (await isAnonymousWorkspaceRequest()) {
        return getDemoState().needs;
      }
    }

    if ((!data || data.length === 0) && await isAnonymousWorkspaceRequest()) {
      return getDemoState().needs;
    }

    return (data as TeamNeed[] | null) ?? [];
  } catch (error) {
    logDataAccessIssue("needs", error instanceof Error ? error.message : "unknown error");
    return await isAnonymousWorkspaceRequest() ? getDemoState().needs : [];
  }
}

export async function getNeedById(id: string) {
  const needs = await getNeeds();
  return needs.find((need) => need.id === id) ?? null;
}

export async function getPlayers(filters: PlayerFilters = {}) {
  noStore();
  const need = filters.needId ? await getNeedById(filters.needId) : null;
  const basePlayers = hasSupabaseEnv()
    ? await getPlayersFromSupabase(filters)
    : getDemoState().players;

  const filtered = filterPlayers(basePlayers, filters);

  if (!need) {
    if (filters.needId) {
      // needId was given but need couldn't be loaded (auth failure, rate limit, etc.)
      // Return empty array — callers expect PlayerFitResult[], not Player[]
      return [];
    }
    return filtered;
  }

  const scored = filtered.map((player) => calculateFit(player, need));
  return scored
    .filter((item) => item.fitScore >= (filters.minFit ?? 0))
    .sort((a, b) => b.fitScore - a.fitScore);
}

export async function getPlayersPage(
  filters: PlayerFilters = {}
): Promise<PlayersPageResult<Player | PlayerFitResult>> {
  noStore();
  const page = Math.max(filters.page ?? 1, 1);
  const pageSize = Math.min(Math.max(filters.pageSize ?? 24, 1), 48);
  const all = await getPlayers(filters);
  const total = all.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const items = await enrichPlayersPageWithPff(all.slice(start, start + pageSize));

  return {
    items,
    total,
    page,
    pageSize,
    totalPages
  };
}

async function enrichPlayersPageWithPff(
  items: Array<Player | PlayerFitResult>
): Promise<Array<Player | PlayerFitResult>> {
  if (!items.length || !hasSupabaseEnv()) return items;

  const players: Player[] = items.map((item) => ("player" in item ? item.player : item));
  const pffByPlayerId = await getBatchPffStatsForPlayers(players);

  return items.map((item) => {
    if ("player" in item) {
      return {
        ...item,
        player: {
          ...item.player,
          pffStats: (pffByPlayerId[item.player.id] as PlayerPffGrade | undefined) ?? null,
        },
      };
    }

    return {
      ...item,
      pffStats: (pffByPlayerId[item.id] as PlayerPffGrade | undefined) ?? null,
    };
  });
}

function filterPlayers(players: Player[], filters: PlayerFilters) {
  return players.filter((player) => {
    const measurements = player.measurements;
    const conference = player.conference ?? getConferenceForSchool(player.current_school);

    if (filters.position && player.position !== filters.position) return false;
    if (filters.classYear && player.class_year !== filters.classYear) return false;
    if (
      typeof filters.yearsRemaining === "number" &&
      player.eligibility_remaining !== filters.yearsRemaining
    ) {
      return false;
    }
    if (
      typeof filters.yearsRemainingMin === "number" &&
      player.eligibility_remaining < filters.yearsRemainingMin
    ) {
      return false;
    }
    if (filters.school && !player.current_school.toLowerCase().includes(filters.school.toLowerCase())) {
      return false;
    }
    if (
      filters.conference &&
      !conference.toLowerCase().includes(filters.conference.toLowerCase())
    ) {
      return false;
    }
    if (!matchesSearch(player, filters.search)) return false;

    if (
      typeof filters.heightMin === "number" &&
      measurements?.height_in !== null &&
      measurements?.height_in !== undefined &&
      measurements.height_in < filters.heightMin
    ) {
      return false;
    }
    if (
      typeof filters.heightMax === "number" &&
      measurements?.height_in !== null &&
      measurements?.height_in !== undefined &&
      measurements.height_in > filters.heightMax
    ) {
      return false;
    }
    if (
      typeof filters.weightMin === "number" &&
      measurements?.weight_lbs !== null &&
      measurements?.weight_lbs !== undefined &&
      measurements.weight_lbs < filters.weightMin
    ) {
      return false;
    }
    if (
      typeof filters.weightMax === "number" &&
      measurements?.weight_lbs !== null &&
      measurements?.weight_lbs !== undefined &&
      measurements.weight_lbs > filters.weightMax
    ) {
      return false;
    }
    if (
      typeof filters.armLengthMin === "number" &&
      measurements?.arm_length_in !== null &&
      measurements?.arm_length_in !== undefined &&
      measurements.arm_length_in < filters.armLengthMin
    ) {
      return false;
    }
    if (
      typeof filters.fortyMax === "number" &&
      measurements?.forty_time !== null &&
      measurements?.forty_time !== undefined &&
      measurements.forty_time > filters.fortyMax
    ) {
      return false;
    }

    if (filters.archetype) {
      const a = detectArchetype(player.position, measurements?.height_in, measurements?.weight_lbs);
      if (a !== filters.archetype) return false;
    }

    return true;
  });
}

async function getPlayersFromSupabase(filters: PlayerFilters = {}): Promise<Player[]> {
  const supabase = createSupabaseDataClient();
  let query = supabase
    .from("players")
    .select("*, player_measurements(*), player_stats(*), player_tags(tag)")
    .order("last_name");

  if (filters.position) query = query.eq("position", filters.position);
  if (filters.classYear) query = query.eq("class_year", filters.classYear);
  if (typeof filters.yearsRemaining === "number") {
    query = query.eq("eligibility_remaining", filters.yearsRemaining);
  }
  if (typeof filters.yearsRemainingMin === "number") {
    query = query.gte("eligibility_remaining", filters.yearsRemainingMin);
  }
  if (filters.school) query = query.ilike("current_school", `%${filters.school}%`);
  if (filters.search) {
    query = query.or(
      `first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,current_school.ilike.%${filters.search}%`
    );
  }

  const { data, error } = await query;

  if (error) {
    logDataAccessIssue("players", error.message);
    return await isAnonymousWorkspaceRequest() ? getDemoState().players : [];
  }

  if (!data || data.length === 0) {
    return await isAnonymousWorkspaceRequest() ? getDemoState().players : [];
  }

  const pickSingle = <TRow>(value: TRow | TRow[] | null | undefined): TRow | null => {
    if (Array.isArray(value)) return value[0] ?? null;
    return value ?? null;
  };

  return data.map((row: any) => ({
    ...row,
    conference: row.conference ?? getConferenceForSchool(row.current_school),
    measurements: pickSingle(row.player_measurements),
    latest_stats: Array.isArray(row.player_stats)
      ? row.player_stats.sort((a: any, b: any) => b.season - a.season)[0] ?? null
      : pickSingle(row.player_stats),
    tags: Array.isArray(row.player_tags) ? row.player_tags.map((item: any) => item.tag) : []
  }));
}

export async function getPlayerById(id: string) {
  const players = (await getPlayers()) as Player[];
  return players.find((player) => player.id === id) ?? null;
}

export async function getPlayerReviewHistory(playerId: string) {
  noStore();
  if (!hasSupabaseEnv()) {
    return getDemoState().reviews
      .filter((review) => review.player_id === playerId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  const supabase = createSupabaseDataClient();
  const { data, error } = await supabase
    .from("player_reviews")
    .select("*")
    .eq("player_id", playerId)
    .order("created_at", { ascending: false });

  if (error) {
    logDataAccessIssue("player-review-history", error.message);
    return await isAnonymousWorkspaceRequest()
      ? getDemoState().reviews.filter((review) => review.player_id === playerId)
      : [];
  }

  return data ?? [];
}

export async function getPlayerShortlistEntries(playerId: string) {
  noStore();
  if (!hasSupabaseEnv()) {
    return getDemoState().shortlists.filter((item) => item.player_id === playerId);
  }

  const supabase = createSupabaseDataClient();
  const { data, error } = await supabase.from("shortlists").select("*").eq("player_id", playerId);
  if (error) {
    logDataAccessIssue("player-shortlists", error.message);
    return await isAnonymousWorkspaceRequest()
      ? getDemoState().shortlists.filter((item) => item.player_id === playerId)
      : [];
  }
  return (data as ShortlistItem[] | null) ?? [];
}

export async function getPlayerSourceNotes(playerId: string) {
  noStore();
  if (!hasSupabaseEnv()) {
    return [] as PlayerSourceNote[];
  }

  const supabase = createSupabaseDataClient();
  const { data, error } = await supabase
    .from("player_source_notes")
    .select("*")
    .eq("player_id", playerId)
    .order("created_at", { ascending: false });

  if (error) {
    logDataAccessIssue("player-source-notes", error.message);
    return [];
  }

  return (data as PlayerSourceNote[] | null) ?? [];
}

export async function getPlayersFromSupabaseForAI(filters: {
  positions?: string[];
  minWeightLbs?: number;
  maxWeightLbs?: number;
  minHeightIn?: number;
  maxHeightIn?: number;
  minYearsRemaining?: number;
}): Promise<Player[]> {
  if (!hasSupabaseEnv()) return [];
  const supabase = createSupabaseDataClient();
  let query = supabase
    .from("players")
    .select("*, player_measurements(*), player_stats(*), player_tags(tag)")
    .order("last_name");

  if (filters.positions && filters.positions.length > 0) {
    query = query.in("position", filters.positions);
  }
  if (typeof filters.minYearsRemaining === "number") {
    query = query.gte("eligibility_remaining", filters.minYearsRemaining);
  }

  const { data, error } = await query;
  if (error) {
    logDataAccessIssue("ai-players", error.message);
    return await isAnonymousWorkspaceRequest() ? getDemoState().players : [];
  }
  if (!data || data.length === 0) {
    return await isAnonymousWorkspaceRequest() ? getDemoState().players : [];
  }

  const pickSingle = <TRow>(value: TRow | TRow[] | null | undefined): TRow | null => {
    if (Array.isArray(value)) return value[0] ?? null;
    return value ?? null;
  };

  let players: Player[] = data.map((row: any) => ({
    ...row,
    conference: row.conference ?? getConferenceForSchool(row.current_school),
    measurements: pickSingle(row.player_measurements),
    latest_stats: Array.isArray(row.player_stats)
      ? row.player_stats.sort((a: any, b: any) => b.season - a.season)[0] ?? null
      : pickSingle(row.player_stats),
    tags: Array.isArray(row.player_tags) ? row.player_tags.map((item: any) => item.tag) : []
  }));

  // Apply measurement filters in memory (measurements are in a related table)
  if (typeof filters.minWeightLbs === "number") {
    players = players.filter(
      (p) => p.measurements?.weight_lbs == null || p.measurements.weight_lbs >= filters.minWeightLbs!
    );
  }
  if (typeof filters.maxWeightLbs === "number") {
    players = players.filter(
      (p) => p.measurements?.weight_lbs == null || p.measurements.weight_lbs <= filters.maxWeightLbs!
    );
  }
  if (typeof filters.minHeightIn === "number") {
    players = players.filter(
      (p) => p.measurements?.height_in == null || p.measurements.height_in >= filters.minHeightIn!
    );
  }
  if (typeof filters.maxHeightIn === "number") {
    players = players.filter(
      (p) => p.measurements?.height_in == null || p.measurements.height_in <= filters.maxHeightIn!
    );
  }

  return players;
}

function normalizePffName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

export async function getPffStatsForPlayer(
  player: Player
): Promise<Record<string, unknown> | null> {
  if (!hasSupabaseEnv()) return null;
  const supabase = createSupabaseDataClient();

  // Primary: match by player_id FK (accurate, works after import resolves names)
  const { data, error } = await supabase
    .from("player_pff_grades")
    .select("*")
    .eq("player_id", player.id)
    .order("season", { ascending: false });
  if (error) {
    logDataAccessIssue("pff-by-player-id", error.message);
    return null;
  }
  const preferredById = choosePreferredPffRow((data ?? []) as Array<Record<string, unknown>>);
  if (preferredById) return preferredById;

  // Fallback: exact case-insensitive name match
  const fullName = `${player.first_name} ${player.last_name}`;
  const { data: data2, error: error2 } = await supabase
    .from("player_pff_grades")
    .select("*")
    .ilike("player_name", fullName)
    .order("season", { ascending: false });
  if (error2) {
    logDataAccessIssue("pff-by-player-name", error2.message);
    return null;
  }
  const preferredByName = choosePreferredPffRow((data2 ?? []) as Array<Record<string, unknown>>);
  if (preferredByName) return preferredByName;

  // Fallback 2: normalized name match (handles J.T. vs JT, De'Andre vs Deandre, Jr. suffixes, etc.)
  const normFull = normalizePffName(fullName);
  const lastNameAlpha = player.last_name.replace(/[^a-zA-Z]/g, "");
  if (lastNameAlpha.length >= 3) {
    const { data: data3 } = await supabase
      .from("player_pff_grades")
      .select("*")
      .ilike("player_name", `%${lastNameAlpha}%`)
      .order("season", { ascending: false });

    const normalMatched = ((data3 ?? []) as Array<Record<string, unknown>>).filter(
      (row) => normalizePffName(String(row.player_name ?? "")) === normFull
    );
    return choosePreferredPffRow(normalMatched);
  }

  return null;
}

export async function getBatchPffStatsForPlayers(
  players: Player[]
): Promise<Record<string, Record<string, unknown>>> {
  if (!hasSupabaseEnv() || players.length === 0) return {};
  const supabase = createSupabaseDataClient();
  const result: Record<string, Record<string, unknown>> = {};

  // Batch 1: by player_id FK — covers all players whose PFF records were linked
  const ids = players.map((p) => p.id);
  const { data: byId, error: byIdError } = await supabase
    .from("player_pff_grades")
    .select("*")
    .in("player_id", ids)
    .order("season", { ascending: false });
  if (byIdError) {
    logDataAccessIssue("batch-pff-by-id", byIdError.message);
    return {};
  }

  const rowsByPlayerId = new Map<string, Array<Record<string, unknown>>>();
  for (const row of (byId ?? []) as Array<Record<string, unknown>>) {
    const pid = row.player_id as string | undefined;
    if (!pid) continue;
    const existing = rowsByPlayerId.get(pid) ?? [];
    existing.push(row);
    rowsByPlayerId.set(pid, existing);
  }
  for (const [pid, rows] of rowsByPlayerId.entries()) {
    const preferred = choosePreferredPffRow(rows);
    if (preferred) result[pid] = preferred;
  }

  // Batch 2: exact name match for players not yet resolved in PFF data
  const unmatched = players.filter((p) => !result[p.id]);
  if (unmatched.length) {
    const names = unmatched.map((p) => `${p.first_name} ${p.last_name}`);
    const { data: byName, error: byNameError } = await supabase
      .from("player_pff_grades")
      .select("*")
      .in("player_name", names)
      .order("season", { ascending: false });
    if (byNameError) {
      logDataAccessIssue("batch-pff-by-name", byNameError.message);
      return result;
    }

    const rowsByName = new Map<string, Array<Record<string, unknown>>>();
    for (const row of (byName ?? []) as Array<Record<string, unknown>>) {
      const rowName = ((row.player_name as string | undefined) ?? "").toLowerCase();
      if (!rowName) continue;
      const existing = rowsByName.get(rowName) ?? [];
      existing.push(row);
      rowsByName.set(rowName, existing);
    }

    for (const player of unmatched) {
      const fullName = `${player.first_name} ${player.last_name}`.toLowerCase();
      const preferred = choosePreferredPffRow(rowsByName.get(fullName) ?? []);
      if (preferred) {
        result[player.id] = preferred;
      }
    }
  }

  // Batch 3: normalized name match — handles apostrophes, periods, Jr. suffixes, etc.
  const stillUnmatched = players.filter((p) => !result[p.id]);
  if (stillUnmatched.length) {
    const { data: unlinked } = await supabase
      .from("player_pff_grades")
      .select("*")
      .is("player_id", null)
      .order("season", { ascending: false });

    const normMap = new Map<string, Array<Record<string, unknown>>>();
    for (const row of (unlinked ?? []) as Array<Record<string, unknown>>) {
      const norm = normalizePffName(String(row.player_name ?? ""));
      if (!norm) continue;
      const list = normMap.get(norm) ?? [];
      list.push(row);
      normMap.set(norm, list);
    }

    for (const player of stillUnmatched) {
      const norm = normalizePffName(`${player.first_name} ${player.last_name}`);
      const preferred = choosePreferredPffRow(normMap.get(norm) ?? []);
      if (preferred) result[player.id] = preferred;
    }
  }

  return result;
}

export async function getPlayerQuickViewData(
  playerId: string
): Promise<{ player: Player; pffStats: Record<string, unknown> | null } | null> {
  const player = await getPlayerById(playerId);
  if (!player) return null;
  const pffStats = await getPffStatsForPlayer(player);
  return { player, pffStats };
}

export async function getPlayerProfileData(playerId: string) {
  // Need player first to route PFF fetch by position
  const player = await getPlayerById(playerId);
  if (!player) return null;

  const [needs, reviews, shortlists, sourceNotes, pffStats, { team }] = await Promise.all([
    getNeeds(),
    getPlayerReviewHistory(playerId),
    getPlayerShortlistEntries(playerId),
    getPlayerSourceNotes(playerId),
    getPffStatsForPlayer(player),
    getViewerContext()
  ]);

  const originScheme =
    resolveScheme(player.current_school) ?? resolveScheme(player.previous_school ?? null);
  const destScheme = resolveScheme(team?.name ?? null);

  // Cast raw pffStats to PlayerPffGrade shape for featured-stats selector
  const pffGrade = pffStats as PlayerPffGrade | null;

  const { featuredStats, fitTrait } = pffGrade
    ? selectFeaturedStats(pffGrade, player.position)
    : { featuredStats: [], fitTrait: "" };

  const schemeDelta = computeSchemeDelta(originScheme, destScheme, player.position, featuredStats);
  const schemeFitSummary = generateSchemeSummary(originScheme, destScheme, player.position, fitTrait);

  const schemeContext: PlayerSchemeContext = {
    latestPffSeason: pffGrade,
    featuredStats,
    fitTrait,
    schemeFitSummary,
    schemeDelta,
    resolvedOriginScheme: originScheme,
    resolvedDestinationScheme: destScheme
  };

  const matchingNeeds = needs
    .filter((need) => need.position === player.position && need.status === "active")
    .map((need) => {
      const fit = calculateFit(player, need);
      const latestReview = reviews.find((review) => review.need_id === need.id) ?? null;
      const shortlist = shortlists.find((item) => item.need_id === need.id) ?? null;

      // Per-need scheme delta: use need.scheme override if set
      const needDestScheme = need.scheme ? resolveScheme(need.scheme) ?? destScheme : destScheme;
      const needDelta = computeSchemeDelta(originScheme, needDestScheme, player.position, featuredStats);
      const adjustedFitScore = Math.max(0, Math.min(100, fit.fitScore + needDelta));

      return {
        need,
        fit: { ...fit, fitScore: adjustedFitScore },
        latestReview,
        shortlist
      };
    })
    .sort((a, b) => b.fit.fitScore - a.fit.fitScore);

  return {
    player,
    matchingNeeds,
    reviews,
    shortlists,
    sourceNotes,
    pffStats,
    schemeContext
  };
}

export async function getReviewsByNeed(needId: string) {
  noStore();
  if (!hasSupabaseEnv()) {
    return getDemoState().reviews.filter((review) => review.need_id === needId);
  }

  const supabase = createSupabaseDataClient();
  const { data, error } = await supabase
    .from("player_reviews")
    .select("*")
    .eq("need_id", needId)
    .order("created_at", { ascending: false });

  if (error) {
    logDataAccessIssue("reviews-by-need", error.message);
    return await isAnonymousWorkspaceRequest()
      ? getDemoState().reviews.filter((review) => review.need_id === needId)
      : [];
  }

  return data ?? [];
}

export async function getShortlists() {
  noStore();
  if (!hasSupabaseEnv()) {
    return getDemoState().shortlists;
  }

  const supabase = createSupabaseDataClient();
  const { data, error } = await supabase.from("shortlists").select("*");
  if (error) {
    logDataAccessIssue("shortlists", error.message);
    return await isAnonymousWorkspaceRequest() ? getDemoState().shortlists : [];
  }
  return (data as ShortlistItem[] | null) ?? [];
}

export async function getShortlistBoard(filters?: {
  needId?: string;
  position?: string;
}): Promise<ShortlistBoardItem[]> {
  const [shortlists, players, needs, reviews] = await Promise.all([
    getShortlists(),
    getPlayers(),
    getNeeds(),
    getAllReviews()
  ]);
  const allPlayers = players as Player[];

  return shortlists
    .map((item) => {
      const player = allPlayers.find((candidate) => candidate.id === item.player_id) ?? null;
      const need = needs.find((candidate) => candidate.id === item.need_id) ?? null;
      const latestReview = reviews
        .filter((review) => review.need_id === item.need_id && review.player_id === item.player_id)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;

      return {
        ...item,
        player,
        need,
        fitScore: latestReview?.fit_score ?? null,
        latestNote: latestReview?.note ?? item.note ?? null
      };
    })
    .filter((item) => {
      if (filters?.needId && item.need_id !== filters.needId) return false;
      if (filters?.position && item.player?.position !== filters.position) return false;
      return true;
    });
}

async function getAllReviews() {
  noStore();
  if (!hasSupabaseEnv()) {
    return getDemoState().reviews;
  }

  const supabase = createSupabaseDataClient();
  const { data, error } = await supabase.from("player_reviews").select("*");
  if (error) {
    logDataAccessIssue("all-reviews", error.message);
    return await isAnonymousWorkspaceRequest() ? getDemoState().reviews : [];
  }
  return data ?? [];
}

export async function getReviewQueue(needId: string): Promise<PlayerFitResult[]> {
  const need = await getNeedById(needId);
  if (!need) return [];

  const reviewedIds = new Set((await getReviewsByNeed(needId)).map((review) => review.player_id));
  const players = await getPlayers({
    needId,
    position: need.position,
    heightMin: need.min_height_in ?? undefined,
    heightMax: need.max_height_in ?? undefined,
    weightMin: need.min_weight_lbs ?? undefined,
    weightMax: need.max_weight_lbs ?? undefined,
    armLengthMin: need.min_arm_length_in ?? undefined,
    fortyMax: need.max_forty_time ?? undefined,
    yearsRemainingMin: need.min_years_remaining ?? undefined
  });

  return (players as PlayerFitResult[])
    .filter((item) => !reviewedIds.has(item.player.id))
    .filter((item) => {
      const stats = item.player.latest_stats;
      const productionFilters = need.production_filters;
      const starts = stats?.starts ?? 0;
      const gamesPlayed = stats?.games_played ?? 0;

      if (need.min_starts && starts < need.min_starts) return false;
      if (need.min_production_score && item.productionScore < need.min_production_score) {
        return false;
      }
      if (productionFilters?.min_games_played && gamesPlayed < productionFilters.min_games_played) {
        return false;
      }
      if (
        productionFilters?.stat_key &&
        productionFilters.min_stat_value !== null &&
        productionFilters.min_stat_value !== undefined
      ) {
        const value = Number(stats?.[productionFilters.stat_key] ?? 0);
        if (value < productionFilters.min_stat_value) return false;
      }

      return true;
    });
}
