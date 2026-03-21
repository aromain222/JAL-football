/**
 * Batch resolve ESPN / roster URLs for players using web search + scoring.
 *
 * Stores results in public.player_identity_links:
 *   player_id, espn_url, roster_url, confidence, source, matched_team, notes, last_checked_at
 *
 * Prereqs:
 *   - .env.local / .env:
 *     - NEXT_PUBLIC_SUPABASE_URL
 *     - SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional:
 *   - RESOLVE_URLS_LIMIT=50
 *   - RESOLVE_URLS_DELAY_MS=800
 *   - RESOLVE_QUIET=1 (only log when a URL is found + summary; no per-player null lines)
 *   - RESOLVE_DEBUG=1 (log candidate count and best score per player; full error stacks)
 *   - BRAVE_API_KEY=... (fallback when DuckDuckGo returns 0 results; free tier ~2k/mo)
 *
 * Run: npm run resolve:urls
 */

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { resolvePlayerUrl } from "@/lib/identity/player-url-resolver";

type IdentityInsert = Database["public"]["Tables"]["player_identity_links"]["Insert"];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const limit = Number(process.env.RESOLVE_URLS_LIMIT) || 50;
const delayMs = Number(process.env.RESOLVE_URLS_DELAY_MS) || 800;
const debug = process.env.RESOLVE_DEBUG === "1" || process.env.RESOLVE_DEBUG === "true";
const braveApiKey = process.env.BRAVE_API_KEY;
const skipExisting =
  process.env.RESOLVE_SKIP_EXISTING === "0"
    ? false
    : process.env.RESOLVE_SKIP_EXISTING === "false"
      ? false
      : true;
const espnMinConfidence =
  process.env.RESOLVE_ESPN_MIN_CONFIDENCE != null
    ? parseFloat(process.env.RESOLVE_ESPN_MIN_CONFIDENCE)
    : undefined;
const rosterMinConfidence =
  process.env.RESOLVE_ROSTER_MIN_CONFIDENCE != null
    ? parseFloat(process.env.RESOLVE_ROSTER_MIN_CONFIDENCE)
    : undefined;
const quiet = process.env.RESOLVE_QUIET === "1" || process.env.RESOLVE_QUIET === "true";

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, serviceRoleKey);

async function main() {
  const { data: players, error } = await supabase
    .from("players")
    .select(
      "id, first_name, last_name, position, previous_school, player_identity_links(espn_url,roster_url)"
    )
    .limit(limit);

  if (error) {
    console.error("Fetch players error:", error);
    process.exit(1);
  }

  if (!players?.length) {
    console.log("No players found to resolve.");
    return;
  }

  console.log(
    `Resolving URLs for ${players.length} players (delay ${delayMs}ms; skipExisting=${skipExisting})${braveApiKey ? ", Brave fallback on" : ""}...`
  );

  let resolved = 0;
  let saved = 0;
  let needsReview = 0;
  let errors = 0;
  let processed = 0;

  for (const p of players) {
    processed++;
    const name = `${p.first_name} ${p.last_name}`;
    try {
      const link = Array.isArray((p as any).player_identity_links)
        ? (p as any).player_identity_links[0]
        : (p as any).player_identity_links;
      const alreadyResolved = Boolean(link?.espn_url || link?.roster_url);
      if (skipExisting && alreadyResolved) continue;

      const out = await resolvePlayerUrl(
        { name, position: String(p.position), prev_school: p.previous_school ? String(p.previous_school) : "" },
        {
          delayMs,
          maxCandidates: 10,
          debug,
          braveApiKey: braveApiKey ?? undefined,
          espnMinConfidence,
          rosterMinConfidence
        }
      );
      resolved++;

      const row: IdentityInsert = {
        player_id: p.id,
        espn_url: out.espn_url ?? (out.source === "espn" ? out.resolved_url : null),
        roster_url: out.roster_url ?? (out.source === "roster" ? out.resolved_url : null),
        source: out.source ?? null,
        confidence: out.confidence,
        matched_team: out.matched_team ?? null,
        notes: out.notes
      };

      const { error: upErr } = await supabase
        .from("player_identity_links")
        .upsert({ ...row, last_checked_at: new Date().toISOString() } as any, { onConflict: "player_id" });

      if (upErr) {
        errors++;
        if (!quiet) console.error("Upsert error for", name, upErr.message ?? upErr);
      } else {
        saved++;
      }

      if (!out.resolved_url) needsReview++;
      if (!quiet || out.resolved_url) {
        console.log(`${name} -> ${out.resolved_url ?? "null"} (${out.confidence.toFixed(2)})`);
      }
      if (quiet && processed % 50 === 0) {
        console.log(`  ... ${processed}/${players.length} (${saved} URLs, ${errors} errors)`);
      }
    } catch (e) {
      errors++;
      const msg = e instanceof Error ? e.message : String(e);
      if (debug) {
        console.error("Resolve error for", name, e);
      } else {
        console.error(`Resolve error for ${name}: ${msg}`);
      }
    }
  }

  console.log(`Done. Resolved: ${resolved}, saved: ${saved}, needs manual review: ${needsReview}, errors: ${errors}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

