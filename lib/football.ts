import { Player } from "@/lib/types";

const schoolConferenceMap: Record<string, string> = {
  "App State": "Sun Belt",
  "Arkansas State": "Sun Belt",
  "Boise State": "Mountain West",
  "Buffalo": "MAC",
  "Charlotte": "AAC",
  "Coastal Carolina": "Sun Belt",
  "Colorado State": "Mountain West",
  "FIU": "CUSA",
  "Fresno State": "Mountain West",
  "Georgia State": "Sun Belt",
  "James Madison": "Sun Belt",
  "Kansas State": "Big 12",
  "Liberty": "CUSA",
  "Louisville": "ACC",
  "Marshall": "Sun Belt",
  "Memphis": "AAC",
  "Miami (OH)": "MAC",
  "Middle Tennessee": "CUSA",
  "Mississippi State": "SEC",
  "Missouri": "SEC",
  "NC State": "ACC",
  "Nevada": "Mountain West",
  "North Texas": "AAC",
  "Ohio": "MAC",
  "Ole Miss": "SEC",
  "San Diego State": "Mountain West",
  "South Alabama": "Sun Belt",
  "Temple": "AAC",
  "Texas State": "Sun Belt",
  "Texas Tech": "Big 12",
  "Toledo": "MAC",
  "Troy": "Sun Belt",
  "Tulane": "AAC",
  "UAB": "AAC",
  "UTSA": "AAC",
  "Western Kentucky": "CUSA",
  "Wyoming": "Mountain West"
};

export function getConferenceForSchool(school: string) {
  return schoolConferenceMap[school] ?? "FBS";
}

export function getPlayerPhotoUrl(player: Pick<Player, "first_name" | "last_name" | "photo_url">) {
  if (player.photo_url) return player.photo_url;
  const name = encodeURIComponent(`${player.first_name} ${player.last_name}`);
  return `https://ui-avatars.com/api/?name=${name}&background=0f172a&color=f8fafc&size=256`;
}

export function getPlayerDisplayConference(player: Pick<Player, "conference" | "current_school">) {
  return player.conference ?? getConferenceForSchool(player.current_school);
}

export function getPlayerKeyStats(player: Player) {
  const stats = player.latest_stats;
  if (!stats) {
    return ["No season stats", "Profile pending", "Portal eval", "Open board"];
  }

  switch (player.position) {
    case "EDGE":
    case "DL":
      return [
        `${stats.starts ?? 0} starts`,
        `${stats.tackles ?? 0} tackles`,
        `${stats.sacks ?? 0} sacks`,
        `${stats.passes_defended ?? 0} PD`
      ];
    case "LB":
      return [
        `${stats.starts ?? 0} starts`,
        `${stats.tackles ?? 0} tackles`,
        `${stats.sacks ?? 0} sacks`,
        `${stats.interceptions ?? 0} INT`
      ];
    case "CB":
    case "S":
      return [
        `${stats.starts ?? 0} starts`,
        `${stats.interceptions ?? 0} INT`,
        `${stats.passes_defended ?? 0} PD`,
        `${stats.tackles ?? 0} tackles`
      ];
    case "WR":
    case "TE":
      return [
        `${stats.starts ?? 0} starts`,
        `${stats.receiving_yards ?? 0} rec yds`,
        `${stats.total_touchdowns ?? 0} TD`,
        `${stats.games_played ?? 0} games`
      ];
    case "RB":
      return [
        `${stats.starts ?? 0} starts`,
        `${stats.rushing_yards ?? 0} rush yds`,
        `${stats.total_touchdowns ?? 0} TD`,
        `${stats.games_played ?? 0} games`
      ];
    default:
      return [
        `${stats.starts ?? 0} starts`,
        `${stats.offensive_snaps ?? 0} snaps`,
        `${stats.games_played ?? 0} games`,
        `${player.eligibility_remaining} yrs left`
      ];
  }
}
