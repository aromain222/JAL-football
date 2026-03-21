/**
 * Clear seeded / demo workflow rows so the app opens with a blank recruiting board.
 *
 * Prereqs:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 *
 * Run:
 *   npm run reset:needs
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

const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  const { error: shortlistsError } = await supabase.from("shortlists").delete().neq("id", "");
  if (shortlistsError) {
    console.error("Failed clearing shortlists:", shortlistsError.message);
    process.exit(1);
  }

  const { error: reviewsError } = await supabase.from("player_reviews").delete().neq("id", "");
  if (reviewsError) {
    console.error("Failed clearing player_reviews:", reviewsError.message);
    process.exit(1);
  }

  const { error: needsError } = await supabase.from("team_needs").delete().neq("id", "");
  if (needsError) {
    console.error("Failed clearing team_needs:", needsError.message);
    process.exit(1);
  }

  console.log("Cleared team_needs, player_reviews, and shortlists.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
