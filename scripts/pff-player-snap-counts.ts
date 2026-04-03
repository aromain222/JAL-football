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

// Optional position filter: --positions "DL,LB,OL" (comma-separated, case-insensitive)
const positionFilter: Set<string> | null = (() => {
  const raw = getArg("--positions");
  if (!raw) return null;
  return new Set(raw.split(",").map(p => p.trim().toUpperCase()));
})();

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
  let jobs: PlayerJob[] = portalPlayers.map(p => ({
    ...p,
    pffId: pffIdMap.get(normalizeName(p.name)) ?? null,
  }));

  // Apply position filter if provided
  if (positionFilter) {
    const before = jobs.length;
    jobs = jobs.filter(j => {
      const pos = j.position.toUpperCase();
      // Match exact or prefix (e.g. "DL" matches "DT", "DE", "NT", "ED")
      return [...positionFilter].some(f =>
        pos === f || pos.startsWith(f) ||
        (f === "DL" && /^(DT|DE|NT|ED|IDL|DL)/.test(pos)) ||
        (f === "LB" && /^(LB|ILB|OLB|MLB|WLB|SLB)/.test(pos)) ||
        (f === "OL" && /^(OL|OT|OG|C|LT|RT|LG|RG)/.test(pos))
      );
    });
    console.log(`Position filter (${[...positionFilter].join(",")}): ${jobs.length} of ${before} players`);
  }

  const matched   = jobs.filter(j => j.pffId);
  const unmatched = jobs.filter(j => !j.pffId);
  console.log(`PFF id matched: ${matched.length} / ${jobs.length}`);
  if (unmatched.length) {
    console.log(`No PFF id (will search by name): ${unmatched.map(j => j.name).join(", ")}`);
  }

  // Use a persistent browser profile so the session is saved between runs
  const userDataDir = path.join(os.homedir(), ".pff-browser-session");
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    slowMo: 100,
    acceptDownloads: true,
  });
  const page = context.pages()[0] ?? await context.newPage();

  // Open PFF
  console.log("\nOpening PFF...");
  await page.goto("https://premium.pff.com", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(3000);

  // Check if we need to log in by looking for email input
  const emailSelectors = ['input[type="email"]', 'input[name="email"]', 'input[name="username"]', 'input[placeholder*="email" i]'];
  let needsLogin = false;
  for (const sel of emailSelectors) {
    if (await page.locator(sel).isVisible({ timeout: 2000 }).catch(() => false)) {
      needsLogin = true;
      break;
    }
  }

  if (!needsLogin) {
    // Try navigating to login page to check
    await page.goto("https://premium.pff.com/login", { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(2000);
    for (const sel of emailSelectors) {
      if (await page.locator(sel).isVisible({ timeout: 3000 }).catch(() => false)) {
        needsLogin = true;
        break;
      }
    }
  }

  if (needsLogin) {
    console.log("Logging in...");
    // Fill email
    for (const sel of emailSelectors) {
      if (await page.locator(sel).isVisible({ timeout: 3000 }).catch(() => false)) {
        await page.fill(sel, PFF_EMAIL);
        await page.keyboard.press("Enter");
        await page.waitForTimeout(2000);
        break;
      }
    }
    // Fill password
    if (await page.locator('input[type="password"]').isVisible({ timeout: 10000 }).catch(() => false)) {
      await page.fill('input[type="password"]', PFF_PASSWORD);
      await page.waitForTimeout(300);
      const submitSelectors = ['button[type="submit"]', 'button:has-text("Sign in")', 'button:has-text("Log in")', 'button:has-text("Continue")'];
      let clicked = false;
      for (const sel of submitSelectors) {
        if (await page.locator(sel).isVisible({ timeout: 1000 }).catch(() => false)) {
          await page.click(sel);
          clicked = true;
          break;
        }
      }
      if (!clicked) await page.keyboard.press("Enter");
    }
  } else {
    console.log("Already logged in (saved session).");
  }

  // Wait until on premium.pff.com
  await page.waitForURL(/premium\.pff\.com/, { timeout: 60000 });
  await page.waitForTimeout(1000);
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

  // Enable "Detailed Positions" toggle — wait for page to fully render first
  await page.waitForTimeout(2500);
  await enableDetailedPositions(page);
}

async function searchPlayerByName(page: import("playwright").Page, name: string) {
  // Navigate to NCAA players page if not already there
  if (!page.url().includes("premium.pff.com/ncaa")) {
    await page.goto("https://premium.pff.com/ncaa/players/2025/REGPO", { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(2000);
  }

  // PFF has a "Search for player..." button that opens a search modal — click it first
  const searchTriggerSelectors = [
    'button:has-text("Search for player")',
    '[placeholder*="Search for player" i]',
    '[class*="player-search"]',
    '[class*="search-player"]',
    'button[class*="search"]',
  ];
  for (const sel of searchTriggerSelectors) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
      await el.click();
      await page.waitForTimeout(1000);
      break;
    }
  }

  // Now find the actual text input (may have appeared after clicking trigger)
  const inputSelectors = [
    'input[placeholder*="search" i]',
    'input[type="search"]',
    'input[placeholder*="player" i]',
    '[class*="search"] input',
    'input[name="q"]',
    'input[aria-label*="search" i]',
  ];
  let searchInput: import("playwright").Locator | null = null;
  for (const sel of inputSelectors) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
      searchInput = el;
      break;
    }
  }

  if (!searchInput) {
    throw new Error(`Could not find search input for "${name}"`);
  }

  // Type the player name
  await searchInput.click();
  await searchInput.fill("");
  await searchInput.type(name, { delay: 80 });
  await page.waitForTimeout(2000); // wait for autocomplete dropdown

  // Click first result — try multiple selectors for PFF's dropdown
  const resultSelectors = [
    `a[href*="/players/"]:has-text("${name.split(" ")[0]}")`,
    `li:has-text("${name.split(" ")[0]}")`,
    `[class*="option"]:has-text("${name.split(" ")[0]}")`,
    `[class*="result"]:has-text("${name.split(" ")[0]}")`,
    `[class*="suggestion"]:has-text("${name.split(" ")[0]}")`,
    `[class*="dropdown"] li`,
    `[class*="autocomplete"] li`,
    `[role="option"]`,
    `a[href*="/players/"]`,
  ];
  let clicked = false;
  for (const sel of resultSelectors) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
      await el.click();
      clicked = true;
      await page.waitForTimeout(1500);
      break;
    }
  }
  if (!clicked) throw new Error(`No search results found for "${name}"`);

  // Navigate to snaps-by-position — append to current URL if needed
  if (!page.url().includes("snaps-by-position")) {
    const snapTab = page.locator('[href*="snaps-by-position"], [role="tab"]').filter({ hasText: /snap/i }).first();
    if (await snapTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await snapTab.click();
      await page.waitForTimeout(1000);
    } else {
      const snapUrl = page.url().replace(/\/[^/]+$/, "/snaps-by-position");
      await page.goto(snapUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
      await page.waitForTimeout(1000);
    }
  }

  await enableDetailedPositions(page);
}

async function enableDetailedPositions(page: import("playwright").Page) {
  // From the screenshot: toggle is a slider switch sibling to "Detailed Positions" text.
  // Walk up from the text node to find the container, then click the toggle within it.
  const clicked = await page.evaluate(() => {
    // Find the text node with "Detailed Positions"
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    let labelEl: Element | null = null;
    while ((node = walker.nextNode())) {
      if (node.textContent?.trim().toLowerCase().includes("detailed positions")) {
        labelEl = node.parentElement;
        break;
      }
    }
    if (!labelEl) return "not_found";

    // Walk up to find a container that has a sibling or child toggle
    let container: Element | null = labelEl;
    for (let i = 0; i < 5; i++) {
      if (!container) break;
      // Look for toggle/switch inside this container
      const toggle = container.querySelector(
        '[role="switch"], input[type="checkbox"], button[class*="toggle"], ' +
        'button[class*="switch"], [class*="toggle-track"], [class*="toggle-thumb"], ' +
        '[class*="switch-track"], [class*="switch-thumb"], svg'
      );
      if (toggle && toggle !== labelEl) {
        (toggle as HTMLElement).click();
        return "clicked_child:" + toggle.tagName + "." + toggle.className.toString().slice(0, 40);
      }
      // Also check siblings of the label element's parent
      const parent = container.parentElement;
      if (parent) {
        for (const sibling of Array.from(parent.children)) {
          if (sibling === container) continue;
          if (
            sibling.getAttribute("role") === "switch" ||
            sibling.tagName === "BUTTON" ||
            sibling.className?.toString().toLowerCase().includes("toggle") ||
            sibling.className?.toString().toLowerCase().includes("switch")
          ) {
            (sibling as HTMLElement).click();
            return "clicked_sibling:" + sibling.tagName + "." + sibling.className.toString().slice(0, 40);
          }
          // Check children of siblings too
          const inner = sibling.querySelector('[role="switch"], [class*="toggle"], [class*="switch"]');
          if (inner) {
            (inner as HTMLElement).click();
            return "clicked_sibling_child:" + inner.tagName + "." + inner.className.toString().slice(0, 40);
          }
        }
      }
      container = parent;
    }
    // Last resort: click the label/parent itself
    (labelEl as HTMLElement).click();
    return "clicked_label";
  });

  if (clicked && clicked !== "not_found") {
    await page.waitForTimeout(800);
    console.log(`  ✓ Detailed Positions enabled (${clicked})`);
  } else {
    console.log("  ⚠ Could not find Detailed Positions toggle");
  }
}

async function findCsvButton(page: import("playwright").Page) {
  await page.waitForTimeout(2000);

  // Try Playwright selectors first
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
    if (await el.isVisible({ timeout: 1000 }).catch(() => false)) return el;
  }

  // JS fallback: find any clickable element whose text is "CSV"
  const csvHandle = await page.evaluateHandle(() => {
    const els = Array.from(document.querySelectorAll("a, button, span, div"));
    return els.find(el => el.textContent?.trim() === "CSV") ?? null;
  });
  if (csvHandle) {
    const el = csvHandle.asElement();
    if (el) return page.locator(`text=CSV`).first();
  }

  // Last resort: find any element whose text is exactly "CSV"
  const anyEl = page.getByText("CSV", { exact: true }).first();
  if (await anyEl.isVisible({ timeout: 2000 }).catch(() => false)) return anyEl;

  return null;
}

main().catch(err => { console.error(err); process.exit(1); });
