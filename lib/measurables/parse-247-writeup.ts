/**
 * Parse 247 write-up for combine-style measurables only.
 * Height/weight come from Sportradar API; we only extract 40, shuttle, vertical, arm, wingspan.
 * Examples: "4.43 short shuttle", "33-inch arms", "36 vertical".
 */

export interface Parsed247Measurables {
  forty_time: number | null;
  shuttle_time: number | null;
  vertical_jump: number | null;
  arm_length_in: number | null;
  wing_span_in: number | null;
}

export function parse247WriteUp(text: string): Parsed247Measurables {
  const t = text.trim();
  const out: Parsed247Measurables = {
    forty_time: null,
    shuttle_time: null,
    vertical_jump: null,
    arm_length_in: null,
    wing_span_in: null
  };

  if (!t) return out;

  const fortyMatch = t.match(/\b(4\.[2-5]\d|5\.0\d)\s*(?:sec(?:onds?)?|s)?\s*40\b/i) ?? t.match(/\b40[^0-9]{0,25}(4\.[2-5]\d|5\.0\d)/i);
  if (fortyMatch) {
    const val = parseFloat(fortyMatch[1]);
    if (val >= 4.2 && val <= 5.1) out.forty_time = val;
  }

  const shuttleMatch =
    t.match(/\b(4\.\d{2})\s*(?:short\s*)?shuttle\b/i) ??
    t.match(/\b(3\.\d{2}|4\.\d{2}|5\.\d{2})\s*(?:short\s*)?shuttle\b/i) ??
    t.match(/\bshuttle[^0-9]*(4\.\d{2})/i);
  if (shuttleMatch) {
    const val = parseFloat(shuttleMatch[1]);
    if (val >= 3.8 && val <= 5.5) out.shuttle_time = val;
  }

  const verticalMatch =
    t.match(/\b(\d{2}(?:\.\d)?)\s*["″]?\s*vertical\b/i) ??
    t.match(/\bvertical[^0-9]*(\d{2}(?:\.\d)?)\s*["″]?/i) ??
    t.match(/\b(\d{2})\s*inch(?:es)?\s*vertical/i);
  if (verticalMatch) {
    const val = parseFloat(verticalMatch[1]);
    if (val >= 25 && val <= 45) out.vertical_jump = val;
  }

  const armMatch =
    t.match(/\b(\d{2}(?:\.\d)?)\s*["″]?\s*(?:inch(?:es)?\s*)?arm\b/i) ??
    t.match(/\barm\s*(?:length)?[^0-9]*(\d{2}(?:\.\d)?)\s*["″]?/i) ??
    t.match(/\b(\d{2}(?:\.\d)?)\s*["″]\s*arm/i);
  if (armMatch) {
    const val = parseFloat(armMatch[1]);
    if (val >= 28 && val <= 38) out.arm_length_in = val;
  }

  const wingMatch = t.match(/\b(\d{2}(?:\.\d)?)\s*["″]?\s*wing(?:span)?\b/i) ?? t.match(/\bwing(?:span)?[^0-9]*(\d{2}(?:\.\d)?)/i);
  if (wingMatch) {
    const val = parseFloat(wingMatch[1]);
    if (val >= 70 && val <= 90) out.wing_span_in = val;
  }

  return out;
}

/** Stats we can parse from 247 write-ups (e.g. "45 tackles, 8 sacks", "1,200 rushing yards"). */
export interface Parsed247Stats {
  games_played: number | null;
  starts: number | null;
  passing_yards: number | null;
  rushing_yards: number | null;
  receiving_yards: number | null;
  total_touchdowns: number | null;
  tackles: number | null;
  sacks: number | null;
  interceptions: number | null;
  passes_defended: number | null;
}

function parseNum(s: string): number {
  return parseInt(s.replace(/,/g, ""), 10);
}

function parseNumFloat(s: string): number {
  return parseFloat(s.replace(/,/g, ""));
}

export function parse247Stats(text: string): Parsed247Stats {
  const t = text.trim();
  const out: Parsed247Stats = {
    games_played: null,
    starts: null,
    passing_yards: null,
    rushing_yards: null,
    receiving_yards: null,
    total_touchdowns: null,
    tackles: null,
    sacks: null,
    interceptions: null,
    passes_defended: null
  };

  if (!t) return out;

  const gamesMatch =
    t.match(/\bplayed\s+(?:in\s+)?(\d{1,2})\s*games?\b/i) ??
    t.match(/\b(\d{1,2})\s*games?\s+played\b/i) ??
    t.match(/\bin\s+(\d{1,2})\s*games?\b/i);
  if (gamesMatch) {
    const v = parseNum(gamesMatch[1]);
    if (v >= 1 && v <= 20) out.games_played = v;
  }

  const startsMatch =
    t.match(/\bstarted\s+(\d{1,2})\s*games?\b/i) ??
    t.match(/\b(\d{1,2})\s*starts?\b/i);
  if (startsMatch) {
    const v = parseNum(startsMatch[1]);
    if (v >= 0 && v <= 20) out.starts = v;
  }

  const tacklesMatch = t.match(/\b(\d{1,3})\s*(?:total\s+)?tackles?\b/i) ?? t.match(/\btackles?\s*[:\s]*(\d{1,3})\b/i);
  if (tacklesMatch) {
    const v = parseNum(tacklesMatch[1]);
    if (v >= 0 && v <= 250) out.tackles = v;
  }

  const sacksMatch =
    t.match(/\b(\d{1,2}(?:\.\d)?)\s*sacks?\b/i) ??
    t.match(/\bsacks?\s*[:\s]*(\d{1,2}(?:\.\d)?)\b/i);
  if (sacksMatch) {
    const v = parseNumFloat(sacksMatch[1]);
    if (v >= 0 && v <= 30) out.sacks = v;
  }

  const intMatch =
    t.match(/\b(\d{1,2})\s*interceptions?\b/i) ??
    t.match(/\b(\d{1,2})\s*INTs?\b/i) ??
    t.match(/\binterceptions?\s*[:\s]*(\d{1,2})\b/i);
  if (intMatch) {
    const v = parseNum(intMatch[1]);
    if (v >= 0 && v <= 25) out.interceptions = v;
  }

  const pdMatch =
    t.match(/\b(\d{1,2})\s*passes?\s*defended\b/i) ??
    t.match(/\b(\d{1,2})\s*PDs?\b/i) ??
    t.match(/\bpasses?\s*defended\s*[:\s]*(\d{1,2})\b/i);
  if (pdMatch) {
    const v = parseNum(pdMatch[1]);
    if (v >= 0 && v <= 30) out.passes_defended = v;
  }

  const rushYardsMatch =
    t.match(/\b([\d,]+)\s*rushing\s*yards?\b/i) ??
    t.match(/\brushing\s*yards?\s*[:\s]*([\d,]+)\b/i) ??
    t.match(/\b([\d,]+)\s*yards?\s*rushing\b/i);
  if (rushYardsMatch) {
    const v = parseNum(rushYardsMatch[1]);
    if (v >= 0 && v <= 3500) out.rushing_yards = v;
  }

  const recYardsMatch =
    t.match(/\b([\d,]+)\s*receiving\s*yards?\b/i) ??
    t.match(/\breceiving\s*yards?\s*[:\s]*([\d,]+)\b/i) ??
    t.match(/\b([\d,]+)\s*yards?\s*receiving\b/i);
  if (recYardsMatch) {
    const v = parseNum(recYardsMatch[1]);
    if (v >= 0 && v <= 2500) out.receiving_yards = v;
  }

  const passYardsMatch =
    t.match(/\b([\d,]+)\s*passing\s*yards?\b/i) ??
    t.match(/\bpassing\s*yards?\s*[:\s]*([\d,]+)\b/i);
  if (passYardsMatch) {
    const v = parseNum(passYardsMatch[1]);
    if (v >= 0 && v <= 6000) out.passing_yards = v;
  }

  const tdMatch =
    t.match(/\b(\d{1,2})\s*touchdowns?\b/i) ??
    t.match(/\b(\d{1,2})\s*TDs?\b/i) ??
    t.match(/\btouchdowns?\s*[:\s]*(\d{1,2})\b/i);
  if (tdMatch) {
    const v = parseNum(tdMatch[1]);
    if (v >= 0 && v <= 60) out.total_touchdowns = v;
  }

  return out;
}
