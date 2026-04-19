import { Player } from "@/lib/types";

type ProductionPlayer = Pick<Player, "position" | "latest_stats"> & {
  eligibility_remaining?: number | null;
};

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

export function getEspnHeadshotUrl(espnUrl: string | null | undefined): string | null {
  if (!espnUrl) return null;
  const match = espnUrl.match(/\/id\/(\d+)/);
  if (!match) return null;
  return `https://a.espncdn.com/i/headshots/college-football/players/full/${match[1]}.png`;
}

export function getPlayerPhotoUrl(player: Pick<Player, "first_name" | "last_name" | "photo_url">) {
  if (player.photo_url) return player.photo_url;
  const name = encodeURIComponent(`${player.first_name} ${player.last_name}`);
  return `https://ui-avatars.com/api/?name=${name}&background=0f172a&color=f8fafc&size=256`;
}

export function getPlayerDisplayConference(player: Pick<Player, "conference" | "current_school">) {
  return player.conference ?? getConferenceForSchool(player.current_school);
}

export function formatHeightInFeetInches(heightIn: number | null | undefined) {
  if (heightIn == null || !Number.isFinite(heightIn)) return "--";
  const feet = Math.floor(heightIn / 12);
  const inches = heightIn % 12;
  return `${feet}'${inches}"`;
}

export function getPlayerKeyStats(player: ProductionPlayer) {
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
        `${stats.rushing_tds ?? stats.total_touchdowns ?? 0} TD`,
        `${stats.games_played ?? 0} games`
      ];
    case "QB":
      return [
        `${stats.starts ?? 0} starts`,
        `${stats.passing_yards ?? 0} pass yds`,
        `${stats.passing_tds ?? stats.total_touchdowns ?? 0} pass TD`,
        `${stats.games_played ?? 0} games`
      ];
    case "OL":
      return [
        `${stats.starts ?? 0} starts`,
        `${stats.games_played ?? 0} games`,
        `${stats.offensive_snaps ?? 0} off snaps`,
        `${player.eligibility_remaining} yrs left`
      ];
    default:
      return [
        `${stats.starts ?? 0} starts`,
        `${stats.offensive_snaps ?? stats.defensive_snaps ?? 0} snaps`,
        `${stats.games_played ?? 0} games`,
        `${player.eligibility_remaining} yrs left`
      ];
  }
}

export function getPlayerProductionMetrics(
  player: ProductionPlayer,
  limit = 4
): Array<{ label: string; value: string }> {
  const stats = player.latest_stats;

  if (!stats) {
    return [
      { label: "Season", value: "No stats" },
      { label: "Status", value: "Pending import" }
    ].slice(0, limit);
  }

  const metricsByPosition: Record<string, Array<{ label: string; value: string }>> = {
    QB: [
      { label: "Pass yards", value: formatNumberStat(stats.passing_yards) },
      { label: "Pass TD", value: formatNumberStat(stats.passing_tds ?? stats.total_touchdowns) },
      { label: "Games", value: formatNumberStat(stats.games_played) },
      { label: "Starts", value: formatNumberStat(stats.starts) }
    ],
    RB: [
      { label: "Rush yards", value: formatNumberStat(stats.rushing_yards) },
      { label: "Rush TD", value: formatNumberStat(stats.rushing_tds ?? stats.total_touchdowns) },
      { label: "Carries", value: formatNumberStat(stats.rushing_attempts) },
      { label: "Games", value: formatNumberStat(stats.games_played) }
    ],
    WR: [
      { label: "Rec yards", value: formatNumberStat(stats.receiving_yards) },
      { label: "Receptions", value: formatNumberStat(stats.receptions) },
      { label: "Rec TD", value: formatNumberStat(stats.receiving_tds ?? stats.total_touchdowns) },
      { label: "Games", value: formatNumberStat(stats.games_played) }
    ],
    TE: [
      { label: "Rec yards", value: formatNumberStat(stats.receiving_yards) },
      { label: "Receptions", value: formatNumberStat(stats.receptions) },
      { label: "Rec TD", value: formatNumberStat(stats.receiving_tds ?? stats.total_touchdowns) },
      { label: "Starts", value: formatNumberStat(stats.starts) }
    ],
    OL: [
      { label: "Starts", value: formatNumberStat(stats.starts) },
      { label: "Games", value: formatNumberStat(stats.games_played) },
      { label: "Off snaps", value: formatNumberStat(stats.offensive_snaps) },
      { label: "ST snaps", value: formatNumberStat(stats.special_teams_snaps) }
    ],
    EDGE: [
      { label: "Tackles", value: formatNumberStat(stats.tackles) },
      { label: "Sacks", value: formatDecimalStat(stats.sacks) },
      { label: "TFL", value: formatDecimalStat(stats.tackles_for_loss) },
      { label: "FF", value: formatNumberStat(stats.forced_fumbles) }
    ],
    DL: [
      { label: "Tackles", value: formatNumberStat(stats.tackles) },
      { label: "Sacks", value: formatDecimalStat(stats.sacks) },
      { label: "TFL", value: formatDecimalStat(stats.tackles_for_loss) },
      { label: "Games", value: formatNumberStat(stats.games_played) }
    ],
    LB: [
      { label: "Tackles", value: formatNumberStat(stats.tackles) },
      { label: "Sacks", value: formatDecimalStat(stats.sacks) },
      { label: "INT", value: formatNumberStat(stats.interceptions) },
      { label: "TFL", value: formatDecimalStat(stats.tackles_for_loss) }
    ],
    CB: [
      { label: "INT", value: formatNumberStat(stats.interceptions) },
      { label: "PD", value: formatNumberStat(stats.passes_defended) },
      { label: "Tackles", value: formatNumberStat(stats.tackles) },
      { label: "Games", value: formatNumberStat(stats.games_played) }
    ],
    S: [
      { label: "INT", value: formatNumberStat(stats.interceptions) },
      { label: "PD", value: formatNumberStat(stats.passes_defended) },
      { label: "Tackles", value: formatNumberStat(stats.tackles) },
      { label: "Games", value: formatNumberStat(stats.games_played) }
    ],
    ST: [
      { label: "Games", value: formatNumberStat(stats.games_played) },
      { label: "ST snaps", value: formatNumberStat(stats.special_teams_snaps) },
      { label: "Tackles", value: formatNumberStat(stats.tackles) },
      { label: "Starts", value: formatNumberStat(stats.starts) }
    ]
  };

  const metrics =
    metricsByPosition[player.position] ?? [
      { label: "Games", value: formatNumberStat(stats.games_played) },
      { label: "Starts", value: formatNumberStat(stats.starts) }
    ];

  return metrics.filter((metric) => metric.value !== "--").slice(0, limit);
}

export function getPlayerPrimaryProduction(player: ProductionPlayer) {
  const metric = getPlayerProductionMetrics(player, 1)[0];
  return metric ? `${metric.label}: ${metric.value}` : "No season stats";
}

function formatNumberStat(value: number | null | undefined) {
  return value == null ? "--" : String(value);
}

function formatDecimalStat(value: number | null | undefined) {
  return value == null ? "--" : Number.isInteger(value) ? String(value) : value.toFixed(1);
}
