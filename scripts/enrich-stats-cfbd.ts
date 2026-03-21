/**
 * Enrich players with seasonal stats from CollegeFootballData (CFBD).
 *
 * Why: Sportradar trial keys often hit hard quota caps ("Limit Exceeded"). CFBD provides
 * a usable stats fallback (1k/month in your plan).
 *
 * This script fetches stats per TEAM+YEAR (not per player) to minimize API calls,
 * then matches rows to players by full name and upserts into player_stats.
 *
 * Prereqs:
 *   - .env or .env.local:
 *     - CFBD_API_KEY
 *     - NEXT_PUBLIC_SUPABASE_URL
 *     - SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional:
 *   - CFBD_BASE_URL (default https://api.collegefootballdata.com)
 *   - CFBD_SEASON=2024 (default: TRANSFER_YEAR-1)
 *   - TRANSFER_YEAR=2026 (default: current year)
 *
 * Run: npm run enrich:stats:cfbd
 */

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { normalizeSchoolForMatch } from "@/lib/measurables/pro-day-urls";
import {
  fetchCfbdTransferPortal,
  fetchCfbdPlayerSeasonStats,
  mapCfbdRowsToOurSchema
} from "@/lib/cfbd/player-season-stats";

type StatInsert = Database["public"]["Tables"]["player_stats"]["Insert"];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const cfbdKey = process.env.CFBD_API_KEY;
const cfbdBaseUrl = process.env.CFBD_BASE_URL;
const transferYear = Number(process.env.TRANSFER_YEAR) || new Date().getFullYear();
const season = Number(process.env.CFBD_SEASON) || transferYear - 1;
const portalYear = Number(process.env.CFBD_PORTAL_YEAR) || transferYear;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!cfbdKey) {
  console.error("Missing CFBD_API_KEY");
  process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, serviceRoleKey);

function normName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function pickTeamForStats(p: {
  current_school: string;
  previous_school: string | null;
}): string | null {
  // We prefer previous_school (the team he played for). If missing, try current_school when it's a real school.
  const prev = p.previous_school?.trim();
  if (prev) return prev;
  const cur = p.current_school?.trim();
  if (!cur) return null;
  if (normalizeSchoolForMatch(cur) === "transfer-portal") return null;
  return cur;
}

async function main() {
  const { data: players, error } = await supabase
    .from("players")
    .select("id, first_name, last_name, current_school, previous_school")
    .order("last_name");

  if (error) {
    console.error("Fetch players error:", error);
    process.exit(1);
  }
  if (!players?.length) {
    console.log("No players found.");
    return;
  }

  // If previous_school is missing for most players, use CFBD's transfer portal feed to supply origin teams.
  console.log(`Fetching CFBD transfer portal (${portalYear}) to map origins...`);
  const portal = await fetchCfbdTransferPortal({
    year: portalYear,
    config: { apiKey: cfbdKey, ...(cfbdBaseUrl ? { baseUrl: cfbdBaseUrl } : {}) }
  });
  const portalOriginByName = new Map<string, string>();
  for (const item of portal) {
    const key = normName(`${item.firstName} ${item.lastName}`);
    // Keep first origin we see; portal can have duplicates across windows.
    if (!portalOriginByName.has(key) && item.origin) portalOriginByName.set(key, item.origin);
  }

  const needStats = players
    .map((p) => {
      const nameKey = normName(`${p.first_name} ${p.last_name}`);
      const portalOrigin = portalOriginByName.get(nameKey) ?? null;
      const team = pickTeamForStats(p) ?? portalOrigin;
      return team
        ? {
            ...p,
            team
          }
        : null;
    })
    .filter(Boolean) as Array<{
    id: string;
    first_name: string;
    last_name: string;
    current_school: string;
    previous_school: string | null;
    team: string;
  }>;

  if (!needStats.length) {
    console.log("No players with a usable team to fetch CFBD stats for (missing previous_school and no portal origin match).");
    return;
  }

  // Group players by exact CFBD team string; we keep it as-is for request but also store normalized for fallback.
  const groups = new Map<string, typeof needStats>();
  for (const p of needStats) {
    const key = p.team;
    const arr = groups.get(key) ?? [];
    arr.push(p);
    groups.set(key, arr);
  }

  console.log(`CFBD stats backfill for season ${season}. Teams: ${groups.size}. Players w/ team: ${needStats.length}.`);

  let teamCalls = 0;
  let upserted = 0;
  let matchedPlayers = 0;
  let missingPlayers = 0;
  let errors = 0;

  for (const [team, teamPlayers] of groups) {
    try {
      teamCalls++;
      const rows = await fetchCfbdPlayerSeasonStats({
        year: season,
        team,
        seasonType: "regular",
        config: { apiKey: cfbdKey, ...(cfbdBaseUrl ? { baseUrl: cfbdBaseUrl } : {}) }
      });

      const byName = new Map<string, string[]>();
      for (const r of rows) {
        const n = normName(r.player);
        const arr = byName.get(n) ?? [];
        arr.push(r.player);
        byName.set(n, arr);
      }

      const toUpsert: StatInsert[] = [];
      for (const p of teamPlayers) {
        const fullName = `${p.first_name} ${p.last_name}`;
        const mapped = mapCfbdRowsToOurSchema({ season, playerFullName: fullName, rows });
        const hasAny =
          mapped.games_played != null ||
          mapped.starts != null ||
          mapped.passing_yards != null ||
          mapped.rushing_yards != null ||
          mapped.receiving_yards != null ||
          mapped.total_touchdowns != null ||
          mapped.tackles != null ||
          mapped.sacks != null ||
          mapped.interceptions != null ||
          mapped.passes_defended != null;

        if (!hasAny) {
          missingPlayers++;
          continue;
        }
        matchedPlayers++;
        toUpsert.push({
          player_id: p.id,
          season,
          games_played: mapped.games_played,
          starts: mapped.starts,
          offensive_snaps: null,
          defensive_snaps: null,
          special_teams_snaps: null,
          passing_yards: mapped.passing_yards,
          rushing_yards: mapped.rushing_yards,
          receiving_yards: mapped.receiving_yards,
          total_touchdowns: mapped.total_touchdowns,
          tackles: mapped.tackles,
          sacks: mapped.sacks,
          interceptions: mapped.interceptions,
          passes_defended: mapped.passes_defended
        });
      }

      if (toUpsert.length) {
        const { error: upErr } = await supabase
          .from("player_stats")
          .upsert(toUpsert, { onConflict: "player_id,season" });
        if (upErr) {
          errors++;
          console.error(`Upsert error for team ${team}:`, upErr);
        } else {
          upserted += toUpsert.length;
        }
      }
    } catch (e) {
      errors++;
      console.error(`CFBD fetch error for team ${team}:`, e);
    }
  }

  console.log(
    `Done. CFBD team calls: ${teamCalls}. Players matched: ${matchedPlayers}. Players no stats: ${missingPlayers}. Rows upserted: ${upserted}. Errors: ${errors}.`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

