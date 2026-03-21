/**
 * Remove seed/fake players (no sportradar_id), keeping only Sportradar-synced portal players.
 * Related rows (measurements, stats, reviews, shortlists, tags) are removed by cascade.
 *
 * Run: npm run remove-seed-players
 */

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, serviceRoleKey);

async function main() {
  const { count, error: countError } = await supabase
    .from("players")
    .select("id", { count: "exact", head: true })
    .is("sportradar_id", null);

  if (countError) {
    console.error("Count error:", countError);
    process.exit(1);
  }

  if (count === 0) {
    console.log("No seed players to remove (all players have sportradar_id).");
    return;
  }

  const { error: deleteError } = await supabase
    .from("players")
    .delete()
    .is("sportradar_id", null);

  if (deleteError) {
    console.error("Delete error:", deleteError);
    process.exit(1);
  }

  console.log(`Removed ${count} seed/fake players. Only Sportradar portal players remain.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
