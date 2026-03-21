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

export const demoNeeds: TeamNeed[] = [];

export const demoReviews: PlayerReview[] = [];

export const demoShortlists: ShortlistItem[] = [];
