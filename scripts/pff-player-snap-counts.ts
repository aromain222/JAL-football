/**
 * PFF Player Snap Counts Downloader
 *
 * Reads 638 portal players from ~/Desktop/players_rows (5).csv,
 * matches them to PFF player_ids via the existing position CSVs,
 * then uses Playwright to log into PFF, navigate each player's
 * snap-counts tab, and download the CSV.
 *
 * Usage:
 *   npm run pff:snap-counts
 *   npm run pff:snap-counts -- --csv-dir "/Users/averyromain/Desktop/transfer portal" --out ./data/pff/snap-counts
 *
 * Already-downloaded files are skipped automatically.
 */

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { chromium } from "playwright";

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function getArg(flag: string): string | null {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 ? (process.argv[idx + 1] ?? null) : null;
}

const PFF_EMAIL    = process.env.PFF_EMAIL    ?? "rspringer@ucdavis.edu";
const PFF_PASSWORD = process.env.PFF_PASSWORD ?? "go ags!!!";

const csvDir  = getArg("--csv-dir") ?? path.join(os.homedir(), "Desktop", "transfer portal");
const outDir  = path.resolve(getArg("--out") ?? path.join("data", "pff", "snap-counts"));
const portalCsv = getArg("--portal-csv") ?? path.join(os.homedir(), "Desktop", "players_rows (5).csv");

fs.mkdirSync(outDir, { recursive: true });

// ---------------------------------------------------------------------------
// CSV helpers
// ---------------------------------------------------------------------------

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQ = false;
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; }
    else if (ch === "," && !inQ) { result.push(cur); cur = ""; }
    else { cur += ch; }
  }
  result.push(cur);
  return result;
}

function readCSV(filePath: string): Record<string, string>[] {
  const buf = fs.readFileSync(filePath);
  let content: string;
  if (buf[0] === 0xFF && buf[1] === 0xFE) content = buf.slice(2).toString("utf16le");
  else if (buf[0] === 0xFE && buf[1] === 0xFF) content = buf.slice(2).swap16().toString("utf16le");
  else if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) content = buf.slice(3).toString("utf-8");
  else content = buf.toString("utf-8");

  const lines = content.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]).map(h => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map(line => {
    const vals = parseCSVLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = (vals[i] ?? "").trim().replace(/^"|"$/g, ""); });
    return row;
  });
}

function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
}

// ---------------------------------------------------------------------------
// Build player_id lookup from position CSVs
// ---------------------------------------------------------------------------

function buildPffIdMap(dir: string): Map<string, string> {
  const map = new Map<string, string>(); // normalizedName -> player_id
  if (!fs.existsSync(dir)) return map;

  const allFiles = fs.readdirSync(dir).filter(f => f.endsWith(".csv"));
  const files = allFiles.filter(f => {
    if (f.toLowerCase().includes("copy")) return false;
    const m = f.match(/^(.+) \(\d+\)\.csv$/i);
    if (m) return !allFiles.includes(m[1] + ".csv");
    return true;
  });

  for (const file of files) {
    try {
      const rows = readCSV(path.join(dir, file));
      for (const row of rows) {
        const pid = row.player_id?.trim();
        const name = row.player?.trim();
        if (pid && name) {
          const norm = normalizeName(name);
          if (!map.has(norm)) map.set(norm, pid);
        }
      }
    } catch { /* skip bad files */ }
  }
  console.log(`Built PFF id map: ${map.size} players`);
  return map;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (!fs.existsSync(portalCsv)) {
    console.error(`Portal CSV not found: ${portalCsv}`);
    process.exit(1);
  }

  // Load portal players
  const portalRows = readCSV(portalCsv);
  const portalPlayers = portalRows.map(r => ({
    name: `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim(),
    position: r.position ?? "",
    school: r.previous_school ?? "",
  })).filter(p => p.name);

  console.log(`Portal players: ${portalPlayers.length}`);

  // Build PFF id lookup from downloaded CSVs
  const pffIdMap = buildPffIdMap(csvDir);

  // Match portal players to PFF ids
  type PlayerJob = { name: string; position: string; school: string; pffId: string | null };
  const jobs: PlayerJob[] = portalPlayers.map(p => ({
    ...p,
    pffId: pffIdMap.get(normalizeName(p.name)) ?? null,
  }));

  const matched   = jobs.filter(j => j.pffId);
  const unmatched = jobs.filter(j => !j.pffId);
  console.log(`PFF id matched: ${matched.length} / ${jobs.length}`);
  if (unmatched.length) {
    console.log(`No PFF id (will search by name): ${unmatched.map(j => j.name).join(", ")}`);
  }

  // Launch browser
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = await browser.newContext({ acceptDownloads: true });
  const page    = await context.newPage();

  // Log in
  console.log("\nLogging into PFF...");
  await page.goto("https://auth.pff.com/login", { waitUntil: "networkidle" });
  await page.fill('input[type="email"], input[name="email"]', PFF_EMAIL);
  await page.fill('input[type="password"], input[name="password"]', PFF_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/premium\.pff\.com/, { timeout: 15000 }).catch(() => {});
  console.log("Logged in ✓");

  let downloaded = 0;
  let skipped    = 0;
  let failed     = 0;

  for (const job of jobs) {
    const safeName = job.name.replace(/[^a-z0-9]/gi, "_");
    const destFile = path.join(outDir, `${safeName}_snap_counts.csv`);

    // Skip if already downloaded
    if (fs.existsSync(destFile)) {
      skipped++;
      continue;
    }

    console.log(`\n[${downloaded + skipped + failed + 1}/${jobs.length}] ${job.name} (${job.position}, ${job.school})`);

    try {
      if (job.pffId) {
        // Direct navigation via player_id
        await navigateToSnapCounts(page, job.pffId);
      } else {
        // Search by name
        await searchPlayerByName(page, job.name);
      }

      // Wait for snap counts tab/section to be visible
      const csvButton = await findCsvButton(page);
      if (!csvButton) {
        console.log(`  ⚠ No CSV button found — skipping`);
        failed++;
        continue;
      }

      // Download
      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 15000 }),
        csvButton.click(),
      ]);

      await download.saveAs(destFile);
      console.log(`  ✓ Saved: ${path.basename(destFile)}`);
      downloaded++;

      // Small pause to avoid rate limiting
      await page.waitForTimeout(800);

    } catch (err) {
      console.error(`  ✗ Error: ${(err as Error).message}`);
      failed++;
      // Take screenshot for debugging
      await page.screenshot({ path: path.join(outDir, `error_${safeName}.png`) }).catch(() => {});
    }
  }

  await browser.close();

  console.log(`\n${"─".repeat(50)}`);
  console.log(`Downloaded: ${downloaded}`);
  console.log(`Skipped (already exists): ${skipped}`);
  console.log(`Failed: ${failed}`);
  console.log(`Saved to: ${outDir}`);
}

// ---------------------------------------------------------------------------
// Navigation helpers
// ---------------------------------------------------------------------------

async function navigateToSnapCounts(page: import("playwright").Page, playerId: string) {
  // Try direct snap-counts URL first
  const url = `https://premium.pff.com/ncaa/players/${playerId}/snap-counts?season=2025&seasonType=REGPO`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForTimeout(1500);

  // If redirected away or page shows error, try base player page and click snap counts tab
  const currentUrl = page.url();
  if (!currentUrl.includes(playerId)) {
    throw new Error(`Redirected away from player page: ${currentUrl}`);
  }

  // Click "Snap Counts" tab if present
  const snapTab = page.locator('a, button, [role="tab"]').filter({ hasText: /snap.?count/i }).first();
  if (await snapTab.isVisible({ timeout: 3000 }).catch(() => false)) {
    await snapTab.click();
    await page.waitForTimeout(1000);
  }
}

async function searchPlayerByName(page: import("playwright").Page, name: string) {
  // Navigate to player search
  await page.goto(
    `https://premium.pff.com/ncaa/players/search?q=${encodeURIComponent(name)}&season=2025&seasonType=REGPO`,
    { waitUntil: "domcontentloaded", timeout: 20000 }
  );
  await page.waitForTimeout(1500);

  // Click first result
  const firstResult = page.locator('a[href*="/players/"]').first();
  if (!await firstResult.isVisible({ timeout: 5000 }).catch(() => false)) {
    throw new Error(`No search results for "${name}"`);
  }
  await firstResult.click();
  await page.waitForTimeout(1500);

  // Click snap counts tab
  const snapTab = page.locator('a, button, [role="tab"]').filter({ hasText: /snap.?count/i }).first();
  if (await snapTab.isVisible({ timeout: 3000 }).catch(() => false)) {
    await snapTab.click();
    await page.waitForTimeout(1000);
  }
}

async function findCsvButton(page: import("playwright").Page) {
  // Try various selectors PFF uses for CSV export
  const selectors = [
    'button:has-text("CSV")',
    'a:has-text("CSV")',
    '[data-testid*="csv"]',
    '[aria-label*="CSV"]',
    'button[class*="csv"]',
    'a[href*=".csv"]',
    'button:has-text("Export")',
    'a:has-text("Export")',
  ];
  for (const sel of selectors) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 1500 }).catch(() => false)) return el;
  }
  return null;
}

main().catch(err => { console.error(err); process.exit(1); });
