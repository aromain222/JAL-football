/**
 * Resolve ESPN player IDs for players missing espn_url using ESPN's search API directly.
 * More reliable than DuckDuckGo scraping — no blocking, returns IDs natively.
 *
 * Targets players where player_identity_links.espn_url IS NULL.
 *
 * Prereqs: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional:
 *   RESOLVE_ESPN_LIMIT=100
 *   RESOLVE_ESPN_DELAY_MS=400
 *   RESOLVE_ESPN_MIN_SCORE=0.7
 *   RESOLVE_ESPN_DRY_RUN=1
 *
 * Run: npm run resolve:espn
 */

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type IdentityInsert = Database["public"]["Tables"]["player_identity_links"]["Insert"];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const limit = Number(process.env.RESOLVE_EN_LIMIT) || 100;
const delayMs = Number(process.env.RESOLVE_ESPN_DELAY_MS) || 400;
const minScore = Number(process.env.RESOLVE_ESPN_MIN_SCORE) || 0.7;
const dryRun = process.env.RESOLVE_ESPN_DRY_RUN === "1";

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, serviceRoleKey);

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv|v)\b\.?/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSim(a: string, b: string): number {
  const ta = new Set(norm(a).split(" ").filter(Boolean));
  const tb = new Set(norm(b).split(" ").filter(Boolean));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const union = ta.size + tb.size - inter;
  return union ? inter / union : 0;
}

interface EspnSearchHit {
  id: string;
  displayName: string;
  team?: string;
  position?: string;
}

async function searchEspn(name: string): Promise<EspnSearchHit[]> {
  const url =
    `https://site.api.espn.com/apis/common/v3/search` +
    `?query=${encodeURIComponent(name)}&limit=10&type=athletes&sport=football&league=college-football`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" }
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      results?: Array<{
        type?: string;
        athlete?: {
          id?: string;
          displayName?: string;
          team?: { displayName?: string };
          position?: { abbreviation?: string };
        };
      }>;
    };
    const hits: EspnSearchHit[] = [];
    for (const r of data.results ?? []) {
      const a = r.athlete;
      if (!a?.id || !a?.displayName) continue;
      hits.push({
        id: a.id,
        displayName: a.displayName,
        team: a.team?.displayName,
        position: a.position?.abbreviation
      });
    }
    return hits;
  } catch {
    return [];
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const { data: players, error } = await supabase
    .from("players")
    .select("id, first_name, last_name, position, previous_school, player_identity_links(espn_url)")
    .limit(limit);

  if (error) {
    console.error("Fetch error:", error);
    process.exit(1);
  }

  const unresolved = (players ?? []).filter((p) => {
    const link = Array.isArray((p as any).player_identity_links)
      ? (p as any).player_identity_links[0]
      : (p as any).player_identity_links;
    return !link?.espn_url;
  });

  if (!unresolved.length) {
    console.log("All players already have ESPN URLs.");
    return;
  }

  console.log(
    `Resolving ${unresolved.length} players via ESPN search API (delay ${delayMs}ms, minScore ${minScore})${dryRun ? " [DRY RUN]" : ""}...`
  );

  let found = 0;
  let saved = 0;
  let missed = 0;

  for (const p of unresolved) {
    const name = `${p.first_name} ${p.last_name}`;
    await sleep(delayMs);

    const hits = await searchEspn(name);
    if (!hits.length) {
      missed++;
      console.log(`  ${name} -> no ESPN results`);
      continue;
    }

    let best: (EspnSearchHit & { score: number }) | null = null;
    for (const hit of hits) {
      let score = tokenSim(name, hit.displayName);
      if (p.previous_school && hit.team) {
        const schoolSim = tokenSim(p.previous_school, hit.team);
        if (schoolSim >= 0.6) score += 0.15;
      }
      if (!best || score > best.score) best = { ...hit, score };
    }

    if (!best || best.score < minScore) {
      missed++;
      console.log(`  ${name} -> best score ${best?.score.toFixed(2) ?? "0"} (${best?.displayName ?? "none"}) — skipped`);
      continue;
    }

    const espnUrl = `https://www.espn.com/college-football/player/_/id/${best.id}/${norm(best.displayName).replace(/\s+/g, "-")}`;
    found++;
    console.log(`  ${name} -> ${espnUrl} (score $est.score.toFixed(2)}, ${best.team ?? "?"})`);

    if (!dryRun) {
      const row: IdentityInsert = {
        player_id: p.id,
        espn_url: espnUrl,
        source: "espn",
        confidence: best.score,
        matched_team: best.team ?? null,
        notes: `ESPN search: ${best.displayName}`
      };
      const { error: upErr } = await supabase
        .from("player_identity_links")
        .upsert({ ...row, last_checked_at: new Date().toISOString() } as any, { onConflict: "player_id" });
      if (upErr) {
        console.error(`    save error for ${name}:`, upErr.message);
      } else {
        saved++;
      }
    }
  }

  console.log(`\nDone. Found: ${found}, saved: ${saved}, missed: ${missed}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
