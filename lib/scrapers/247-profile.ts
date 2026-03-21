/**
 * Parse 247Sports recruit/player profile pages for measurables (height, weight, 40 from
 * high school/camp when listed). Uses JSON-LD (schema.org) when present and fallback
 * regex for 40 time. Wingspan/arm only stored when we find them on the page.
 */

export interface Twenty247Measurables {
  height_in: number | null;
  weight_lbs: number | null;
  forty_time: number | null;
  arm_length_in: number | null;
  wing_span_in: number | null;
  vertical_jump: number | null;
  shuttle_time: number | null;
}

/** Parse "6-3" or "5-11" to inches. */
function parseHeightFeetInch(s: string): number | null {
  const m = s.trim().match(/^([56])-(\d{1,2})$/);
  if (!m) return null;
  const feet = parseInt(m[1], 10);
  let inch = parseInt(m[2], 10);
  if (inch >= 12) return null;
  return feet * 12 + inch;
}

/** Plausible 40 time: 4.2x - 5.0x. */
function parseForty(s: string): number | null {
  const m = s.match(/^(4\.[2-5]\d|5\.0\d)$/);
  return m ? parseFloat(m[1]) : null;
}

/**
 * Fetch 247 profile HTML and extract measurables from JSON-LD and page text.
 */
export async function fetch247ProfileMeasurables(profileUrl: string): Promise<Twenty247Measurables> {
  const res = await fetch(profileUrl, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; JAL-Football/1.0)" }
  });
  if (!res.ok) throw new Error(`247 fetch failed ${res.status}: ${profileUrl}`);
  const html = await res.text();

  const out: Twenty247Measurables = {
    height_in: null,
    weight_lbs: null,
    forty_time: null,
    arm_length_in: null,
    wing_span_in: null,
    vertical_jump: null,
    shuttle_time: null
  };

  const ldMatch = html.match(/<script type="application\/ld\+json"[^>]*>\s*(\{[^<]+?\})\s*<\/script>/);
  if (ldMatch) {
    try {
      const ld = JSON.parse(ldMatch[1]) as {
        height?: Array<{ value?: string }>;
        weight?: Array<{ value?: string }>;
      };
      if (ld.height?.[0]?.value) {
        const h = parseHeightFeetInch(ld.height[0].value);
        if (h) out.height_in = h;
      }
      if (ld.weight?.[0]?.value) {
        const w = parseInt(ld.weight[0].value.replace(/\D/g, ""), 10);
        if (w >= 150 && w <= 400) out.weight_lbs = w;
      }
    } catch {
      // ignore JSON parse errors
    }
  }

  if (!out.height_in) {
    const hMatch = html.match(/"([56])-(\d{1,2})"/);
    if (hMatch) {
      const h = parseInt(hMatch[1], 10) * 12 + parseInt(hMatch[2], 10);
      if (h >= 60 && h <= 84) out.height_in = h;
    }
  }
  if (!out.weight_lbs) {
    const wMatch = html.match(/Weight<\/span>\s*<span>(\d{2,3})/i) ?? html.match(/weight["\s:]+(\d{2,3})\s*lb/i);
    if (wMatch?.[1]) {
      const w = parseInt(wMatch[1], 10);
      if (w >= 150 && w <= 400) out.weight_lbs = w;
    }
  }

  const fortyYard = html.match(/40\s*[-–]?\s*yard|40\s*yard|yard\s*dash|forty\s*(?:yard)?/i);
  if (fortyYard) {
    const idx = html.indexOf(fortyYard[0]);
    const slice = html.slice(Math.max(0, idx - 80), idx + 120);
    const timeMatch = slice.match(/([45]\.[2-5]\d)\s*(?:sec|seconds?)?/i) ?? slice.match(/\b(4\.[2-5]\d|5\.0\d)\b/);
    if (timeMatch) {
      const t = parseForty(timeMatch[1]);
      if (t) out.forty_time = t;
    }
  }

  const armMatch = html.match(/arm\s*[:\s]*(\d{2}(?:\.\d)?)\s*["″]?/i) ?? html.match(/(\d{2}(?:\.\d)?)\s*["″]?\s*arm/i);
  if (armMatch) {
    const a = parseFloat(armMatch[1]);
    if (a >= 28 && a <= 38) out.arm_length_in = a;
  }
  const wingMatch = html.match(/wing(?:span)?\s*[:\s]*(\d{2}(?:\.\d)?)\s*["″]?/i);
  if (wingMatch) {
    const w = parseFloat(wingMatch[1]);
    if (w >= 70 && w <= 90) out.wing_span_in = w;
  }

  return out;
}
