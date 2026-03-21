import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type PlayerRow = Pick<
  Database["public"]["Tables"]["players"]["Row"],
  "id" | "first_name" | "last_name" | "current_school" | "previous_school" | "sportradar_id" | "x_handle"
>;

type CsvRow = {
  player_id?: string;
  sportradar_id?: string;
  first_name?: string;
  last_name?: string;
  school?: string;
  x_handle?: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const csvPath = process.argv[2];

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

if (!csvPath) {
  console.error("Usage: npm run import:x -- /absolute/path/to/x_handles.csv");
  process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  const absolutePath = path.resolve(csvPath);
  if (!fs.existsSync(absolutePath)) {
    console.error(`CSV file not found: ${absolutePath}`);
    process.exit(1);
  }

  const rows = parseCsv(fs.readFileSync(absolutePath, "utf8"));
  if (!rows.length) {
    console.error("CSV contains no data rows.");
    process.exit(1);
  }

  const { data: players, error } = await supabase
    .from("players")
    .select("id, first_name, last_name, current_school, previous_school, sportradar_id, x_handle");

  if (error) {
    console.error("Fetch players error:", error);
    process.exit(1);
  }

  const playersById = new Map((players ?? []).map((player) => [player.id, player]));
  const playersBySportradarId = new Map(
    (players ?? [])
      .filter((player) => player.sportradar_id)
      .map((player) => [player.sportradar_id as string, player])
  );
  const playersByNameSchool = new Map<string, PlayerRow>();

  for (const player of players ?? []) {
    const key = buildNameSchoolKey(
      player.first_name,
      player.last_name,
      player.previous_school ?? player.current_school
    );
    if (!playersByNameSchool.has(key)) {
      playersByNameSchool.set(key, player);
    }
  }

  let updated = 0;
  let skipped = 0;
  let unmatched = 0;

  for (const row of rows) {
    const xHandle = normalizeHandle(row.x_handle);
    if (!xHandle) {
      skipped++;
      continue;
    }

    const matchedPlayer = matchPlayer(row, {
      playersById,
      playersBySportradarId,
      playersByNameSchool
    });

    if (!matchedPlayer) {
      unmatched++;
      console.log(
        `Unmatched row: ${JSON.stringify({
          player_id: row.player_id ?? null,
          sportradar_id: row.sportradar_id ?? null,
          first_name: row.first_name ?? null,
          last_name: row.last_name ?? null,
          school: row.school ?? null,
          x_handle: xHandle
        })}`
      );
      continue;
    }

    const { error: updateError } = await supabase
      .from("players")
      .update({ x_handle: xHandle })
      .eq("id", matchedPlayer.id);

    if (updateError) {
      console.error(`Failed to update ${matchedPlayer.first_name} ${matchedPlayer.last_name}:`, updateError.message);
      continue;
    }

    updated++;
    console.log(`Updated ${matchedPlayer.first_name} ${matchedPlayer.last_name} -> @${xHandle}`);
  }

  console.log("");
  console.log(`Done. Updated: ${updated}`);
  console.log(`Skipped rows with no handle: ${skipped}`);
  console.log(`Unmatched rows: ${unmatched}`);
}

function matchPlayer(
  row: CsvRow,
  lookups: {
    playersById: Map<string, PlayerRow>;
    playersBySportradarId: Map<string, PlayerRow>;
    playersByNameSchool: Map<string, PlayerRow>;
  }
) {
  if (row.player_id && lookups.playersById.has(row.player_id)) {
    return lookups.playersById.get(row.player_id) ?? null;
  }

  if (row.sportradar_id && lookups.playersBySportradarId.has(row.sportradar_id)) {
    return lookups.playersBySportradarId.get(row.sportradar_id) ?? null;
  }

  if (row.first_name && row.last_name && row.school) {
    const key = buildNameSchoolKey(row.first_name, row.last_name, row.school);
    return lookups.playersByNameSchool.get(key) ?? null;
  }

  return null;
}

function buildNameSchoolKey(firstName: string, lastName: string, school: string) {
  return `${normalize(firstName)}|${normalize(lastName)}|${normalize(school)}`;
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeHandle(value?: string) {
  if (!value) return null;
  const trimmed = value.trim().replace(/^@/, "");
  return trimmed.length ? trimmed : null;
}

function parseCsv(fileContents: string): CsvRow[] {
  const lines = fileContents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((header) => header.trim());

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
