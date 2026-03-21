/**
 * Sportradar NCAA Football API – Transfer Portal
 * https://developer.sportradar.com/football/reference/ncaafb-transfer-portal
 *
 * Auth: x-api-key header (trial or production key).
 * Endpoint: GET .../ncaafb/{access_level}/v7/en/league/transfer_portal.json
 */

export interface SportradarTransferPortalPlayer {
  id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  abbr_name: string;
  height: number;
  weight: number;
  eligibility: string;
  birth_place: string;
  updated: string;
  position: string;
}

export interface SportradarTransferPortalResponse {
  league: {
    id: string;
    name: string;
    alias: string;
    transfer_portal_players: SportradarTransferPortalPlayer[];
  };
  _comment?: string;
}

const POSITION_GROUP = [
  "QB",
  "RB",
  "WR",
  "TE",
  "OL",
  "EDGE",
  "DL",
  "LB",
  "CB",
  "S",
  "ST"
] as const;
export type PositionGroup = (typeof POSITION_GROUP)[number];

/** Map Sportradar position codes to our position_group enum. */
const POSITION_MAP: Record<string, PositionGroup> = {
  QB: "QB",
  RB: "RB",
  WR: "WR",
  TE: "TE",
  G: "OL",
  T: "OL",
  C: "OL",
  OL: "OL",
  OT: "OL",
  OG: "OL",
  DE: "EDGE",
  OLB: "EDGE",
  EDGE: "EDGE",
  DL: "DL",
  DT: "DL",
  NT: "DL",
  LB: "LB",
  ILB: "LB",
  MLB: "LB",
  CB: "CB",
  S: "S",
  SAF: "S",
  SS: "S",
  FS: "S",
  DB: "CB",
  K: "ST",
  P: "ST",
  LS: "ST",
  PK: "ST"
};

export function mapSportradarPosition(srPosition: string): PositionGroup {
  const normalized = srPosition?.trim().toUpperCase() || "";
  return POSITION_MAP[normalized] ?? "LB";
}

/** Parse "Hollywood, FL, USA" into hometown and state. */
export function parseBirthPlace(birthPlace: string | null | undefined): {
  hometown: string | null;
  state: string | null;
} {
  if (!birthPlace?.trim()) return { hometown: null, state: null };
  const parts = birthPlace.split(",").map((p) => p.trim());
  if (parts.length >= 2) {
    const state = parts[parts.length - 1].replace(/\s*USA\s*$/i, "").trim() || null;
    const hometown = parts.slice(0, -1).join(", ") || null;
    return { hometown: hometown || null, state: state || null };
  }
  return { hometown: birthPlace || null, state: null };
}

/** FR/SO/JR/SR/GR -> years of eligibility remaining (approximate). */
export function eligibilityRemaining(eligibility: string): number {
  const e = eligibility?.toUpperCase();
  switch (e) {
    case "FR":
      return 4;
    case "SO":
      return 3;
    case "JR":
      return 2;
    case "SR":
    case "GR":
      return 1;
    default:
      return 1;
  }
}

export interface TransferPortalConfig {
  apiKey: string;
  accessLevel?: "trial" | "production";
  baseUrl?: string;
}

const DEFAULT_BASE_URL = "https://api.sportradar.us/ncaafb";

export async function fetchTransferPortal(
  config: TransferPortalConfig
): Promise<SportradarTransferPortalResponse> {
  const { apiKey, accessLevel = "trial", baseUrl = DEFAULT_BASE_URL } = config;
  const url = `${baseUrl}/${accessLevel}/v7/en/league/transfer_portal.json`;
  const res = await fetch(url, {
    headers: {
      "x-api-key": apiKey,
      Accept: "application/json"
    }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sportradar transfer portal API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<SportradarTransferPortalResponse>;
}
