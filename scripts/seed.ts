import { createClient } from "@supabase/supabase-js";

type Role = "recruiting assistant" | "coordinator" | "head coach";
type Position = "EDGE" | "DL" | "LB" | "CB" | "WR" | "RB" | "OL";
type ClassYear = "FR" | "SO" | "JR" | "SR" | "GR";
type NeedPriority = "high" | "critical" | "medium";
type ReviewDecision = "left" | "right" | "save";
type ShortlistStage = "assistant" | "coordinator" | "head_coach" | "final_watch";

interface TeamInsert {
  id: string;
  name: string;
  conference: string;
  logo_url: string | null;
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
  transfer_year: number;
  current_school: string;
  conference: string | null;
  previous_school: string | null;
  hometown: string | null;
  state: string | null;
  class_year: ClassYear;
  eligibility_remaining: number;
  stars: number | null;
  academic_status: string | null;
  status: "Portal";
  film_url: string;
  photo_url: string;
  contact_window: string | null;
  notes: string | null;
}

interface MeasurementInsert {
  player_id: string;
  height_in: number | null;
  weight_lbs: number | null;
  arm_length_in: number | null;
  forty_time: number | null;
  shuttle_time: number | null;
  vertical_jump: number | null;
  wing_span_in: number | null;
  verified_at: string | null;
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
  rushing_yards: number | null;
  receiving_yards: number | null;
  total_touchdowns: number | null;
  tackles: number | null;
  sacks: number | null;
  interceptions: number | null;
  passes_defended: number | null;
}

interface NeedInsert {
  id: string;
  team_id: string;
  created_by: string;
  title: string;
  position: Position;
  priority: NeedPriority;
  status: "active";
  target_count: number;
  class_focus: string | null;
  min_height_in: number | null;
  max_height_in: number | null;
  min_weight_lbs: number | null;
  max_weight_lbs: number | null;
  min_arm_length_in: number | null;
  max_forty_time: number | null;
  min_years_remaining: number | null;
  scheme: string | null;
  priority_traits: string[];
  production_filters: {
    min_games_played: number | null;
    min_starts: number | null;
    stat_key: string | null;
    min_stat_value: number | null;
  };
  min_starts: number | null;
  min_production_score: number | null;
  notes: string;
}

interface ReviewInsert {
  id: string;
  need_id: string;
  player_id: string;
  reviewer_id: string;
  decision: ReviewDecision;
  fit_score: number;
  note: string;
}

interface ShortlistInsert {
  id: string;
  need_id: string;
  player_id: string;
  created_by: string;
  stage: ShortlistStage;
  priority_rank: number | null;
  note: string;
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
const requestedPlayerCount = Number(process.argv[2] ?? process.env.SEED_PLAYER_COUNT ?? "100");
const PLAYER_COUNT = Number.isFinite(requestedPlayerCount)
  ? Math.max(100, Math.min(Math.trunc(requestedPlayerCount), 5000))
  : 100;

const users = [
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
  "Rashad", "Tyler", "Brandon", "Corey", "Aiden", "Jaylen", "Caden", "Omari", "Kendrick", "Treyvon",
  "Marcellus", "DeAndre", "Tavian", "Jaheim", "Khalil", "Jordon", "Donovan", "Desmond", "Zaire", "Kameron",
  "Elijah", "Triston", "Landen", "Nasir", "Jace", "Dre", "Raylen", "Tatum", "Colby", "Shamar",
  "Caleb", "CJ", "Damon", "Terrance", "Jaeden", "Jahmir", "Tylan", "Avery", "Jabari", "Mekhi",
  "Antonio", "Roderick", "Nico", "Sincere", "Devonte", "KJ", "Kylan", "Traylon", "Montrell", "Zakai",
  "Taj", "Kasen", "Makai", "Demonte", "Jayce", "Braylon", "Khyree", "Prince", "Khalan", "Deuce"
];

const lastNames = [
  "Denson", "McCoy", "Sanders", "Holloway", "Watkins", "Miller", "Bishop", "Griffin", "Boone", "Hayes",
  "Morris", "Franklin", "Turner", "Parks", "Caldwell", "Maddox", "Pryor", "Waller", "Livingston", "Nash",
  "Thornton", "Benson", "Pope", "Hampton", "Cooper", "Ricks", "Spears", "Grimes", "McKinney", "Ward",
  "Blackmon", "Jefferson", "Vaughn", "Coleman", "Peoples", "Henderson", "Richardson", "Slade", "Roland", "Fleming",
  "Whitaker", "Booker", "McClain", "Foster", "Gordon", "Sampson", "Tillman", "Hickman", "Burt", "McDaniel",
  "Gaines", "Moten", "Langston", "Dudley", "Conyers", "Huggins", "Bynum", "Atkins", "Pettway", "Merriweather",
  "Calloway", "McFarland", "Bowie", "Dilworth", "Westbrook", "Bracey", "Goodwin", "Lockett", "Nolen", "Gipson",
  "Ragland", "Curry", "Tatum", "Ferguson", "Drummond", "Pruitt", "Burks", "Beckham", "Chatman", "Moultrie"
];

const schools = [
  "UTSA", "Tulane", "Memphis", "North Texas", "Boise State", "Fresno State", "Colorado State",
  "San Diego State", "Liberty", "James Madison", "Coastal Carolina", "App State", "Troy",
  "Texas State", "Marshall", "Toledo", "Miami (OH)", "Ohio", "Western Kentucky", "Georgia State",
  "Nevada", "Arkansas State", "UAB", "Charlotte", "Temple", "Buffalo", "Middle Tennessee", "FIU",
  "Wyoming", "South Alabama", "Kansas State", "Baylor", "Texas Tech", "Ole Miss", "Mississippi State",
  "Missouri", "NC State", "Louisville"
];
const schoolConferenceMap: Record<string, string> = {
  UTSA: "American",
  Tulane: "American",
  Memphis: "American",
  "North Texas": "American",
  "Boise State": "Mountain West",
  "Fresno State": "Mountain West",
  "Colorado State": "Mountain West",
  "San Diego State": "Mountain West",
  Liberty: "Conference USA",
  "James Madison": "Sun Belt",
  "Coastal Carolina": "Sun Belt",
  "App State": "Sun Belt",
  Troy: "Sun Belt",
  "Texas State": "Sun Belt",
  Marshall: "Sun Belt",
  Toledo: "MAC",
  "Miami (OH)": "MAC",
  Ohio: "MAC",
  "Western Kentucky": "Conference USA",
  "Georgia State": "Sun Belt",
  Nevada: "Mountain West",
  "Arkansas State": "Sun Belt",
  UAB: "American",
  Charlotte: "American",
  Temple: "American",
  Buffalo: "MAC",
  "Middle Tennessee": "Conference USA",
  FIU: "Conference USA",
  Wyoming: "Mountain West",
  "South Alabama": "Sun Belt",
  "Kansas State": "Big 12",
  Baylor: "Big 12",
  "Texas Tech": "Big 12",
  "Ole Miss": "SEC",
  "Mississippi State": "SEC",
  Missouri: "SEC",
  "NC State": "ACC",
  Louisville: "ACC"
};

const states = ["TX", "FL", "GA", "AL", "LA", "MS", "NC", "SC", "TN", "OK", "AZ", "CA"];
const cities = ["Houston", "Dallas", "Atlanta", "Mobile", "Birmingham", "New Orleans", "Charlotte", "Memphis", "Tulsa", "Phoenix", "Orlando", "Tampa"];


const shortlistStages: ShortlistStage[] = [
  "assistant",
  "assistant",
  "assistant",
  "coordinator",
  "coordinator",
  "coordinator",
  "head_coach",
  "head_coach",
  "final_watch",
  "final_watch",
  "final_watch",
  "final_watch"
];

async function main() {
  console.log("Seeding recruiting workflow demo data...");

  const team: TeamInsert = {
    id: TEAM_ID,
    name: "Red Valley Football",
    conference: "Big 12",
    logo_url: null
  };

  await upsertTeam(team);
  const profiles = await upsertUsersAndProfiles(team.id);
  const players = generatePlayers(PLAYER_COUNT);
  const reviews = generateReviews(players, [], profiles);
  const shortlists = generateShortlists(profiles[1].id, reviews);

  await purgeScopedData(team.id);

  await upsertTeam(team);
  await upsertProfiles(profiles);
  await upsertPlayers(players.map((item) => item.player));
  await upsertMeasurements(players.map((item) => item.measurement));
  await upsertStats(players.map((item) => item.stat));
  await upsertReviews(reviews);
  await upsertShortlists(shortlists);

  console.log("Seed complete.");
  console.log(`Team: ${team.name}`);
  console.log(`Profiles: ${profiles.length}`);
  console.log(`Players: ${players.length}`);
  console.log(`Reviews: ${reviews.length}`);
  console.log(`Shortlists: ${shortlists.length}`);
}

async function upsertUsersAndProfiles(teamId: string): Promise<ProfileInsert[]> {
  const profiles: ProfileInsert[] = [];

  for (const user of users) {
    const existing = await supabase.auth.admin.getUserById(user.id);
    if (existing.error && !existing.error.message.toLowerCase().includes("not found")) {
      throw existing.error;
    }

    if (!existing.data.user) {
      const created = await supabase.auth.admin.createUser({
        id: user.id,
        email: user.email,
        password: user.password,
        email_confirm: true
      });

      if (created.error) throw created.error;
    }

    profiles.push({
      id: user.id,
      team_id: teamId,
      full_name: user.full_name,
      role: user.role
    });
  }

  return profiles;
}

function generatePlayers(count: number): PlayerBundle[] {
  const ratios: Array<{ position: Position; weight: number }> = [
    { position: "EDGE", weight: 0.2 },
    { position: "CB", weight: 0.18 },
    { position: "DL", weight: 0.14 },
    { position: "LB", weight: 0.12 },
    { position: "WR", weight: 0.16 },
    { position: "RB", weight: 0.1 },
    { position: "OL", weight: 0.1 }
  ];
  const positionPlan = buildPositionPlan(count, ratios);

  return positionPlan.slice(0, count).map((position, index) => {
    const playerId = crypto.randomUUID();
    const school = pick(schools, index * 5);
    const classYear = pickClassYear(index);
    const { firstName, lastName } = getUniquePlayerName(index);

    const player: PlayerInsert = {
      id: playerId,
      first_name: firstName,
      last_name: lastName,
      position,
      transfer_year: TRANSFER_CYCLE,
      current_school: school,
      conference: schoolConferenceMap[school] ?? null,
      previous_school: index % 5 === 0 ? pick(schools, index * 7 + 2) : null,
      hometown: `${pick(cities, index * 2)}, ${pick(states, index * 4)}`,
      state: pick(states, index * 4),
      class_year: classYear,
      eligibility_remaining: deriveYearsRemaining(classYear),
      stars: index % 9 === 0 ? 4 : index % 3 === 0 ? 3 : 2,
      academic_status: "Eligible",
      status: "Portal",
      film_url: `https://hudl.com/video/3/${100000 + index}/${900000 + index}`,
      photo_url: `https://images.unsplash.com/photo-${1500000000000 + index}?auto=format&fit=crop&w=800&q=80`,
      contact_window: index % 3 === 0 ? "Spring" : "Open",
      notes: `${position} profile with live portal value and ${pick(["starter reps", "special teams utility", "upside traits", "immediate depth"], index)}.`
    };

    return {
      player,
      measurement: generateMeasurement(playerId, position, index),
      stat: generateStat(playerId, position)
    };
  });
}

function generateMeasurement(playerId: string, position: Position, index: number): MeasurementInsert {
  const missing = (mod: number) => index % mod === 0;
  const ranges: Record<
    Position,
    { height: [number, number]; weight: [number, number]; arm: [number, number]; forty: [number, number]; shuttle: [number, number]; vertical: [number, number]; wingspan: [number, number] }
  > = {
    EDGE: { height: [74, 79], weight: [232, 265], arm: [32.5, 35], forty: [4.58, 4.89], shuttle: [4.18, 4.62], vertical: [29, 37], wingspan: [77, 84] },
    DL: { height: [73, 78], weight: [275, 325], arm: [32, 35], forty: [4.88, 5.32], shuttle: [4.45, 5.02], vertical: [24, 33], wingspan: [76, 83] },
    LB: { height: [72, 77], weight: [220, 248], arm: [31, 34], forty: [4.52, 4.82], shuttle: [4.12, 4.44], vertical: [31, 39], wingspan: [75, 81] },
    CB: { height: [69, 74], weight: [175, 205], arm: [30.5, 33], forty: [4.34, 4.58], shuttle: [3.96, 4.26], vertical: [34, 42], wingspan: [72, 78] },
    WR: { height: [69, 76], weight: [176, 215], arm: [30, 33.5], forty: [4.33, 4.59], shuttle: [3.98, 4.28], vertical: [33, 41], wingspan: [72, 79] },
    RB: { height: [68, 73], weight: [188, 222], arm: [29, 32], forty: [4.36, 4.63], shuttle: [4.0, 4.31], vertical: [33, 41], wingspan: [70, 76] },
    OL: { height: [75, 80], weight: [285, 335], arm: [33, 36], forty: [5.02, 5.48], shuttle: [4.55, 5.1], vertical: [22, 31], wingspan: [79, 86] }
  };

  const range = ranges[position];
  return {
    player_id: playerId,
    height_in: missing(11) ? null : randomInt(range.height[0], range.height[1]),
    weight_lbs: missing(13) ? null : randomInt(range.weight[0], range.weight[1]),
    arm_length_in: missing(9) ? null : round(randomInRange(range.arm[0], range.arm[1]), 1),
    forty_time: missing(6) ? null : round(randomInRange(range.forty[0], range.forty[1]), 2),
    shuttle_time: missing(8) ? null : round(randomInRange(range.shuttle[0], range.shuttle[1]), 2),
    vertical_jump: missing(10) ? null : round(randomInRange(range.vertical[0], range.vertical[1]), 1),
    wing_span_in: missing(12) ? null : round(randomInRange(range.wingspan[0], range.wingspan[1]), 1),
    verified_at: missing(14) ? null : "2026-01-15"
  };
}

function generateStat(playerId: string, position: Position): StatInsert {
  const gamesPlayed = randomInt(8, 14);
  const starts = randomInt(0, gamesPlayed);

  switch (position) {
    case "EDGE":
      return baseStat(playerId, gamesPlayed, starts, {
        defensive_snaps: randomInt(220, 620),
        special_teams_snaps: randomInt(0, 90),
        tackles: randomInt(18, 58),
        sacks: round(randomInRange(1.5, 10.5), 1),
        passes_defended: randomInt(0, 5)
      });
    case "DL":
      return baseStat(playerId, gamesPlayed, starts, {
        defensive_snaps: randomInt(240, 650),
        special_teams_snaps: randomInt(0, 40),
        tackles: randomInt(22, 64),
        sacks: round(randomInRange(0.5, 7.5), 1),
        passes_defended: randomInt(0, 4)
      });
    case "LB":
      return baseStat(playerId, gamesPlayed, starts, {
        defensive_snaps: randomInt(260, 720),
        special_teams_snaps: randomInt(10, 140),
        tackles: randomInt(38, 108),
        sacks: round(randomInRange(0, 5.5), 1),
        interceptions: randomInt(0, 3),
        passes_defended: randomInt(1, 8)
      });
    case "CB":
      return baseStat(playerId, gamesPlayed, starts, {
        defensive_snaps: randomInt(260, 740),
        special_teams_snaps: randomInt(10, 120),
        tackles: randomInt(18, 61),
        sacks: round(randomInRange(0, 2), 1),
        interceptions: randomInt(0, 5),
        passes_defended: randomInt(3, 16)
      });
    case "WR":
      return baseStat(playerId, gamesPlayed, starts, {
        offensive_snaps: randomInt(180, 760),
        special_teams_snaps: randomInt(0, 120),
        rushing_yards: randomInt(0, 120),
        receiving_yards: randomInt(180, 1240),
        total_touchdowns: randomInt(1, 13)
      });
    case "RB":
      return baseStat(playerId, gamesPlayed, starts, {
        offensive_snaps: randomInt(160, 620),
        special_teams_snaps: randomInt(0, 90),
        rushing_yards: randomInt(210, 1280),
        receiving_yards: randomInt(20, 410),
        total_touchdowns: randomInt(2, 16)
      });
    case "OL":
      return baseStat(playerId, gamesPlayed, starts, {
        offensive_snaps: randomInt(240, 850),
        special_teams_snaps: randomInt(0, 45)
      });
  }
}

function baseStat(
  playerId: string,
  gamesPlayed: number,
  starts: number,
  overrides: Partial<StatInsert>
): StatInsert {
  return {
    player_id: playerId,
    season: 2025,
    games_played: gamesPlayed,
    starts,
    offensive_snaps: null,
    defensive_snaps: null,
    special_teams_snaps: null,
    passing_yards: null,
    rushing_yards: null,
    receiving_yards: null,
    total_touchdowns: 0,
    tackles: null,
    sacks: null,
    interceptions: null,
    passes_defended: null,
    ...overrides
  };
}


function generateReviews(players: PlayerBundle[], needs: NeedInsert[], profiles: ProfileInsert[]) {
  const reviews: ReviewInsert[] = [];
  const byPosition = new Map<Position, PlayerBundle[]>();

  for (const player of players) {
    const current = byPosition.get(player.player.position) ?? [];
    current.push(player);
    byPosition.set(player.player.position, current);
  }

  const assistant = profiles[0];
  const coordinator = profiles[1];
  const headCoach = profiles[2];

  needs.forEach((need, needIndex) => {
    const pool = (byPosition.get(need.position) ?? [])
      .sort((a, b) => scorePlayerForNeed(b, need) - scorePlayerForNeed(a, need))
      .slice(0, 18);

    pool.slice(0, 10).forEach((bundle, index) => {
      const reviewer = index < 5 ? assistant.id : index < 8 ? coordinator.id : headCoach.id;
      const fitScore = scorePlayerForNeed(bundle, need);
      const decision: ReviewDecision = fitScore >= 84 ? "right" : fitScore >= 72 ? "save" : "left";

      reviews.push({
        id: crypto.randomUUID(),
        need_id: need.id,
        player_id: bundle.player.id,
        reviewer_id: reviewer,
        decision,
        fit_score: fitScore,
        note: reviewNote(bundle, need, decision, needIndex + index)
      });
    });
  });

  return reviews.slice(0, 30);
}

function generateShortlists(createdBy: string, reviews: ReviewInsert[]): ShortlistInsert[] {
  const advancing = reviews
    .filter((review) => review.decision !== "left")
    .sort((a, b) => b.fit_score - a.fit_score)
    .slice(0, 12);

  return advancing.map((review, index) => ({
    id: crypto.randomUUID(),
    need_id: review.need_id,
    player_id: review.player_id,
    created_by: createdBy,
    stage: shortlistStages[index],
    priority_rank: index < 10 ? index + 1 : null,
    note:
      shortlistStages[index] === "final_watch"
        ? "Final watch list for next board turn."
        : "Still active in internal staff workflow."
  }));
}

function scorePlayerForNeed(bundle: PlayerBundle, need: NeedInsert) {
  let score = 55;
  if (bundle.player.position === need.position) score += 10;
  if (need.min_height_in && bundle.measurement.height_in && bundle.measurement.height_in >= need.min_height_in) score += 6;
  if (need.min_weight_lbs && bundle.measurement.weight_lbs && bundle.measurement.weight_lbs >= need.min_weight_lbs) score += 6;
  if (need.min_starts && bundle.stat.starts >= need.min_starts) score += 7;
  if (need.min_years_remaining && bundle.player.eligibility_remaining >= need.min_years_remaining) score += 4;

  if (bundle.player.position === "EDGE") score += Math.round((bundle.stat.sacks ?? 0) * 2.2 + (bundle.stat.tackles ?? 0) * 0.4);
  if (bundle.player.position === "CB") score += Math.round((bundle.stat.interceptions ?? 0) * 4 + (bundle.stat.passes_defended ?? 0) * 1.3);
  if (bundle.player.position === "WR") score += Math.round((bundle.stat.receiving_yards ?? 0) / 55 + (bundle.stat.total_touchdowns ?? 0) * 2.5);

  return Math.max(45, Math.min(score, 97));
}

function reviewNote(bundle: PlayerBundle, need: NeedInsert, decision: ReviewDecision, salt: number) {
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
  const { error } = await supabase.from("teams").upsert(team, { onConflict: "id" });
  if (error) throw error;
}

async function upsertProfiles(profiles: ProfileInsert[]) {
  const { error } = await supabase.from("profiles").upsert(profiles, { onConflict: "id" });
  if (error) throw error;
}

async function upsertPlayers(players: PlayerInsert[]) {
  const { error } = await supabase.from("players").upsert(players, { onConflict: "id" });
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

async function purgeScopedData(teamId: string) {
  const { data: teamNeedRows } = await supabase.from("team_needs").select("id").eq("team_id", teamId);
  const needIds = (teamNeedRows ?? []).map((row) => row.id);

  if (needIds.length) {
    await must(supabase.from("shortlists").delete().in("need_id", needIds));
    await must(supabase.from("player_reviews").delete().in("need_id", needIds));
  }

  await must(supabase.from("team_needs").delete().eq("team_id", teamId));
  await must(supabase.from("profiles").delete().eq("team_id", teamId));
  await must(supabase.from("player_stats").delete().gte("season", 2025));
  await must(supabase.from("player_measurements").delete().not("player_id", "is", null));
  await must(supabase.from("players").delete().eq("transfer_year", TRANSFER_CYCLE));
}

async function must<T extends { error: Error | null }>(operation: PromiseLike<T>) {
  const result = await operation;
  if (result.error) throw result.error;
  return result;
}

function repeatPosition(position: Position, count: number): Position[] {
  return Array.from({ length: count }, () => position);
}

function getUniquePlayerName(index: number) {
  const firstName = firstNames[index % firstNames.length];
  const lastIndex = (index * 17 + Math.floor(index / firstNames.length) * 11) % lastNames.length;
  const lastName = lastNames[lastIndex];

  return { firstName, lastName };
}

function buildPositionPlan(
  count: number,
  ratios: Array<{ position: Position; weight: number }>
): Position[] {
  const plan: Position[] = [];

  for (const ratio of ratios) {
    plan.push(...repeatPosition(ratio.position, Math.floor(count * ratio.weight)));
  }

  while (plan.length < count) {
    plan.push(ratios[plan.length % ratios.length].position);
  }

  return plan.slice(0, count);
}

function pick<T>(values: readonly T[], index: number) {
  return values[index % values.length];
}

function pickClassYear(index: number): ClassYear {
  const plan: ClassYear[] = ["SO", "JR", "SR", "JR", "SO", "GR", "SR", "JR"];
  return pick(plan, index);
}

function deriveYearsRemaining(classYear: ClassYear) {
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
