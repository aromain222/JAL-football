import {
  Player,
  PlayerReview,
  Profile,
  ShortlistItem,
  Team,
  TeamNeed
} from "@/lib/types";

export const demoTeam: Team = {
  id: "8d3b3d8f-0f82-4717-9db7-7c8804dafd11",
  name: "JAL Football",
  conference: "Big 12",
  logo_url: null
};

export const demoProfile: Profile = {
  id: "f0f769e4-0ece-44ca-b2c5-2480e8f5f7c1",
  team_id: demoTeam.id,
  full_name: "Avery Romain",
  role: "Personnel Director"
};

export const demoPlayers: Player[] = [
  {
    id: "f90320ae-6054-4b15-84a1-7fd4dbe6f94e",
    first_name: "Malik",
    last_name: "Denson",
    position: "WR",
    transfer_year: 2026,
    current_school: "Boise State",
    previous_school: "UNLV",
    hometown: "Houston, TX",
    class_year: "JR",
    eligibility_remaining: 2,
    stars: 3,
    academic_status: "Eligible",
    status: "Portal",
    film_url: "https://hudl.com/video/3/1234567/6543210",
    contact_window: "Spring",
    notes: "Explosive slot with punt return value",
    tags: ["speed", "returner"],
    measurements: {
      player_id: "f90320ae-6054-4b15-84a1-7fd4dbe6f94e",
      height_in: 72,
      weight_lbs: 188,
      arm_length_in: 31.2,
      forty_time: 4.42,
      shuttle_time: 4.1,
      vertical_jump: 37,
      wing_span_in: 74,
      verified_at: "2026-01-14"
    },
    latest_stats: {
      player_id: "f90320ae-6054-4b15-84a1-7fd4dbe6f94e",
      season: 2025,
      games_played: 12,
      starts: 10,
      offensive_snaps: 512,
      defensive_snaps: 0,
      special_teams_snaps: 86,
      passing_yards: 0,
      rushing_yards: 94,
      receiving_yards: 842,
      total_touchdowns: 9,
      tackles: 0,
      sacks: 0,
      interceptions: 0,
      passes_defended: 0
    }
  },
  {
    id: "0993c985-cc22-480c-89f6-f647d8f7e3ee",
    first_name: "Jalen",
    last_name: "McCoy",
    position: "EDGE",
    transfer_year: 2026,
    current_school: "UTSA",
    previous_school: "Arkansas State",
    hometown: "Mobile, AL",
    class_year: "SR",
    eligibility_remaining: 1,
    stars: 3,
    academic_status: "Eligible",
    status: "Portal",
    film_url: "https://www.youtube.com/watch?v=edge-player",
    contact_window: "Open",
    notes: "Long-body pass rusher who flashes speed-to-power",
    tags: ["length", "pass-rush"],
    measurements: {
      player_id: "0993c985-cc22-480c-89f6-f647d8f7e3ee",
      height_in: 77,
      weight_lbs: 247,
      arm_length_in: 33.8,
      forty_time: 4.67,
      shuttle_time: 4.33,
      vertical_jump: 33,
      wing_span_in: 81,
      verified_at: "2026-01-08"
    },
    latest_stats: {
      player_id: "0993c985-cc22-480c-89f6-f647d8f7e3ee",
      season: 2025,
      games_played: 13,
      starts: 11,
      offensive_snaps: 0,
      defensive_snaps: 598,
      special_teams_snaps: 35,
      passing_yards: 0,
      rushing_yards: 0,
      receiving_yards: 0,
      total_touchdowns: 0,
      tackles: 44,
      sacks: 8,
      interceptions: 0,
      passes_defended: 4
    }
  },
  {
    id: "6180b4a9-1aca-41f2-8fb4-9cbf52d05501",
    first_name: "Trent",
    last_name: "Holloway",
    position: "OL",
    transfer_year: 2026,
    current_school: "North Texas",
    previous_school: null,
    hometown: "Tulsa, OK",
    class_year: "JR",
    eligibility_remaining: 2,
    stars: 2,
    academic_status: "Eligible",
    status: "Portal",
    film_url: "https://hudl.com/video/3/222222/111111",
    contact_window: "Spring",
    notes: "Swing tackle with 900+ live snaps",
    tags: ["multi-position", "experience"],
    measurements: {
      player_id: "6180b4a9-1aca-41f2-8fb4-9cbf52d05501",
      height_in: 78,
      weight_lbs: 307,
      arm_length_in: 34.1,
      forty_time: 5.18,
      shuttle_time: 4.71,
      vertical_jump: 27,
      wing_span_in: 82,
      verified_at: "2026-01-11"
    },
    latest_stats: {
      player_id: "6180b4a9-1aca-41f2-8fb4-9cbf52d05501",
      season: 2025,
      games_played: 12,
      starts: 12,
      offensive_snaps: 781,
      defensive_snaps: 0,
      special_teams_snaps: 44,
      passing_yards: 0,
      rushing_yards: 0,
      receiving_yards: 0,
      total_touchdowns: 0,
      tackles: 0,
      sacks: 0,
      interceptions: 0,
      passes_defended: 0
    }
  },
  {
    id: "de9d6b28-fbc3-4ed0-9db5-c00085fdfb16",
    first_name: "Kobe",
    last_name: "Sanders",
    position: "CB",
    transfer_year: 2026,
    current_school: "Tulane",
    previous_school: "Mississippi State",
    hometown: "New Orleans, LA",
    class_year: "JR",
    eligibility_remaining: 2,
    stars: 4,
    academic_status: "Eligible",
    status: "Portal",
    film_url: "https://www.youtube.com/watch?v=cb-player",
    contact_window: "Open",
    notes: "Press-man profile with SEC background",
    tags: ["man-coverage", "ball-skills"],
    measurements: {
      player_id: "de9d6b28-fbc3-4ed0-9db5-c00085fdfb16",
      height_in: 73,
      weight_lbs: 194,
      arm_length_in: 31.6,
      forty_time: 4.48,
      shuttle_time: 4.08,
      vertical_jump: 38,
      wing_span_in: 76,
      verified_at: "2026-01-05"
    },
    latest_stats: {
      player_id: "de9d6b28-fbc3-4ed0-9db5-c00085fdfb16",
      season: 2025,
      games_played: 11,
      starts: 9,
      offensive_snaps: 0,
      defensive_snaps: 602,
      special_teams_snaps: 64,
      passing_yards: 0,
      rushing_yards: 0,
      receiving_yards: 0,
      total_touchdowns: 0,
      tackles: 39,
      sacks: 0,
      interceptions: 3,
      passes_defended: 11
    }
  }
];

export const demoNeeds: TeamNeed[] = [
  {
    id: "cf8fd2ca-cf8e-40d2-aeec-8cbe0e0c9c98",
    team_id: demoTeam.id,
    created_by: demoProfile.id,
    title: "Boundary WR with vertical speed",
    position: "WR",
    priority: "critical",
    status: "active",
    target_count: 2,
    class_focus: "JR/SR",
    min_height_in: 71,
    max_height_in: 75,
    min_weight_lbs: 180,
    max_weight_lbs: 205,
    min_arm_length_in: 31,
    max_forty_time: 4.55,
    min_years_remaining: 1,
    scheme: "11 personnel spread",
    priority_traits: ["vertical speed", "return value", "tracking"],
    production_filters: {
      min_games_played: 8,
      min_starts: 6,
      stat_key: "receiving_yards",
      min_stat_value: 500
    },
    min_starts: 6,
    min_production_score: 70,
    notes: "Need immediate field-stretcher who can also handle return reps.",
    created_at: "2026-02-20T18:00:00.000Z"
  },
  {
    id: "70f40b35-dd61-45f0-a4d9-d112ad47f1f2",
    team_id: demoTeam.id,
    created_by: demoProfile.id,
    title: "Third-down edge rusher",
    position: "EDGE",
    priority: "high",
    status: "active",
    target_count: 1,
    class_focus: "SR",
    min_height_in: 75,
    max_height_in: 79,
    min_weight_lbs: 235,
    max_weight_lbs: 265,
    min_arm_length_in: 33,
    max_forty_time: 4.85,
    min_years_remaining: 1,
    scheme: "multiple front pressure package",
    priority_traits: ["get-off", "bend", "length"],
    production_filters: {
      min_games_played: 8,
      min_starts: 5,
      stat_key: "sacks",
      min_stat_value: 4
    },
    min_starts: 5,
    min_production_score: 65,
    notes: "High-urgency pass rush depth with immediate rotational juice.",
    created_at: "2026-02-25T20:00:00.000Z"
  }
];

export const demoReviews: PlayerReview[] = [
  {
    id: "5f5c9c36-ad79-4763-8038-ad0f3c9976fb",
    need_id: demoNeeds[0].id,
    player_id: demoPlayers[0].id,
    reviewer_id: demoProfile.id,
    decision: "right",
    fit_score: 92,
    note: "Immediate vertical role, clean return background.",
    created_at: "2026-03-10T18:30:00.000Z"
  },
  {
    id: "e522da00-7021-4bc5-af0f-f9cc582c08d8",
    need_id: demoNeeds[1].id,
    player_id: demoPlayers[1].id,
    reviewer_id: demoProfile.id,
    decision: "save",
    fit_score: 84,
    note: "Need to confirm run-game anchor before coordinator review.",
    created_at: "2026-03-12T15:15:00.000Z"
  }
];

export const demoShortlists: ShortlistItem[] = [
  {
    id: "efd8dc83-8fd0-4c05-a28f-4ee4466e6de7",
    need_id: demoNeeds[0].id,
    player_id: demoPlayers[0].id,
    created_by: demoProfile.id,
    stage: "coordinator",
    priority_rank: 1,
    note: "OC wants in-person eval this week.",
    created_at: "2026-03-10T19:00:00.000Z"
  },
  {
    id: "634a65fd-7b2a-45bf-a493-378019b0c0bf",
    need_id: demoNeeds[1].id,
    player_id: demoPlayers[1].id,
    created_by: demoProfile.id,
    stage: "assistant",
    priority_rank: 2,
    note: "DL coach reviewing stance/alignment cutups.",
    created_at: "2026-03-12T16:10:00.000Z"
  }
];
