import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type PlayerRow = Pick<
  Database["public"]["Tables"]["players"]["Row"],
  "id" | "first_name" | "last_name" | "current_school" | "previous_school" | "x_handle" | "x_user_id"
>;

interface XSearchUser {
  id: string;
  name?: string;
  username?: string;
  description?: string;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bearerToken = process.env.BEARER_API_KEY;
const delayMs = Number(process.env.X_HANDLE_DELAY_MS ?? "1200");
const limit = Number(process.env.X_HANDLE_LIMIT ?? "0");

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

if (!bearerToken) {
  console.error("Missing BEARER_API_KEY");
  process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  const { data: players, error } = await supabase
    .from("players")
    .select("id, first_name, last_name, current_school, previous_school, x_handle, x_user_id")
    .order("last_name");

  if (error) {
    console.error("Fetch players error:", error);
    process.exit(1);
  }

  const unresolved = (players ?? []).filter((player) => !player.x_handle);
  const scopedPlayers = unresolved.slice(0, limit > 0 ? limit : undefined);

  console.log(`Resolving X handles for ${scopedPlayers.length} players...`);

  let resolved = 0;
  let skipped = 0;
  let errors = 0;

  for (let index = 0; index < scopedPlayers.length; index++) {
    const player = scopedPlayers[index];
    if (index > 0) await sleep(delayMs);

    const fullName = `${player.first_name} ${player.last_name}`.trim();
    const school = deriveSchool(player);

    if (!school) {
      skipped++;
      console.log(`Skipping ${fullName}: no usable school for search.`);
      continue;
    }

    try {
      const candidates = await searchUsers({
        bearerToken,
        query: `${fullName} ${school} football`
      });

      const best = pickBestCandidate(player, candidates);

      if (!best) {
        console.log(`[${index + 1}/${scopedPlayers.length}] ${fullName} | no confident handle match`);
        continue;
      }

      const { error: updateError } = await supabase
        .from("players")
        .update({
          x_handle: best.username ?? null,
          x_user_id: best.id
        })
        .eq("id", player.id);

      if (updateError) {
        errors++;
        console.error(`Update error for ${fullName}:`, updateError.message);
        continue;
      }

      resolved++;
      console.log(
        `[${index + 1}/${scopedPlayers.length}] ${fullName} -> @${best.username ?? "unknown"}`
      );
    } catch (runError) {
      errors++;
      console.error(`Resolve error for ${fullName}:`, runError);
    }
  }

  console.log("");
  console.log(`Done. Resolved: ${resolved}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Errors: ${errors}`);
}

function deriveSchool(player: PlayerRow) {
  const previousSchool = player.previous_school?.trim();
  if (previousSchool) return previousSchool;

  const currentSchool = player.current_school?.trim();
  if (!currentSchool || currentSchool.toLowerCase() === "transfer portal") return null;
  return currentSchool;
}

async function searchUsers(params: {
  bearerToken: string;
  query: string;
}): Promise<XSearchUser[]> {
  const url = new URL("https://api.x.com/2/users/search");
  url.searchParams.set("query", params.query);
  url.searchParams.set("max_results", "10");
  url.searchParams.set("user.fields", "description");

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${params.bearerToken}`
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`X user search failed with status ${response.status}: ${errorText}`);
  }

  const payload = (await response.json()) as { data?: XSearchUser[] };
  return payload.data ?? [];
}

function pickBestCandidate(player: PlayerRow, candidates: XSearchUser[]) {
  const playerName = normalize(`${player.first_name} ${player.last_name}`);
  const school = normalize(deriveSchool(player) ?? "");

  const ranked = candidates
    .map((candidate) => {
      const profileName = normalize(candidate.name ?? "");
      const profileDescription = normalize(candidate.description ?? "");
      const profileUsername = normalize(candidate.username ?? "");

      let score = 0;
      if (profileName.includes(playerName)) score += 5;
      if (playerName.includes(profileName) && profileName.length > 6) score += 3;
      if (school && profileDescription.includes(school)) score += 4;
      if (school && profileName.includes(school)) score += 2;
      if (profileUsername.includes(player.last_name.toLowerCase())) score += 1;

      return { candidate, score };
    })
    .sort((a, b) => b.score - a.score);

  if (!ranked.length || ranked[0].score < 5) return null;
  return ranked[0].candidate;
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
