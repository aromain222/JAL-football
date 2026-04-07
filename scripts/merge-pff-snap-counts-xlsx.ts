/**
 * Merge PFF per-player snap-count CSVs into an existing PFF stats .xlsx.
 *
 * Each CSV row is one (position_group, position, week) alignment. The numeric
 * columns (pass, pass_route, coverage, …) are *role* snap counts for that row;
 * summing them gives the total snaps played while lined up in that alignment.
 *
 * We pivot by where they lined up (not by role type):
 * - Default `--granularity lineup`: one column per PFF alignment (`position_group` + `position`),
 *   e.g. `DLine — NT`, `DLine — LE`, `DLine — LEO` (matches “Snaps by Position” on premium.pff.com).
 * - `--granularity group`: one column per `position_group` only (rolls all DLine techs into one number).
 *
 * Usage:
 *   npm run pff:merge-snaps -- --xlsx ~/Desktop/pff-stats-2026-04-01.xlsx --snaps ~/Desktop/Snap\ Counts\ 2
 *   npm run pff:merge-snaps -- --xlsx ./book.xlsx --snaps ./snaps --granularity group --out ./book-summary.xlsx
 */

import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function getArg(flag: string): string | null {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 ? (process.argv[idx + 1] ?? null) : null;
}

const xlsxPath = getArg("--xlsx");
const snapsDir = getArg("--snaps");
const outPathArg = getArg("--out");
const granularityArg = (getArg("--granularity") ?? "lineup").toLowerCase();

if (!xlsxPath || !snapsDir) {
  console.error(
    "Usage: tsx scripts/merge-pff-snap-counts-xlsx.ts --xlsx <path> --snaps <dir> [--out <path>] [--granularity group|lineup]"
  );
  process.exit(1);
}

if (granularityArg !== "group" && granularityArg !== "lineup") {
  console.error('--granularity must be "group" or "lineup"');
  process.exit(1);
}

const xlsxResolved = path.resolve(xlsxPath);
const snapsResolved = path.resolve(snapsDir);
const defaultSuffix =
  granularityArg === "lineup" ? "-with-alignment-snaps.xlsx" : "-with-position-group-snaps.xlsx";
const defaultOut = xlsxResolved.replace(/\.xlsx$/i, "") + defaultSuffix;
const outputPath = path.resolve(outPathArg ?? defaultOut);

if (!fs.existsSync(xlsxResolved)) {
  console.error(`XLSX not found: ${xlsxResolved}`);
  process.exit(1);
}
if (!fs.existsSync(snapsResolved) || !fs.statSync(snapsResolved).isDirectory()) {
  console.error(`Snap directory not found: ${snapsResolved}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Name + CSV helpers
// ---------------------------------------------------------------------------

function normalizePlayerKey(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function playerKeyFromSnapFilename(file: string): string | null {
  if (!file.toLowerCase().endsWith(".csv")) return null;
  if (!/_snap_counts\.csv$/i.test(file)) return null;
  const stem = file.replace(/_snap_counts\.csv$/i, "");
  const spaced = stem.replace(/_/g, " ").trim();
  if (!spaced) return null;
  return normalizePlayerKey(spaced);
}

function splitCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  values.push(current.trim());
  return values;
}

/** Row snap total = sum of all role columns (snap-type counts for that alignment row). */
function parseSnapCsv(filePath: string, granularity: "group" | "lineup"): { lineups: Record<string, number> } | null {
  const raw = fs.readFileSync(filePath, "utf-8");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return null;

  const headers = splitCsvLine(lines[0]).map((h) => h.toLowerCase().trim());
  const iPg = headers.indexOf("position_group");
  const iPos = headers.indexOf("position");
  if (iPg === -1 || iPos === -1) return null;

  const skip = new Set(["position_group", "position", "week_id"]);
  const metricCols = headers.filter((h) => h && !skip.has(h));
  if (metricCols.length === 0) return null;

  const lineups: Record<string, number> = {};

  for (let li = 1; li < lines.length; li++) {
    const vals = splitCsvLine(lines[li]);
    const pg = (vals[iPg] ?? "").trim();
    const pos = (vals[iPos] ?? "").trim();
    if (!pg && !pos) continue;

    let rowSum = 0;
    for (const m of metricCols) {
      const idx = headers.indexOf(m);
      const v = (vals[idx] ?? "").trim();
      if (v === "" || v === "-") continue;
      const n = Number(v.replace(/,/g, ""));
      if (!Number.isFinite(n)) continue;
      rowSum += n;
    }
    if (rowSum === 0) continue;

    const key =
      granularity === "group" ? pg : `${pg}|${pos}`;
    lineups[key] = (lineups[key] ?? 0) + rowSum;
  }

  return { lineups };
}

function cellText(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v).trim();
  if (typeof v === "object" && v !== null && "richText" in v) {
    const rt = (v as { richText?: { text: string }[] }).richText;
    return (rt ?? []).map((r) => r.text).join("").trim();
  }
  if (typeof v === "object" && v !== null && "text" in v) return String((v as { text: string }).text).trim();
  if (typeof v === "object" && v !== null && "result" in v) return String((v as { result?: unknown }).result ?? "").trim();
  return String(v).trim();
}

function columnLabel(key: string, granularity: "group" | "lineup"): string {
  if (granularity === "group") {
    return `Snaps ${key}`;
  }
  const [pg, pos] = key.split("|");
  return `${pg} — ${pos}`;
}

function sortLineupKeys(keys: string[], granularity: "group" | "lineup"): string[] {
  if (granularity === "group") {
    return [...keys].sort((a, b) => a.localeCompare(b));
  }
  return [...keys].sort((a, b) => {
    const [aPg, aPos] = a.split("|");
    const [bPg, bPos] = b.split("|");
    const c = aPg.localeCompare(bPg);
    return c !== 0 ? c : aPos.localeCompare(bPos);
  });
}

// ---------------------------------------------------------------------------
// Load all snap aggregates
// ---------------------------------------------------------------------------

type SnapEntry = { lineups: Record<string, number>; sourceFile: string };

function loadSnapFolder(dir: string, granularity: "group" | "lineup"): { byPlayer: Map<string, SnapEntry>; columnKeys: string[] } {
  const byPlayer = new Map<string, SnapEntry>();
  const keySet = new Set<string>();
  const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".csv"));

  for (const file of files) {
    const pkey = playerKeyFromSnapFilename(file);
    if (!pkey) continue;

    const full = path.join(dir, file);
    const parsed = parseSnapCsv(full, granularity);
    if (!parsed) continue;

    for (const k of Object.keys(parsed.lineups)) keySet.add(k);

    if (byPlayer.has(pkey)) {
      console.warn(`Duplicate snap file for same normalized name "${pkey}" — keeping ${byPlayer.get(pkey)!.sourceFile}, skipping ${file}`);
      continue;
    }
    byPlayer.set(pkey, { lineups: parsed.lineups, sourceFile: file });
  }

  const columnKeys = sortLineupKeys([...keySet], granularity);
  return { byPlayer, columnKeys };
}

// ---------------------------------------------------------------------------
// Merge into workbook
// ---------------------------------------------------------------------------

async function main() {
  const { byPlayer, columnKeys } = loadSnapFolder(snapsResolved, granularityArg);
  console.log(`Loaded ${byPlayer.size} snap profiles from ${snapsResolved}`);
  console.log(`Granularity: ${granularityArg} (${columnKeys.length} lineup columns)`);

  if (columnKeys.length === 0) {
    console.error("No valid *_snap_counts.csv files in snap directory.");
    process.exit(1);
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(xlsxResolved);

  let totalMatchedRows = 0;
  const unmatchedSnapKeys = new Set(byPlayer.keys());
  const sheetDupNameWarnings: string[] = [];

  for (const ws of wb.worksheets) {
    const headerRow = ws.getRow(1);
    let lastCol = 0;
    headerRow.eachCell({ includeEmpty: false }, (_cell, colNumber) => {
      lastCol = Math.max(lastCol, colNumber);
    });
    if (lastCol < 1) continue;

    const startCol = lastCol + 1;
    const newLabels = columnKeys.map((k) => columnLabel(k, granularityArg));
    newLabels.forEach((label, i) => {
      headerRow.getCell(startCol + i).value = label;
    });

    const seenKeys = new Map<string, number[]>(); // norm -> row numbers

    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const playerRaw = cellText(row.getCell(1).value);
      if (!playerRaw) return;
      const key = normalizePlayerKey(playerRaw);
      if (!seenKeys.has(key)) seenKeys.set(key, []);
      seenKeys.get(key)!.push(rowNumber);
    });

    for (const [key, rows] of seenKeys) {
      if (rows.length > 1) {
        sheetDupNameWarnings.push(`${ws.name}: "${key}" appears on rows ${rows.join(", ")}`);
      }
    }

    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const playerRaw = cellText(row.getCell(1).value);
      if (!playerRaw) return;
      const key = normalizePlayerKey(playerRaw);
      const snap = byPlayer.get(key);
      if (!snap) return;

      unmatchedSnapKeys.delete(key);
      totalMatchedRows++;

      columnKeys.forEach((colKey, i) => {
        const v = snap.lineups[colKey] ?? 0;
        row.getCell(startCol + i).value = v;
      });
    });

    headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      if (colNumber >= startCol) {
        cell.font = { ...(cell.font ?? {}), bold: true };
      }
    });
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  await wb.xlsx.writeFile(outputPath);

  console.log(`\nWrote: ${outputPath}`);
  console.log(`Matched snap data to ${totalMatchedRows} player rows (same player on multiple sheets counts multiple times).`);

  if (unmatchedSnapKeys.size > 0) {
    const sample = [...unmatchedSnapKeys].slice(0, 25);
    console.log(`\nSnap CSVs with no matching Player in workbook (${unmatchedSnapKeys.size}):`);
    for (const k of sample) {
      console.log(`  - ${byPlayer.get(k)!.sourceFile} (key: ${k})`);
    }
    if (unmatchedSnapKeys.size > sample.length) console.log(`  ... and ${unmatchedSnapKeys.size - sample.length} more`);
  }

  if (sheetDupNameWarnings.length > 0) {
    console.log(`\nWarning: duplicate normalized names within a sheet (same snap totals were written to every matching row):`);
    for (const w of sheetDupNameWarnings.slice(0, 15)) console.log(`  ${w}`);
    if (sheetDupNameWarnings.length > 15) console.log(`  ... and ${sheetDupNameWarnings.length - 15} more`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
