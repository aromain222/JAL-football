/**
 * Maps player position values → the Supabase PFF stats table name.
 * Table names match exactly what's in the user's Supabase project.
 */
export const POSITION_TABLE: Record<string, string> = {
  QB: "QB",
  RB: "RB",
  FB: "RB",
  WR: "WR",
  TE: "TE",
  OL: "OL",
  OT: "OL",
  OG: "OL",
  C: "OL",
  LT: "OL",
  LG: "OL",
  RG: "OL",
  RT: "OL",
  "DL/EDGE": "DL/Edge",
  DL: "DL/Edge",
  DE: "DL/Edge",
  DT: "DL/Edge",
  EDGE: "DL/Edge",
  LB: "LB",
  ILB: "LB",
  OLB: "LB",
  MLB: "LB",
  CB: "CB",
  S: "S",
  FS: "S",
  SS: "S",
  DB: "CB",
};

export function tableForPosition(position: string | null | undefined): string | null {
  if (!position) return null;
  return POSITION_TABLE[position.toUpperCase()] ?? null;
}
