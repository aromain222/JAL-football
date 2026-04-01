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
  console.log("\nOpening PFF login page...");
  await page.goto("https://auth.pff.com/login", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2000);

  // Try automated login first
  let loggedIn = false;
  const emailSelectors = ['input[type="email"]', 'input[name="email"]', 'input[name="username"]', 'input[placeholder*="email" i]', 'input[autocomplete*="email" i]'];
  for (const sel of emailSelectors) {
    if (await page.locator(sel).isVisible({ timeout: 1500 }).catch(() => false)) {
      await page.fill(sel, PFF_EMAIL);
      const passEl = page.locator('input[type="password"]').first();
      if (await passEl.isVisible({ timeout: 1500 }).catch(() => false)) {
        await passEl.fill(PFF_PASSWORD);
        await page.keyboard.press("Enter");
        await page.waitForURL(/premium\.pff\.com/, { timeout: 15000 }).catch(() => {});
        loggedIn = page.url().includes("premium.pff.com");
      }
      break;
    }
  }

  // If automated login failed, ask user to log in manually in the browser window
  if (!loggedIn && !page.url().includes("premium.pff.com")) {
    console.log("\n⚠  Automated login failed. Please log in manually in the browser window.");
    console.log("   Waiting up to 60 seconds for you to complete login...");
    await page.waitForURL(/premium\.pff\.com/, { timeout: 60000 }).catch(() => {});
  }

  if (!page.url().includes("pff.com")) throw new Error("Login failed — not on PFF after waiting");
  console.log(`Logged in ✓  (${page.url()})`);

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
        // Direct navigation via player_id + name slug
        await navigateToSnapCounts(page, job.name, job.pffId);
      } else {
        // Search by name
        await searchPlayerByName(page, job.name);
      }

      // Wait for snap counts tab/section to be visible
      // Take a debug screenshot of first player to confirm page layout
      if (downloaded + failed === 0) {
        await page.screenshot({ path: path.join(outDir, `debug_first_player.png`) });
        console.log(`  📸 Debug screenshot saved: debug_first_player.png`);
        // Log all text containing CSV or toggle
        const allText = await page.evaluate(() =>
          Array.from(document.querySelectorAll("a, button, label, [role='switch'], [role='button']"))
            .map(el => `${el.tagName} | ${el.className} | ${el.textContent?.trim().slice(0, 50)}`)
            .filter(t => t.toLowerCase().includes("csv") || t.toLowerCase().includes("detail") || t.toLowerCase().includes("snap"))
        );
        console.log("  Page elements:", allText.join("\n    "));
      }

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

async function navigateToSnapCounts(page: import("playwright").Page, playerName: string, playerId: string) {
  // Build URL slug from player name: "Rueben Bain Jr" → "rueben-bain-jr"
  const slug = playerName.toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const url = `https://premium.pff.com/ncaa/players/2025/REGPO/${slug}/${playerId}/snaps-by-position`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForTimeout(1500);

  // Enable "Detailed Positions" toggle
  // Try multiple selectors — click the toggle area near "Detailed Positions" text
  const toggleSelectors = [
    'label:has-text("Detailed")',
    '[role="switch"]',
    'button:has-text("Detailed")',
    'input[type="checkbox"]',
    '[class*="toggle"]',
    '[class*="switch"]',
  ];
  for (const sel of toggleSelectors) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
      await el.click().catch(() => {});
      await page.waitForTimeout(800);
      break;
    }
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

  // Navigate to snaps-by-position tab
  const snapTab = page.locator('a[href*="snaps-by-position"], button, [role="tab"]')
    .filter({ hasText: /snap/i }).first();
  if (await snapTab.isVisible({ timeout: 3000 }).catch(() => false)) {
    await snapTab.click();
    await page.waitForTimeout(1000);
  }

  // Enable "Detailed Positions" toggle
  const toggle = page.locator('label:has-text("Detailed"), button:has-text("Detailed"), [role="switch"]').first();
  if (await toggle.isVisible({ timeout: 3000 }).catch(() => false)) {
    const isOn = await toggle.evaluate(el =>
      el.getAttribute("aria-checked") === "true" || (el as HTMLInputElement).checked
    ).catch(() => false);
    if (!isOn) {
      await toggle.click();
      await page.waitForTimeout(800);
    }
  }
}

async function findCsvButton(page: import("playwright").Page) {
  // Wait a bit for page to fully render
  await page.waitForTimeout(2000);

  // Try various selectors PFF uses for CSV export
  const selectors = [
    'button:has-text("CSV")',
    'a:has-text("CSV")',
    'span:has-text("CSV")',
    '[data-testid*="csv"]',
    '[aria-label*="CSV"]',
    '[class*="csv"]',
    'a[href*=".csv"]',
    'button:has-text("Export")',
    'a:has-text("Export")',
    '[class*="export"]',
    '[class*="download"]',
  ];
  for (const sel of selectors) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 2000 }).catch(() => false)) return el;
  }

  // Last resort: find any element whose text is exactly "CSV"
  const anyEl = page.getByText("CSV", { exact: true }).first();
  if (await anyEl.isVisible({ timeout: 2000 }).catch(() => false)) return anyEl;

  return null;
}

main().catch(err => { console.error(err); process.exit(1); });
