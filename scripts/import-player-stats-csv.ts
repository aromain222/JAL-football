import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { PlayerStat } from "@/lib/types";

type PlayerStatInsert = Omit<PlayerStat, "player_id" | "season"> & {
  player_id: string;
  season: number;
  source?: string | null;
};

type CsvRow = {
  id?: string;
  player_id?: string;
  season?: string;
  games_played?: string;
  starts?: string;
  offensive_snaps?: string;
  defensive_snaps?: string;
  special_teams_snaps?: string;
  passing_yards?: string;
  rushing_yards?: string;
  receiving_yards?: string;
  total_touchdowns?: string;
  tackles?: string;
  sacks?: string;
  interceptions?: string;
  passes_defended?: string;
  created_at?: string;
  passing_tds?: string;
  interceptions_thrown?: string;
  rushing_attempts?: string;
  rushing_tds?: string;
  receptions?: string;
  receiving_tds?: string;
  tackles_for_loss?: string;
  forced_fumbles?: string;
  source?: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const csvPathArg = process.argv[2];

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

if (!csvPathArg) {
  console.error('Usage: npm run import:stats:csv -- "/absolute/path/to/player_stats_rows.csv"');
  process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  const csvPath = path.resolve(csvPathArg);
  if (!fs.existsSync(csvPath)) {
    console.error(`CSV file not found: ${csvPath}`);
    process.exit(1);
  }

  const rows = parseCsv(fs.readFileSync(csvPath, "utf8"));
  if (!rows.length) {
    console.error("CSV contains no data rows.");
    process.exit(1);
  }

  const payload: PlayerStatInsert[] = [];
  let skipped = 0;

  for (const row of rows) {
    const record = mapRow(row);
    if (!record) {
      skipped++;
      continue;
    }
    payload.push(record);
  }

  if (!payload.length) {
    console.error("No valid stat rows found to import.");
    process.exit(1);
  }

  const chunkSize = 250;
  let imported = 0;

  for (let i = 0; i < payload.length; i += chunkSize) {
    const chunk = payload.slice(i, i + chunkSize);
    const { error } = await supabase
      .from("player_stats" as never)
      .upsert(chunk as never, { onConflict: "player_id,season" });

    if (error) {
      console.error(`Upsert failed for rows ${i + 1}-${i + chunk.length}:`, error);
      process.exit(1);
    }

    imported += chunk.length;
    console.log(`Imported ${imported}/${payload.length}`);
  }

  console.log("");
  console.log(`Done. Imported: ${imported}`);
  console.log(`Skipped invalid rows: ${skipped}`);
}

function mapRow(row: CsvRow): PlayerStatInsert | null {
  const playerId = normalizeString(row.player_id);
  const season = toInt(row.season);

  if (!playerId || season == null) {
    return null;
  }

  return {
    player_id: playerId,
    season,
    games_played: toInt(row.games_played),
    starts: toInt(row.starts),
    offensive_snaps: toInt(row.offensive_snaps),
    defensive_snaps: toInt(row.defensive_snaps),
    special_teams_snaps: toInt(row.special_teams_snaps),
    passing_yards: toInt(row.passing_yards),
    rushing_yards: toInt(row.rushing_yards),
    receiving_yards: toInt(row.receiving_yards),
    total_touchdowns: toInt(row.total_touchdowns),
    tackles: toInt(row.tackles),
    sacks: toFloat(row.sacks),
    interceptions: toInt(row.interceptions),
    passes_defended: toInt(row.passes_defended),
    passing_tds: toInt(row.passing_tds),
    interceptions_thrown: toInt(row.interceptions_thrown),
    rushing_attempts: toInt(row.rushing_attempts),
    rushing_tds: toInt(row.rushing_tds),
    receptions: toInt(row.receptions),
    receiving_tds: toInt(row.receiving_tds),
    tackles_for_loss: toFloat(row.tackles_for_loss),
    forced_fumbles: toInt(row.forced_fumbles),
    source: normalizeString(row.source)
  };
}

function normalizeString(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function toInt(value?: string) {
  const normalized = normalizeString(value);
  if (!normalized) return null;
  const parsed = Number.parseInt(normalized, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function toFloat(value?: string) {
  const normalized = normalizeString(value);
  if (!normalized) return null;
  const parsed = Number.parseFloat(normalized);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseCsv(fileContents: string): CsvRow[] {
  const lines = fileContents.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0]);

  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });

    return row as CsvRow;
  });
}

function splitCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index++) {
    const char = line[index];

    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
