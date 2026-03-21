import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TAG = "missing-stats";

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  const [{ data: players, error: playersError }, { data: stats, error: statsError }, { data: existingTags, error: tagsError }] =
    await Promise.all([
      supabase.from("players").select("id, first_name, last_name"),
      supabase.from("player_stats").select("player_id"),
      supabase.from("player_tags").select("id, player_id, tag").eq("tag", TAG)
    ]);

  if (playersError) {
    console.error("Fetch players error:", playersError);
    process.exit(1);
  }

  if (statsError) {
    console.error("Fetch player_stats error:", statsError);
    process.exit(1);
  }

  if (tagsError) {
    console.error("Fetch player_tags error:", tagsError);
    process.exit(1);
  }

  const playerIdsWithStats = new Set((stats ?? []).map((row) => row.player_id));
  const existingByPlayerId = new Map((existingTags ?? []).map((row) => [row.player_id, row]));

  const toTag = (players ?? []).filter((player) => !playerIdsWithStats.has(player.id) && !existingByPlayerId.has(player.id));
  const toUntag = (existingTags ?? []).filter((tag) => playerIdsWithStats.has(tag.player_id));

  let tagged = 0;
  let untagged = 0;

  if (toTag.length) {
    const { error } = await supabase.from("player_tags").insert(
      toTag.map((player) => ({
        player_id: player.id,
        tag: TAG
      }))
    );

    if (error) {
      console.error("Insert missing-stats tags error:", error);
      process.exit(1);
    }

    tagged = toTag.length;
  }

  if (toUntag.length) {
    const tagIds = toUntag.map((row) => row.id);
    const { error } = await supabase.from("player_tags").delete().in("id", tagIds);

    if (error) {
      console.error("Delete missing-stats tags error:", error);
      process.exit(1);
    }

    untagged = toUntag.length;
  }

  console.log(`Players total: ${(players ?? []).length}`);
  console.log(`Players with stats: ${playerIdsWithStats.size}`);
  console.log(`Tagged as missing-stats: ${tagged}`);
  console.log(`Removed missing-stats tag: ${untagged}`);
  console.log(`Current missing-stats count: ${(players ?? []).filter((player) => !playerIdsWithStats.has(player.id)).length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
