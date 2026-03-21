/**
 * Curated URLs for real measurables only (no estimates). Add links when you find:
 * - Pro day result tables (On3, school athletics, local news)
 * - Weight room / testing articles (some programs post "top testers" or combine-style numbers on 247, SI, etc.)
 *
 * We only store values we actually scrape from these pages. School key: normalize for
 * matching (lowercase, " " -> "-", remove punctuation).
 */

export interface ProDaySource {
  school: string;
  /** Display name for logs */
  schoolLabel: string;
  url: string;
  /** Optional year for cache busting */
  year?: number;
}

export const PRO_DAY_SOURCES: ProDaySource[] = [
  // Pro day = draft-bound; add only if you want to pull measurables for those players.
  // { school: "rutgers", schoolLabel: "Rutgers", url: "https://...", year: 2026 },
];

export function normalizeSchoolForMatch(school: string): string {
  return school
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * 247Sports high school / recruit profile URLs. One URL per player; we match to our
 * players by nameForMatch (e.g. "Jeremiah Smith"). Use for height, weight, 40 from
 * high school when listed; wingspan/arm only when on the page. No made-up defaults.
 */
export interface Twenty247ProfileSource {
  url: string;
  /** "First Last" to match our players.first_name + last_name */
  nameForMatch: string;
}

export const MEASURABLES_247_PROFILES: Twenty247ProfileSource[] = [
  { url: "https://247sports.com/player/sean-allison-46165480/", nameForMatch: "Sean Allison" },
  { url: "https://247sports.com/Player/Jeremiah-Smith-46114094/", nameForMatch: "Jeremiah Smith" },
  { url: "https://247sports.com/Player/Hykeem-Williams-46111494/", nameForMatch: "Hykeem Williams" },
  { url: "https://247sports.com/Player/Travis-Hunter-46084728/", nameForMatch: "Travis Hunter" },
];
