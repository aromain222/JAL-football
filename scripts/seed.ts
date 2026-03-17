import { createClient, SupabaseClient } from "@supabase/supabase-js";

type Role = "recruiting assistant" | "coordinator" | "head coach";
type Position = "EDGE" | "DL" | "LB" | "CB" | "WR" | "RB" | "OL";
type ClassYear = "FR" | "SO" | "JR" | "SR" | "GR";
type NeedPriority = "high" | "critical" | "medium";
type NeedStatus = "open";
type ReviewDecision = "left" | "right" | "save";
type ShortlistStage =
  | "position_coach"
  | "coordinator"
  | "head_coach"
  | "approved"
  | "passed";

interface TeamInsert {
  id: string;
  name: string;
  conference: string;
  subdivision: string;
}

interface ProfileInsert {
  id: string;
  team_id: string;
  full_name: string;
  role: Role;
}

interface PlayerInsert {
  id: string;
  first_name: string;
  last_name: string;
  position: Position;
  current_school: string;
  previous_school: string | null;
  class_year: ClassYear;
  years_remaining: number;
  transfer_cycle: number;
  hometown: string | null;
  state: string | null;
  status: "portal";
  film_url: string;
  source_external_id: string;
}

interface MeasurementInsert {
  player_id: string;
  height_in: number | null;
  weight_lbs: number | null;
  arm_length_in: number | null;
  hand_size_in: number | null;
  forty_yard: number | null;
  shuttle: number | null;
  vertical_in: number | null;
  wingspan_in: number | null;
  measured_at: string | null;
  source: string;
}

interface StatInsert {
  player_id: string;
  season: number;
  games_played: number;
  starts: number;
  offensive_snaps: number | null;
  defensive_snaps: number | null;
  special_teams_snaps: number | null;
  passing_yards: number | null;
  passing_tds: number | null;
  interceptions_thrown: number | null;
  rushing_attempts: number | null;
  rushing_yards: number | null;
  rushing_tds: number | null;
  receptions: number | null;
  receiving_yards: number | null;
  receiving_tds: number | null;
  tackles: number | null;
  tackles_for_loss: number | null;
  sacks: number | null;
  interceptions: number | null;
  passes_defended: number | null;
  forced_fumbles: number | null;
  source: string;
}

interface NeedInsert {
  id: string;
  team_id: string;
  created_by: string;
  title: string;
  position: Position;
  priority: NeedPriority;
  status: NeedStatus;
  target_count: number;
  min_height_in: number | null;
  min_weight_lbs: number | null;
  min_years_remaining: number | null;
  max_years_remaining: number | null;
  min_starts: number | null;
  notes: string;
}

interface ReviewInsert {
  id: string;
  need_id: string;
  player_id: string;
  reviewer_id: string;
  decision: ReviewDecision;
  fit_score: number;
  notes: string;
}

interface ShortlistInsert {
  id: string;
  need_id: string;
  player_id: string;
  team_id: string;
  created_by: string;
  stage: ShortlistStage;
  rank_order: number | null;
  notes: string;
}

interface PlayerBundle {
  player: PlayerInsert;
  measurement: MeasurementInsert;
  stat: StatInsert;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables."
  );
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const TRANSFER_CYCLE = 2026;
const TEAM_ID = "9f391383-08e4-4895-bf10-ef2f5b7637b6";

const userSeeds = [
  {
    id: "d7488e1d-dd9b-4b7e-a4ae-d52f6d35a401",
    email: "assistant@demofootballops.com",
    password: "Password123!",
    full_name: "Jordan Hale",
    role: "recruiting assistant" as const
  },
  {
    id: "b5de3347-69f7-4d58-afbb-51d3c6341bb4",
    email: "coordinator@demofootballops.com",
    password: "Password123!",
    full_name: "Marcus Reed",
    role: "coordinator" as const
  },
  {
    id: "298019b4-2afc-4ddf-a667-a46010ddb534",
    email: "headcoach@demofootballops.com",
    password: "Password123!",
    full_name: "Eli Navarro",
    role: "head coach" as const
  }
];

const firstNames = [
  "Jalen", "Malik", "Tyrese", "Devin", "Kobe", "Cam", "Jordan", "Micah", "Zion", "Amari",
  "Tre", "Javon", "Mason", "Bryce", "Keon", "Darius", "Noah", "Isaiah", "Quincy", "Xavier",
  "Rashad", "Tyler", "Brandon", "Corey", "Aiden", "Jaylen", "Caden", "Omari", "Kendrick", "Treyvon"
];

const lastNames = [
  "Denson", "McCoy", "Sanders", "Holloway", "Watkins", "Miller", "Bishop", "Griffin", "Boone", "Hayes",
  "Morris", "Franklin", "Turner", "Parks", "Caldwell", "Maddox", "Pryor", "Waller", "Livingston", "Nash",
  "Thornton", "Benson", "Pope", "Hampton", "Cooper", "Ricks", "Spears", "Grimes", "McKinney", "Ward"
];

const schools = [
  { school: "UTSA", conference: "AAC" },
  { school: "Tulane", conference: "AAC" },
  { school: "Memphis", conference: "AAC" },
  { school: "North Texas", conference: "AAC" },
  { school: "Boise State", conference: "MWC" },
  { school: "Fresno State", conference: "MWC" },
  { school: "Colorado State", conference: "MWC" },
  { school: "San Diego State", conference: "MWC" },
  { school: "Liberty", conference: "CUSA" },
  { school: "James Madison", conference: "Sun Belt" },
  { school: "Coastal Carolina", conference: "Sun Belt" },
  { school: "App State", conference: "Sun Belt" },
  { school: "Troy", conference: "Sun Belt" },
  { school: "Texas State", conference: "Sun Belt" },
  { school: "Marshall", conference: "Sun Belt" },
  { school: "Toledo", conference: "MAC" },
  { school: "Miami (OH)", conference: "MAC" },
  { school: "Ohio", conference: "MAC" },
  { school: "Western Kentucky", conference: "CUSA" },
  { school: "Georgia State", conference: "Sun Belt" },
  { school: "Nevada", conference: "MWC" },
  { school: "Arkansas State", conference: "Sun Belt" },
  { school: "UAB", conference: "AAC" },
  { school: "Charlotte", conference: "AAC" },
  { school: "Temple", conference: "AAC" },
  { school: "Buffalo", conference: "MAC" },
  { school: "Middle Tennessee", conference: "CUSA" },
  { school: "FIU", conference: "CUSA" },
  { school: "Wyoming", conference: "MWC" },
  { school: "South Alabama", conference: "Sun Belt" },
  { school: "Kansas State", conference: "Big 12" },
  { school: "Baylor", conference: "Big 12" },
  { school: "Texas Tech", conference: "Big 12" },
  { school: "Ole Miss", conference: "SEC" },
  { school: "Mississippi State", conference: "SEC" },
  { school: "Missouri", conference: "SEC" },
  { school: "NC State", conference: "ACC" },
  { school: "Louisville", conference: "ACC" }
];

const states = ["TX", "FL", "GA", "AL", "LA", "MS", "NC", "SC", "TN", "OK", "AZ", "CA"];
const hometownPrefixes = ["Houston", "Dallas", "Atlanta", "Mobile", "Birmingham", "New Orleans", "Charlotte", "Memphis", "Tulsa", "Phoenix", "Orlando", "Tampa"];

const needTemplates: Array<{
  id: string;
  title: string;
  position: Position;
  priority: NeedPriority;
  target_count: number;
  min_height_in: number | null;
  min_weight_lbs: number | null;
  min_years_remaining: number | null;
  max_years_remaining: number | null;
  min_starts: number | null;
  notes: string;
}> = [
  {
    id: "0aa2d6af-6435-47a8-96f9-b4d9292962f0",
    title: "Boundary corner with length and man-cover profile",
    position: "CB",
    priority: "critical",
    target_count: 2,
    min_height_in: 71,
    min_weight_lbs: 182,
    min_years_remaining: 1,
    max_years_remaining: 3,
    min_starts: 6,
    notes: "Need an immediate contributor with verified speed and press comfort."
  },
  {
    id: "887d79d4-2be0-4a95-b627-a8cfd74a9a5f",
    title: "Third-down EDGE with real pass-rush juice",
    position: "EDGE",
    priority: "critical",
    target_count: 2,
    min_height_in: 75,
    min_weight_lbs: 235,
    min_years_remaining: 1,
    max_years_remaining: 2,
    min_starts: 5,
    notes: "Looking for proven havoc production and enough size to hold up in the league."
  },
  {
    id: "ba0e1eef-e1b4-4f31-9fe8-f6c351ffb8ff",
    title: "Explosive field receiver with return value",
    position: "WR",
    priority: "high",
    target_count: 1,
    min_height_in: 70,
    min_weight_lbs: 175,
    min_years_remaining: 1,
    max_years_remaining: 3,
    min_starts: 4,
    notes: "Need speed, ball production, and open-field value."
  }
];

const stageDistribution: ShortlistStage[] = [
  "position_coach",
  "position_coach",
  "position_coach",
  "coordinator",
  "coordinator",
  "coordinator",
  "head_coach",
  "head_coach",
  "approved",
  "approved",
  "passed",
  "passed"
];

async function main() {
  console.log("Seeding recruiting workflow demo data...");

  const team: TeamInsert = {
    id: TEAM_ID,
    name: "Red Valley Football",
    conference: "Big 12",
    subdivision: "FBS"
  };

  await upsertTeam(team);
  const profiles = await upsertUsersAndProfiles(team.id);
  const players = generatePlayers(100);
  const needs = generateNeeds(team.id, profiles[0].id);
  const reviews = generateReviews(players, needs, profiles);
  const shortlists = generateShortlists(team.id, profiles[1].id, reviews);

  await purgeTeamScopedData(team.id);
  await purgePlayerData();

  await upsertTeam(team);
  await upsertProfiles(profiles);
  await upsertPlayers(players.map((item) => item.player));
  await upsertMeasurements(players.map((item) => item.measurement));
  await upsertStats(players.map((item) => item.stat));
  await upsertNeeds(needs);
  await upsertReviews(reviews);
  await upsertShortlists(shortlists);

  console.log("Seed complete.");
  console.log(`Team: ${team.name}`);
  console.log(`Profiles: ${profiles.length}`);
  console.log(`Players: ${players.length}`);
  console.log(`Needs: ${needs.length}`);
  console.log(`Reviews: ${reviews.length}`);
  console.log(`Shortlists: ${shortlists.length}`);
}

async function upsertUsersAndProfiles(teamId: string): Promise<ProfileInsert[]> {
  const profiles: ProfileInsert[] = [];

  for (const seed of userSeeds) {
    const existing = await supabase.auth.admin.getUserById(seed.id);
    if (existing.error && !existing.error.message.toLowerCase().includes("not found")) {
      throw existing.error;
    }

    if (!existing.data.user) {
      const created = await supabase.auth.admin.createUser({
        id: seed.id,
        email: seed.email,
        password: seed.password,
        email_confirm: true,
        user_metadata: {
          full_name: seed.full_name,
          role: seed.role
        }
      });

      if (created.error) throw created.error;
    }

    profiles.push({
      id: seed.id,
      team_id: teamId,
      full_name: seed.full_name,
      role: seed.role
    });
  }

  return profiles;
}

function generatePlayers(count: number): PlayerBundle[] {
  const positionPlan: Position[] = [
    ...Array.from({ length: 20 }, () => "EDGE"),
    ...Array.from({ length: 18 }, () => "CB"),
    ...Array.from({ length: 14 }, () => "DL"),
    ...Array.from({ length: 12 }, () => "LB"),
    ...Array.from({ length: 16 }, () => "WR"),
    ...Array.from({ length: 10 }, () => "RB"),
    ...Array.from({ length: 10 }, () => "OL")
  ];

  return positionPlan.slice(0, count).map((position, index) => {
    const playerId = crypto.randomUUID();
    const firstName = pick(firstNames, index);
    const lastName = pick(lastNames, index * 3);
    const school = pick(schools, index * 5);
    const previousSchool = index % 5 === 0 ? pick(schools, index * 7 + 2).school : null;
    const classYear = pickClassYear(index);
    const yearsRemaining = deriveYearsRemaining(classYear);
    const hometown = `${pick(hometownPrefixes, index * 2)}, ${pick(states, index * 4)}`;

    const player: PlayerInsert = {
      id: playerId,
      first_name: firstName,
      last_name: lastName,
      position,
      current_school: school.school,
      previous_school: previousSchool,
      class_year: classYear,
      years_remaining: yearsRemaining,
      transfer_cycle: TRANSFER_CYCLE,
      hometown,
      state: hometown.slice(-2),
      status: "portal",
      film_url: `https://hudl.com/video/3/${100000 + index}/${900000 + index}`,
      source_external_id: `portal-${TRANSFER_CYCLE}-${index + 1}`
    };

    const measurement = generateMeasurement(playerId, position, index);
    const stat = generateStat(playerId, position, index);

    return { player, measurement, stat };
  });
}

function generateMeasurement(playerId: string, position: Position, index: number): MeasurementInsert {
  const missing = (mod: number) => index % mod === 0;

  const ranges: Record<Position, { height: [number, number]; weight: [number, number]; forty: [number, number]; arm: [number, number]; hand: [number, number]; vertical: [number, number]; wingspan: [number, number]; shuttle: [number, number] }> = {
    EDGE: { height: [74, 79], weight: [232, 265], forty: [4.58, 4.89], arm: [32.0, 35.0], hand: [9.25, 10.75], vertical: [29, 37], wingspan: [77, 84], shuttle: [4.18, 4.62] },
    DL:   { height: [73, 78], weight: [275, 325], forty: [4.88, 5.32], arm: [31.5, 35.5], hand: [9.5, 11.0], vertical: [24, 33], wingspan: [76, 83], shuttle: [4.45, 5.02] },
    LB:   { height: [72, 77], weight: [220, 248], forty: [4.52, 4.82], arm: [31.0, 34.0], hand: [9.0, 10.5], vertical: [31, 39], wingspan: [75, 81], shuttle: [4.12, 4.44] },
    CB:   { height: [69, 74], weight: [175, 205], forty: [4.34, 4.58], arm: [30.0, 33.5], hand: [8.75, 10.25], vertical: [34, 42], wingspan: [72, 78], shuttle: [3.96, 4.26] },
    WR:   { height: [69, 76], weight: [176, 215], forty: [4.33, 4.59], arm: [30.0, 33.5], hand: [8.75, 10.5], vertical: [33, 41], wingspan: [72, 79], shuttle: [3.98, 4.28] },
    RB:   { height: [68, 73], weight: [188, 222], forty: [4.36, 4.63], arm: [29.0, 32.5], hand: [8.75, 10.25], vertical: [33, 41], wingspan: [70, 76], shuttle: [4.00, 4.31] },
    OL:   { height: [75, 80], weight: [285, 335], forty: [5.02, 5.48], arm: [32.5, 36.5], hand: [9.5, 11.25], vertical: [22, 31], wingspan: [79, 86], shuttle: [4.55, 5.10] }
  };

  const range = ranges[position];

  return {
    player_id: playerId,
    height_in: missing(11) ? null : round(randomInRange(range.height[0], range.height[1]), 1),
    weight_lbs: missing(13) ? null : round(randomInRange(range.weight[0], range.weight[1]), 1),
    arm_length_in: missing(7) ? null : round(randomInRange(range.arm[0], range.arm[1]), 2),
    hand_size_in: missing(9) ? null : round(randomInRange(range.hand[0], range.hand[1]), 2),
    forty_yard: missing(6) ? null : round(randomInRange(range.forty[0], range.forty[1]), 2),
    shuttle: missing(8) ? null : round(randomInRange(range.shuttle[0], range.shuttle[1]), 2),
    vertical_in: missing(10) ? null : round(randomInRange(range.vertical[0], range.vertical[1]), 1),
    wingspan_in: missing(12) ? null : round(randomInRange(range.wingspan[0], range.wingspan[1]), 1),
    measured_at: missing(14) ? null : "2026-01-15",
    source: "Demo Combine / School Verified"
  };
}

function generateStat(playerId: string, position: Position, index: number): StatInsert {
  const gamesPlayed = randomInt(8, 14);
  const starts = randomInt(0, gamesPlayed);

  switch (position) {
    case "EDGE":
      return {
        player_id: playerId,
        season: 2025,
        games_played: gamesPlayed,
        starts,
        offensive_snaps: null,
        defensive_snaps: randomInt(220, 620),
        special_teams_snaps: randomInt(0, 90),
        passing_yards: null,
        passing_tds: null,
        interceptions_thrown: null,
        rushing_attempts: null,
        rushing_yards: null,
        rushing_tds: null,
        receptions: null,
        receiving_yards: null,
        receiving_tds: null,
        tackles: randomInt(18, 58),
        tackles_for_loss: round(randomInRange(4, 16), 1),
        sacks: round(randomInRange(1.5, 10.5), 1),
        interceptions: 0,
        passes_defended: randomInt(0, 5),
        forced_fumbles: randomInt(0, 4),
        source: "Demo Production Model"
      };
    case "DL":
      return {
        player_id: playerId,
        season: 2025,
        games_played: gamesPlayed,
        starts,
        offensive_snaps: null,
        defensive_snaps: randomInt(240, 650),
        special_teams_snaps: randomInt(0, 40),
        passing_yards: null,
        passing_tds: null,
        interceptions_thrown: null,
        rushing_attempts: null,
        rushing_yards: null,
        rushing_tds: null,
        receptions: null,
        receiving_yards: null,
        receiving_tds: null,
        tackles: randomInt(22, 64),
        tackles_for_loss: round(randomInRange(3, 12), 1),
        sacks: round(randomInRange(0.5, 7.5), 1),
        interceptions: 0,
        passes_defended: randomInt(0, 4),
        forced_fumbles: randomInt(0, 3),
        source: "Demo Production Model"
      };
    case "LB":
      return {
        player_id: playerId,
        season: 2025,
        games_played: gamesPlayed,
        starts,
        offensive_snaps: null,
        defensive_snaps: randomInt(260, 720),
        special_teams_snaps: randomInt(10, 140),
        passing_yards: null,
        passing_tds: null,
        interceptions_thrown: null,
        rushing_attempts: null,
        rushing_yards: null,
        rushing_tds: null,
        receptions: null,
        receiving_yards: null,
        receiving_tds: null,
        tackles: randomInt(38, 108),
        tackles_for_loss: round(randomInRange(2, 14), 1),
        sacks: round(randomInRange(0, 5.5), 1),
        interceptions: randomInt(0, 3),
        passes_defended: randomInt(1, 8),
        forced_fumbles: randomInt(0, 3),
        source: "Demo Production Model"
      };
    case "CB":
      return {
        player_id: playerId,
        season: 2025,
        games_played: gamesPlayed,
        starts,
        offensive_snaps: null,
        defensive_snaps: randomInt(260, 740),
        special_teams_snaps: randomInt(10, 120),
        passing_yards: null,
        passing_tds: null,
        interceptions_thrown: null,
        rushing_attempts: null,
        rushing_yards: null,
        rushing_tds: null,
        receptions: null,
        receiving_yards: null,
        receiving_tds: null,
        tackles: randomInt(18, 61),
        tackles_for_loss: round(randomInRange(0, 6), 1),
        sacks: round(randomInRange(0, 2), 1),
        interceptions: randomInt(0, 5),
        passes_defended: randomInt(3, 16),
        forced_fumbles: randomInt(0, 2),
        source: "Demo Production Model"
      };
    case "WR":
      return {
        player_id: playerId,
        season: 2025,
        games_played: gamesPlayed,
        starts,
        offensive_snaps: randomInt(180, 760),
        defensive_snaps: null,
        special_teams_snaps: randomInt(0, 120),
        passing_yards: null,
        passing_tds: null,
        interceptions_thrown: null,
        rushing_attempts: randomInt(0, 12),
        rushing_yards: randomInt(0, 120),
        rushing_tds: randomInt(0, 2),
        receptions: randomInt(12, 78),
        receiving_yards: randomInt(180, 1240),
        receiving_tds: randomInt(1, 13),
        tackles: null,
        tackles_for_loss: null,
        sacks: null,
        interceptions: null,
        passes_defended: null,
        forced_fumbles: randomInt(0, 2),
        source: "Demo Production Model"
      };
    case "RB":
      return {
        player_id: playerId,
        season: 2025,
        games_played: gamesPlayed,
        starts,
        offensive_snaps: randomInt(160, 620),
        defensive_snaps: null,
        special_teams_snaps: randomInt(0, 90),
        passing_yards: null,
        passing_tds: null,
        interceptions_thrown: null,
        rushing_attempts: randomInt(35, 210),
        rushing_yards: randomInt(210, 1280),
        rushing_tds: randomInt(2, 16),
        receptions: randomInt(4, 38),
        receiving_yards: randomInt(20, 410),
        receiving_tds: randomInt(0, 4),
        tackles: null,
        tackles_for_loss: null,
        sacks: null,
        interceptions: null,
        passes_defended: null,
        forced_fumbles: randomInt(0, 3),
        source: "Demo Production Model"
      };
    case "OL":
      return {
        player_id: playerId,
        season: 2025,
        games_played: gamesPlayed,
        starts,
        offensive_snaps: randomInt(240, 850),
        defensive_snaps: null,
        special_teams_snaps: randomInt(0, 45),
        passing_yards: null,
        passing_tds: null,
        interceptions_thrown: null,
        rushing_attempts: null,
        rushing_yards: null,
        rushing_tds: null,
        receptions: null,
        receiving_yards: null,
        receiving_tds: null,
        tackles: null,
        tackles_for_loss: null,
        sacks: null,
        interceptions: null,
        passes_defended: null,
        forced_fumbles: null,
        source: "Demo Production Model"
      };
  }
}

function generateNeeds(teamId: string, createdBy: string): NeedInsert[] {
  return needTemplates.map((template) => ({
    ...template,
    team_id: teamId,
    created_by: createdBy,
    status: "open"
  }));
}

function generateReviews(
  players: PlayerBundle[],
  needs: NeedInsert[],
  profiles: ProfileInsert[]
): ReviewInsert[] {
  const reviews: ReviewInsert[] = [];
  const candidateMap = new Map<Position, PlayerBundle[]>();

  for (const player of players) {
    const existing = candidateMap.get(player.player.position) ?? [];
    existing.push(player);
    candidateMap.set(player.player.position, existing);
  }

  const assistant = profiles.find((profile) => profile.role === "recruiting assistant")!;
  const coordinator = profiles.find((profile) => profile.role === "coordinator")!;
  const headCoach = profiles.find((profile) => profile.role === "head coach")!;

  needs.forEach((need, needIndex) => {
    const pool = (candidateMap.get(need.position) ?? [])
      .sort((a, b) => scorePlayerForNeed(b, need) - scorePlayerForNeed(a, need))
      .slice(0, 18);

    pool.slice(0, 10).forEach((bundle, index) => {
      const reviewer =
        index < 5 ? assistant.id : index < 8 ? coordinator.id : headCoach.id;
      const fitScore = scorePlayerForNeed(bundle, need);
      const decision: ReviewDecision =
        fitScore >= 84 ? "right" : fitScore >= 72 ? "save" : "left";

      reviews.push({
        id: crypto.randomUUID(),
        need_id: need.id,
        player_id: bundle.player.id,
        reviewer_id: reviewer,
        decision,
        fit_score: fitScore,
        notes: reviewNote(bundle, need, decision, needIndex + index)
      });
    });
  });

  return reviews.slice(0, 30);
}

function generateShortlists(
  teamId: string,
  createdBy: string,
  reviews: ReviewInsert[]
): ShortlistInsert[] {
  const advancing = reviews
    .filter((review) => review.decision !== "left")
    .sort((a, b) => b.fit_score - a.fit_score)
    .slice(0, 12);

  return advancing.map((review, index) => ({
    id: crypto.randomUUID(),
    need_id: review.need_id,
    player_id: review.player_id,
    team_id: teamId,
    created_by: createdBy,
    stage: stageDistribution[index],
    rank_order: index < 10 ? index + 1 : null,
    notes:
      stageDistribution[index] === "approved"
        ? "Approved for full staff push."
        : stageDistribution[index] === "passed"
          ? "Reviewed but deprioritized after cross-check."
          : "Still active in internal staff workflow."
  }));
}

function scorePlayerForNeed(bundle: PlayerBundle, need: NeedInsert): number {
  const measurement = bundle.measurement;
  const stat = bundle.stat;
  let score = 55;

  if (bundle.player.position === need.position) score += 10;
  if (need.min_height_in && measurement.height_in && measurement.height_in >= need.min_height_in) score += 6;
  if (need.min_weight_lbs && measurement.weight_lbs && measurement.weight_lbs >= need.min_weight_lbs) score += 6;
  if (need.min_starts && stat.starts >= need.min_starts) score += 7;
  if (need.min_years_remaining && bundle.player.years_remaining >= need.min_years_remaining) score += 4;
  if (need.max_years_remaining && bundle.player.years_remaining <= need.max_years_remaining) score += 3;

  if (bundle.player.position === "EDGE") score += Math.round((stat.sacks ?? 0) * 2.2 + (stat.tackles_for_loss ?? 0) * 1.2);
  if (bundle.player.position === "CB") score += Math.round((stat.interceptions ?? 0) * 4 + (stat.passes_defended ?? 0) * 1.3);
  if (bundle.player.position === "WR") score += Math.round((stat.receiving_yards ?? 0) / 55 + (stat.receiving_tds ?? 0) * 2.5);

  return Math.max(45, Math.min(score, 97));
}

function reviewNote(bundle: PlayerBundle, need: NeedInsert, decision: ReviewDecision, salt: number): string {
  const snippets = {
    left: [
      "Production is usable, but the profile does not clear the current threshold.",
      "Traits are interesting, but the staff bar is higher for this cycle.",
      "Would keep on the watch list, not on the active push board."
    ],
    save: [
      "Need one more pass on fit and role before escalating.",
      "Worth holding for coordinator review after film cross-check.",
      "Borderline fit with enough upside to keep alive."
    ],
    right: [
      "Clear fit for the board and worth immediate staff follow-up.",
      "Strong enough blend of traits and production to advance.",
      "Checks the measurable bar and has real play-speed production."
    ]
  };

  return `${need.position} eval: ${pick(snippets[decision], salt)} Highlight: ${bundle.player.film_url}`;
}

async function upsertTeam(team: TeamInsert) {
  const { error } = await supabase.from("teams").upsert(team);
  if (error) throw error;
}

async function upsertProfiles(profiles: ProfileInsert[]) {
  const { error } = await supabase.from("profiles").upsert(profiles);
  if (error) throw error;
}

async function upsertPlayers(players: PlayerInsert[]) {
  const { error } = await supabase
    .from("players")
    .upsert(players, { onConflict: "id" });
  if (error) throw error;
}

async function upsertMeasurements(measurements: MeasurementInsert[]) {
  const { error } = await supabase
    .from("player_measurements")
    .upsert(measurements, { onConflict: "player_id" });
  if (error) throw error;
}

async function upsertStats(stats: StatInsert[]) {
  const { error } = await supabase
    .from("player_stats")
    .upsert(stats, { onConflict: "player_id,season" });
  if (error) throw error;
}

async function upsertNeeds(needs: NeedInsert[]) {
  const { error } = await supabase
    .from("team_needs")
    .upsert(needs, { onConflict: "id" });
  if (error) throw error;
}

async function upsertReviews(reviews: ReviewInsert[]) {
  const { error } = await supabase
    .from("player_reviews")
    .upsert(reviews, { onConflict: "need_id,player_id,reviewer_id" });
  if (error) throw error;
}

async function upsertShortlists(shortlists: ShortlistInsert[]) {
  const { error } = await supabase
    .from("shortlists")
    .upsert(shortlists, { onConflict: "need_id,player_id" });
  if (error) throw error;
}

async function purgeTeamScopedData(teamId: string) {
  const teamNeedIds = await fetchIds("team_needs", "id", { team_id: teamId });

  if (teamNeedIds.length) {
    await must(supabase.from("shortlists").delete().in("need_id", teamNeedIds));
    await must(supabase.from("player_reviews").delete().in("need_id", teamNeedIds));
  }

  await must(supabase.from("team_needs").delete().eq("team_id", teamId));
  await must(supabase.from("profiles").delete().eq("team_id", teamId));
}

async function purgePlayerData() {
  await must(supabase.from("player_stats").delete().gte("season", 2025));
  await must(supabase.from("player_measurements").delete().not("player_id", "is", null));
  await must(supabase.from("players").delete().eq("transfer_cycle", TRANSFER_CYCLE));
}

async function fetchIds(
  table: string,
  column: string,
  filter: Record<string, string>
): Promise<string[]> {
  let query = supabase.from(table).select(column);
  for (const [key, value] of Object.entries(filter)) {
    query = query.eq(key, value);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row: Record<string, string>) => row[column]);
}

async function must<T>(promise: Promise<{ error: Error | null } & T>) {
  const result = await promise;
  if (result.error) throw result.error;
  return result;
}

function pick<T>(values: readonly T[], index: number): T {
  return values[index % values.length];
}

function pickClassYear(index: number): ClassYear {
  const plan: ClassYear[] = ["SO", "JR", "SR", "JR", "SO", "GR", "SR", "JR"];
  return pick(plan, index);
}

function deriveYearsRemaining(classYear: ClassYear): number {
  switch (classYear) {
    case "FR":
      return 4;
    case "SO":
      return 3;
    case "JR":
      return 2;
    case "SR":
      return 1;
    case "GR":
      return 1;
  }
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomInRange(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function round(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
