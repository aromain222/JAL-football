/**
 * Enrich players with previous_school/current_school using CFBD transfer portal data.
 *
 * CFBD endpoint: GET /player/portal?year=YYYY (origin + destination)
 *
 * Prereqs:
 *   - .env.local / .env:
 *     - CFBD_API_KEY
 *     - NEXT_PUBLIC_SUPABASE_URL
 *     - SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional:
 *   - CFBD_BASE_URL (default https://api.collegefootballdata.com)
 *   - TRANSFER_YEAR=2026 (default: current year)
 *   - CFBD_PORTAL_YEAR=2026 (default: TRANSFER_YEAR)
 *
 * Run: npm run enrich:schools:cfbd
 */

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { fetchCfbdTransferPortal, type CfbdClientConfig } from "@/lib/cfbd/player-season-stats";

type PlayerRow = Pick<
  Database["public"]["Tables"]["players"]["Row"],
  "id" | "first_name" | "last_name" | "position" | "previous_school" | "current_school" | "stars"
>;
type PlayerUpdate = Pick<Database["public"]["Tables"]["players"]["Update"], "id" | "previous_school" | "current_school" | "stars">;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const cfbdKey = process.env.CFBD_API_KEY;
const cfbdBaseUrl = process.env.CFBD_BASE_URL;
const transferYear = Number(process.env.TRANSFER_YEAR) || new Date().getFullYear();
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

function normalizeNameForMatch(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv|v)\b\.?/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function makeKey(first: string, last: string): string {
  return normalizeNameForMatch(`${first} ${last}`);
}

async function main() {
  console.log(`Fetching CFBD transfer portal (${portalYear})...`);
  const cfbdConfig: CfbdClientConfig = {
    apiKey: cfbdKey!,
    ...(cfbdBaseUrl ? { baseUrl: cfbdBaseUrl } : {})
  };
  const portal = await fetchCfbdTransferPortal({
    year: portalYear,
    config: cfbdConfig
  });
  console.log(`CFBD returned ${portal.length} portal rows.`);

  const byName = new Map<string, typeof portal>();
  for (const row of portal) {
    const key = makeKey(row.firstName, row.lastName);
    const arr = byName.get(key) ?? [];
    arr.push(row);
    byName.set(key, arr);
  }

  const { data: playersRaw, error } = await supabase
    .from("players")
    .select("id, first_name, last_name, position, previous_school, current_school, stars")
    .not("sportradar_id", "is", null)
    .order("last_name");
  const players = (playersRaw ?? []) as PlayerRow[];

  if (error) {
    console.error("Fetch players error:", error);
    process.exit(1);
  }
  if (!players.length) {
    console.log("No players found.");
    return;
  }

  let matched = 0;
  let updated = 0;
  let skipped = 0;

  for (const p of players) {
    const key = makeKey(p.first_name, p.last_name);
    const candidates = byName.get(key) ?? [];
    if (!candidates.length) {
      skipped++;
      continue;
    }

    // Prefer a candidate whose position matches (when possible), otherwise take first.
    const pos = String(p.position ?? "").toLowerCase();
    const picked =
      candidates.find((c) => String(c.position ?? "").toLowerCase() === pos) ?? candidates[0];

    matched++;

    const update: PlayerUpdate = { id: p.id };

    if (!p.previous_school && picked.origin) {
      update.previous_school = picked.origin;
    }
    if (p.current_school === "Transfer Portal" && picked.destination) {
      update.current_school = picked.destination;
    }
    if (p.stars == null && picked.stars != null) {
      update.stars = picked.stars;
    }

    const hasAny =
      update.previous_school != null || update.current_school != null || update.stars != null;
    if (!hasAny) continue;

    const { error: upErr } = await supabase
      .from("players" as never)
      .update(update as never)
      .eq("id", p.id);

    if (upErr) {
      console.error("Update error for", p.id, upErr);
    } else {
      updated++;
    }
  }

  console.log(
    `Done. Matched names: ${matched}/${players.length}. Updated players: ${updated}. Unmatched: ${skipped}.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
