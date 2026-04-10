/**
 * Enrich player_measurements from real sources only:
 * - Pro day tables (for draft-eligible players; wingspan/arm when the page lists them).
 * - 247 high school profiles (height, weight, 40 when listed; wingspan/arm if on page).
 * No defaults or fake estimates. Add pro day URLs in pro-day-urls.ts and 247 profile
 * URLs in MEASURABLES_247_PROFILES (match by name).
 *
 * Run: npm run enrich:measurables
 */

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import {
  PRO_DAY_SOURCES,
  MEASURABLES_247_PROFILES,
  normalizeSchoolForMatch
} from "@/lib/measurables/pro-day-urls";
import {
  fetchAndParseProDayPage,
  normalizeNameForMatch as normalizeProDayName,
  type ProDayRow
} from "@/lib/scrapers/pro-day-table";
import { fetch247ProfileMeasurables } from "@/lib/scrapers/247-profile";

type MeasurementInsert = Database["public"]["Tables"]["player_measurements"]["Insert"];
type MeasurementRow = Database["public"]["Tables"]["player_measurements"]["Row"];
type PlayerRow = Pick<
  Database["public"]["Tables"]["players"]["Row"],
  "id" | "first_name" | "last_name" | "position" | "previous_school" | "current_school"
>;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, serviceRoleKey);

function normalizeName(name: string): string {
  return `${name}`.toLowerCase().replace(/\s+/g, " ").replace(/\s+(jr\.?|sr\.?|iii?|iv|ii)$/i, "").trim();
}

async function main() {
  const { data: playersRaw, error: playersErr } = await supabase
    .from("players")
    .select("id, first_name, last_name, position, previous_school, current_school");
  const players = (playersRaw ?? []) as PlayerRow[];

  if (playersErr || !players.length) {
    console.error("No players or error:", playersErr);
    process.exit(1);
  }

  const { data: existingMeasRaw } = await supabase
    .from("player_measurements")
    .select("player_id, height_in, weight_lbs");
  const existingMeas = (existingMeasRaw ?? []) as Pick<
    MeasurementRow,
    "player_id" | "height_in" | "weight_lbs"
  >[];
  const measByPlayer = new Map<string, { height_in: number | null; weight_lbs: number | null }>();
  for (const m of existingMeas) {
    measByPlayer.set(m.player_id, { height_in: m.height_in, weight_lbs: m.weight_lbs });
  }

  console.log("Fetching pro day pages...");
  const schoolToRows = new Map<string, ProDayRow[]>();
  for (const source of PRO_DAY_SOURCES) {
    try {
      const rows = await fetchAndParseProDayPage(source.url);
      schoolToRows.set(source.school, rows);
      console.log(`  ${source.schoolLabel}: ${rows.length} rows`);
    } catch (e) {
      console.warn(`  Skip ${source.schoolLabel}:`, e);
    }
  }

  const lookup = new Map<string, ProDayRow>();
  for (const [school, rows] of schoolToRows) {
    for (const row of rows) {
      const key = `${school}\t${normalizeProDayName(row.name)}`;
      lookup.set(key, row);
    }
  }

  const updatesByPlayer = new Map<string, Partial<MeasurementInsert>>();

  for (const p of players) {
    const fullName = `${p.first_name} ${p.last_name}`;
    const nameNorm = normalizeName(fullName);
    const schools = [p.previous_school, p.current_school].filter(
      (s): s is string => s != null && s !== "" && s !== "Transfer Portal"
    );
    let row: ProDayRow | null = null;
    for (const school of schools) {
      const schoolNorm = normalizeSchoolForMatch(school);
      const key = `${schoolNorm}\t${nameNorm}`;
      row = lookup.get(key) ?? null;
      if (!row && schoolNorm !== school.toLowerCase()) {
        row = lookup.get(`${school.toLowerCase()}\t${nameNorm}`) ?? null;
      }
      if (row) break;
    }

    if (!row) continue;

    const hasAnyReal =
      row.forty_time != null ||
      row.arm_length_in != null ||
      row.vertical_jump != null ||
      row.shuttle_time != null ||
      row.height_in != null ||
      row.weight_lbs != null;
    if (!hasAnyReal) continue;

    const existing = measByPlayer.get(p.id);
    updatesByPlayer.set(p.id, {
      player_id: p.id,
      height_in: row.height_in ?? existing?.height_in ?? null,
      weight_lbs: row.weight_lbs ?? existing?.weight_lbs ?? null,
      arm_length_in: row.arm_length_in ?? null,
      forty_time: row.forty_time ?? null,
      shuttle_time: row.shuttle_time ?? null,
      vertical_jump: row.vertical_jump ?? null,
      wing_span_in: null,
      verified_at: null
    });
  }

  if (MEASURABLES_247_PROFILES.length > 0) {
    console.log("Fetching 247 high school profiles...");
    const nameToPlayer = new Map<string, PlayerRow>();
    for (const p of players) {
      nameToPlayer.set(normalizeName(`${p.first_name} ${p.last_name}`), p);
    }
    for (const source of MEASURABLES_247_PROFILES) {
      try {
        const m = await fetch247ProfileMeasurables(source.url);
        const nameNorm = normalizeName(source.nameForMatch);
        const player = nameToPlayer.get(nameNorm);
        if (!player) continue;
        const hasAny =
          m.height_in != null ||
          m.weight_lbs != null ||
          m.forty_time != null ||
          m.arm_length_in != null ||
          m.wing_span_in != null;
        if (!hasAny) continue;
        const existing = measByPlayer.get(player.id);
        const current = updatesByPlayer.get(player.id);
        updatesByPlayer.set(player.id, {
          player_id: player.id,
          height_in: m.height_in ?? current?.height_in ?? existing?.height_in ?? null,
          weight_lbs: m.weight_lbs ?? current?.weight_lbs ?? existing?.weight_lbs ?? null,
          forty_time: m.forty_time ?? current?.forty_time ?? null,
          arm_length_in: m.arm_length_in ?? current?.arm_length_in ?? null,
          wing_span_in: m.wing_span_in ?? current?.wing_span_in ?? null,
          shuttle_time: m.shuttle_time ?? current?.shuttle_time ?? null,
          vertical_jump: m.vertical_jump ?? current?.vertical_jump ?? null,
          verified_at: null
        });
      } catch (e) {
        console.warn(`  Skip 247 ${source.nameForMatch}:`, e);
      }
    }
  }

  const updates = Array.from(updatesByPlayer.values()).map((u) => ({
    ...u,
    height_in: u.height_in ?? null,
    weight_lbs: u.weight_lbs ?? null,
    arm_length_in: u.arm_length_in ?? null,
    forty_time: u.forty_time ?? null,
    shuttle_time: u.shuttle_time ?? null,
    vertical_jump: u.vertical_jump ?? null,
    wing_span_in: u.wing_span_in ?? null,
    verified_at: null
  })) as MeasurementInsert[];

  if (updates.length === 0) {
    console.log("No players matched scraped data. Add pro day URLs and/or 247 profile URLs in lib/measurables/pro-day-urls.ts.");
    return;
  }

  const { error: upsertErr } = await supabase
    .from("player_measurements" as never)
    .upsert(updates as never, { onConflict: "player_id" });

  if (upsertErr) {
    console.error("Upsert error:", upsertErr);
    process.exit(1);
  }

  console.log(`Done. Updated ${updates.length} players with measurables from pro day + 247 high school only (no defaults).`);
  console.log("Add MEASURABLES_247_PROFILES for 247 recruit profile URLs to pull height, weight, 40 from high school.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
