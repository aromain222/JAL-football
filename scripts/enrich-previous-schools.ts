/**
 * Enrich players with previous_school (and optionally current_school when committed)
 * by scraping On3 transfer portal wire headlines and matching to our DB.
 *
 * Run after sync:portal. Only updates rows where previous_school is null.
 *
 * Prereqs: .env.local with NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Run: npm run enrich:schools
 */

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import {
  fetchOn3WireHeadlines,
  parseTransferHeadline,
  normalizeNameForMatch
} from "@/lib/scrapers/on3-headlines";

type PlayerRow = Pick<
  Database["public"]["Tables"]["players"]["Row"],
  "id" | "first_name" | "last_name" | "position" | "previous_school" | "current_school"
>;
type PreviousSchoolUpdate = {
  id: string;
  previous_school: string;
  current_school?: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, serviceRoleKey);

async function main() {
  console.log("Fetching On3 wire headlines...");
  const headlines = await fetchOn3WireHeadlines();
  console.log(`Found ${headlines.length} headline links.`);

  const parsed: Array<{ previousSchool: string; newSchool?: string; playerName: string }> = [];
  for (const h of headlines) {
    const p = parseTransferHeadline(h);
    if (p) parsed.push(p);
  }
  console.log(`Parsed ${parsed.length} transfer headlines.`);

  if (parsed.length === 0) {
    console.log("Nothing to enrich.");
    return;
  }

  // Load our players that are from Sportradar and missing previous_school
  const { data: playersRaw, error: fetchError } = await supabase
    .from("players")
    .select("id, first_name, last_name, position, previous_school, current_school")
    .not("sportradar_id", "is", null)
    .is("previous_school", null);
  const players = (playersRaw ?? []) as PlayerRow[];

  if (fetchError) {
    console.error("Fetch players error:", fetchError);
    process.exit(1);
  }
  if (!players.length) {
    console.log("No players with missing previous_school to enrich.");
    return;
  }

  const nameToPlayer = new Map<string, PlayerRow[]>();
  for (const p of players) {
    const full = `${p.first_name} ${p.last_name}`;
    const key = normalizeNameForMatch(full);
    if (!nameToPlayer.has(key)) nameToPlayer.set(key, []);
    nameToPlayer.get(key)!.push(p);
  }

  const updates: PreviousSchoolUpdate[] = [];
  const matched = new Set<string>();

  for (const { previousSchool, newSchool, playerName } of parsed) {
    const key = normalizeNameForMatch(playerName);
    const candidates = nameToPlayer.get(key);
    if (!candidates || candidates.length === 0) continue;
    const player = candidates[0];
    if (matched.has(player.id)) continue;
    matched.add(player.id);
    updates.push({
      id: player.id,
      previous_school: previousSchool,
      ...(newSchool && player.current_school === "Transfer Portal" ? { current_school: newSchool } : {})
    });
  }

  if (updates.length === 0) {
    console.log("No matches between headlines and DB players.");
    return;
  }

  for (const u of updates) {
    const { error } = await supabase.from("players" as never).update({
      previous_school: u.previous_school,
      ...(u.current_school != null ? { current_school: u.current_school } : {})
    } as never).eq("id", u.id);
    if (error) {
      console.error("Update error for", u.id, error);
    }
  }

  console.log(`Updated previous_school (and current_school when committed) for ${updates.length} players.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
