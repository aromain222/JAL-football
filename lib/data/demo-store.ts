import { demoNeeds, demoPlayers, demoProfile, demoReviews, demoShortlists, demoTeam } from "@/lib/data/demo";
import { PlayerReview, ShortlistItem, TeamNeed } from "@/lib/types";

const state = {
  team: demoTeam,
  profile: demoProfile,
  players: [...demoPlayers],
  needs: [...demoNeeds],
  reviews: [...demoReviews],
  shortlists: [...demoShortlists]
};

export function getDemoState() {
  return state;
}

export function addDemoNeed(need: TeamNeed) {
  state.needs = [need, ...state.needs];
}

export function addOrUpdateDemoReview(review: PlayerReview) {
  const existingIndex = state.reviews.findIndex(
    (item) =>
      item.need_id === review.need_id &&
      item.player_id === review.player_id &&
      item.reviewer_id === review.reviewer_id
  );

  if (existingIndex >= 0) {
    state.reviews[existingIndex] = review;
    return;
  }

  state.reviews = [review, ...state.reviews];
}

export function addOrUpdateDemoShortlist(item: ShortlistItem) {
  const existingIndex = state.shortlists.findIndex(
    (entry) => entry.need_id === item.need_id && entry.player_id === item.player_id
  );

  if (existingIndex >= 0) {
    state.shortlists[existingIndex] = {
      ...state.shortlists[existingIndex],
      ...item
    };
    return;
  }

  state.shortlists = [item, ...state.shortlists];
}

export function updateDemoShortlistStage(shortlistId: string, stage: ShortlistItem["stage"]) {
  state.shortlists = state.shortlists.map((item) =>
    item.id === shortlistId ? { ...item, stage } : item
  );
}

export function addDemoPlayerTag(playerId: string, tag: string) {
  state.players = state.players.map((player) =>
    player.id === playerId
      ? {
          ...player,
          tags: Array.from(new Set([...(player.tags ?? []), tag]))
        }
      : player
  );
}
