import { unstable_noStore as noStore } from "next/cache";
import { getDemoState } from "@/lib/data/demo-store";
import { getConferenceForSchool } from "@/lib/football";
import { calculateFit } from "@/lib/scoring";
import {
  DashboardMetrics,
  Player,
  PlayerFitResult,
  PlayersPageResult,
  ShortlistBoardItem,
  ShortlistItem,
  TeamNeed
} from "@/lib/types";
import { createSupabaseServerClient, hasSupabaseEnv } from "@/lib/supabase/server";
import { demoProfile, demoTeam } from "@/lib/data/demo";

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
}

function matchesSearch(player: Player, search?: string) {
  if (!search) return true;
  const haystack = `${player.first_name} ${player.last_name} ${player.current_school}`.toLowerCase();
  return haystack.includes(search.toLowerCase());
}

export async function getViewerContext() {
  noStore();
  if (!hasSupabaseEnv()) {
    const state = getDemoState();
    return { profile: state.profile, team: state.team };
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { profile: demoProfile, team: demoTeam };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const { data: team } = await supabase
    .from("teams")
    .select("*")
    .eq("id", profile?.team_id ?? demoTeam.id)
    .single();

  return {
    profile: profile ?? demoProfile,
    team: team ?? demoTeam
  };
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  noStore();
  if (!hasSupabaseEnv()) {
    const state = getDemoState();
    return {
      activeNeeds: state.needs.filter((need) => need.status === "active").length,
      totalPlayers: state.players.length,
      shortlistedPlayers: state.shortlists.length,
      recentReviews: state.reviews.length
    };
  }

  const supabase = createSupabaseServerClient();
  const [{ count: activeNeeds }, { count: totalPlayers }, { count: shortlistedPlayers }, { count: recentReviews }] =
    await Promise.all([
      supabase.from("team_needs").select("*", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("players").select("*", { count: "exact", head: true }),
      supabase.from("shortlists").select("*", { count: "exact", head: true }),
      supabase
        .from("player_reviews")
        .select("*", { count: "exact", head: true })
        .gte("created_at", new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString())
    ]);

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

  const { team } = await getViewerContext();
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("team_needs")
    .select("*")
    .eq("team_id", team.id)
    .order("created_at", { ascending: false });

  return (data as TeamNeed[] | null) ?? [];
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
  const items = all.slice(start, start + pageSize);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages
  };
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

    if (typeof filters.heightMin === "number" && (measurements?.height_in ?? -Infinity) < filters.heightMin) {
      return false;
    }
    if (typeof filters.heightMax === "number" && (measurements?.height_in ?? Infinity) > filters.heightMax) {
      return false;
    }
    if (typeof filters.weightMin === "number" && (measurements?.weight_lbs ?? -Infinity) < filters.weightMin) {
      return false;
    }
    if (typeof filters.weightMax === "number" && (measurements?.weight_lbs ?? Infinity) > filters.weightMax) {
      return false;
    }
    if (
      typeof filters.armLengthMin === "number" &&
      ((measurements?.arm_length_in ?? null) === null || (measurements?.arm_length_in ?? 0) < filters.armLengthMin)
    ) {
      return false;
    }
    if (
      typeof filters.fortyMax === "number" &&
      ((measurements?.forty_time ?? null) === null || (measurements?.forty_time ?? 99) > filters.fortyMax)
    ) {
      return false;
    }

    return true;
  });
}

async function getPlayersFromSupabase(filters: PlayerFilters = {}): Promise<Player[]> {
  const supabase = createSupabaseServerClient();
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

  const { data } = await query;

  if (!data) return [];

  return data.map((row: any) => ({
    ...row,
    conference: getConferenceForSchool(row.current_school),
    measurements: row.player_measurements ?? null,
    latest_stats: Array.isArray(row.player_stats)
      ? row.player_stats.sort((a: any, b: any) => b.season - a.season)[0] ?? null
      : null,
    tags: Array.isArray(row.player_tags) ? row.player_tags.map((item: any) => item.tag) : []
  }));
}

export async function getPlayerById(id: string) {
  const players = await getPlayers();
  return players.find((player) => player.id === id) ?? null;
}

export async function getPlayerReviewHistory(playerId: string) {
  noStore();
  if (!hasSupabaseEnv()) {
    return getDemoState().reviews
      .filter((review) => review.player_id === playerId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("player_reviews")
    .select("*")
    .eq("player_id", playerId)
    .order("created_at", { ascending: false });

  return data ?? [];
}

export async function getPlayerShortlistEntries(playerId: string) {
  noStore();
  if (!hasSupabaseEnv()) {
    return getDemoState().shortlists.filter((item) => item.player_id === playerId);
  }

  const supabase = createSupabaseServerClient();
  const { data } = await supabase.from("shortlists").select("*").eq("player_id", playerId);
  return (data as ShortlistItem[] | null) ?? [];
}

export async function getPlayerProfileData(playerId: string) {
  const [player, needs, reviews, shortlists] = await Promise.all([
    getPlayerById(playerId),
    getNeeds(),
    getPlayerReviewHistory(playerId),
    getPlayerShortlistEntries(playerId)
  ]);

  if (!player) return null;

  const matchingNeeds = needs
    .filter((need) => need.position === player.position && need.status === "active")
    .map((need) => {
      const fit = calculateFit(player, need);
      const latestReview = reviews.find((review) => review.need_id === need.id) ?? null;
      const shortlist = shortlists.find((item) => item.need_id === need.id) ?? null;

      return {
        need,
        fit,
        latestReview,
        shortlist
      };
    })
    .sort((a, b) => b.fit.fitScore - a.fit.fitScore);

  return {
    player,
    matchingNeeds,
    reviews,
    shortlists
  };
}

export async function getReviewsByNeed(needId: string) {
  noStore();
  if (!hasSupabaseEnv()) {
    return getDemoState().reviews.filter((review) => review.need_id === needId);
  }

  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("player_reviews")
    .select("*")
    .eq("need_id", needId)
    .order("created_at", { ascending: false });

  return data ?? [];
}

export async function getShortlists() {
  noStore();
  if (!hasSupabaseEnv()) {
    return getDemoState().shortlists;
  }

  const supabase = createSupabaseServerClient();
  const { data } = await supabase.from("shortlists").select("*");
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

  return shortlists
    .map((item) => {
      const player = players.find((candidate) => candidate.id === item.player_id) ?? null;
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

  const supabase = createSupabaseServerClient();
  const { data } = await supabase.from("player_reviews").select("*");
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
