/**
 * Seed tracked X source accounts for player intel monitoring.
 *
 * Prereqs:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 *
 * Run:
 *   npm run seed:x:sources
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

const seedAccounts = [
  {
    handle: "HayesFawcett3",
    display_name: "Hayes Fawcett",
    category: "portal_news",
    priority: 10,
    active: true,
    notes: "Best for portal announcements and player movement graphics."
  },
  {
    handle: "PeteNakos_",
    display_name: "Pete Nakos",
    category: "portal_news",
    priority: 15,
    active: true,
    notes: "Strong transfer portal movement and roster intel."
  },
  {
    handle: "chris_hummer",
    display_name: "Chris Hummer",
    category: "portal_news",
    priority: 20,
    active: true,
    notes: "Player-level portal context and recruiting crossover coverage."
  },
  {
    handle: "mzenitz",
    display_name: "Matt Zenitz",
    category: "insider",
    priority: 25,
    active: true,
    notes: "Broader personnel and movement reporting."
  },
  {
    handle: "swiltfong_",
    display_name: "Steve Wiltfong",
    category: "recruiting",
    priority: 30,
    active: true,
    notes: "Useful recruiting and portal crossover intel."
  },
  {
    handle: "RivalsFriedman",
    display_name: "Adam Friedman",
    category: "portal_news",
    priority: 35,
    active: true,
    notes: "National transfer portal analyst with more player-specific coverage."
  },
  {
    handle: "grant_grubbs_",
    display_name: "Grant Grubbs",
    category: "recruiting",
    priority: 40,
    active: true,
    notes: "Recruiting and transfer updates with good player mention density."
  },
  {
    handle: "CamMellor",
    display_name: "Cam Mellor",
    category: "player_eval",
    priority: 45,
    active: true,
    notes: "High-value player spotlight and trait language."
  },
  {
    handle: "On3sports",
    display_name: "On3 Sports",
    category: "aggregate",
    priority: 50,
    active: true,
    notes: "High-volume player movement and spotlight feed."
  },
  {
    handle: "247SportsPortal",
    display_name: "247Sports Portal",
    category: "aggregate",
    priority: 55,
    active: true,
    notes: "Portal-only aggregation feed."
  },
  {
    handle: "TransferPortal_",
    display_name: "Transfer Portal",
    category: "aggregate",
    priority: 60,
    active: true,
    notes: "Secondary aggregate feed for volume coverage."
  }
] satisfies Array<Database["public"]["Tables"]["x_source_accounts"]["Insert"]>;

async function main() {
  const { error: probeError } = await supabase.from("x_source_accounts" as never).select("id").limit(1);
  if (probeError) {
    console.error("x_source_accounts table is not ready:", probeError.message);
    console.error("Run supabase/x_source_accounts.sql in Supabase SQL Editor first.");
    process.exit(1);
  }

  const { error } = await supabase.from("x_source_accounts" as never).upsert(seedAccounts as never, {
    onConflict: "handle"
  });

  if (error) {
    console.error("Seed x_source_accounts error:", error);
    process.exit(1);
  }

  console.log(`Seeded ${seedAccounts.length} X source accounts.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
