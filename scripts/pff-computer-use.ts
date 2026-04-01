/**
 * PFF Stats Downloader — Claude Computer Use + Playwright
 *
 * Uses Claude's computer-use API to control a browser, sign into PFF,
 * and download all relevant premium CSV exports.
 *
 * Usage:
 *   npm run pff:download
 *   # or specify a custom output directory:
 *   npm run pff:download -- --out ./data/pff/custom
 *
 * Required env vars (in .env.local):
 *   ANTHROPIC_API_KEY=...
 *   PFF_EMAIL=...
 *   PFF_PASSWORD=...
 *
 * Optional:
 *   PFF_SEASON=2024   (default: current year)
 */

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { chromium, type Page, type Download } from "playwright";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const PFF_EMAIL = process.env.PFF_EMAIL;
const PFF_PASSWORD = process.env.PFF_PASSWORD;
const PFF_SEASON = process.env.PFF_SEASON ?? String(new Date().getFullYear());

const VIEWPORT_WIDTH = 1280;
const VIEWPORT_HEIGHT = 900;
const MAX_TURNS = 150; // safety limit for the agentic loop

// ---------------------------------------------------------------------------
// Validate env
// ---------------------------------------------------------------------------

if (!ANTHROPIC_API_KEY) {
  console.error("Missing ANTHROPIC_API_KEY in environment. Set it in .env.local");
  process.exit(1);
}
if (!PFF_EMAIL || !PFF_PASSWORD) {
  console.error("Missing PFF_EMAIL or PFF_PASSWORD in environment. Set them in .env.local");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Output directory
// ---------------------------------------------------------------------------

const outDirArg = (() => {
  const idx = process.argv.indexOf("--out");
  return idx !== -1 ? process.argv[idx + 1] : null;
})();

const dateStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
const downloadDir = path.resolve(
  outDirArg ?? path.join("data", "pff", dateStr)
);

fs.mkdirSync(downloadDir, { recursive: true });
console.log(`\nDownloads will be saved to: ${downloadDir}`);

// ---------------------------------------------------------------------------
// Anthropic client
// ---------------------------------------------------------------------------

const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// ---------------------------------------------------------------------------
// Types — computer_20251124 action spec
// ---------------------------------------------------------------------------

type ComputerAction =
  | { action: "screenshot" }
  | { action: "left_click"; coordinate: [number, number] }
  | { action: "right_click"; coordinate: [number, number] }
  | { action: "middle_click"; coordinate: [number, number] }
  | { action: "double_click"; coordinate: [number, number] }
  | { action: "mouse_move"; coordinate: [number, number] }
  | { action: "left_click_drag"; startCoordinate: [number, number]; coordinate: [number, number] }
  | { action: "type"; text: string }
  | { action: "key"; text: string }
  | { action: "scroll"; coordinate: [number, number]; direction: "up" | "down" | "left" | "right"; amount: number }
  | { action: "cursor_position" };

// ---------------------------------------------------------------------------
// Playwright action executor
// Returns content array ready to be used as tool_result content
// ---------------------------------------------------------------------------

async function executeAction(
  page: Page,
  action: ComputerAction
): Promise<Anthropic.Messages.BetaToolResultBlockParam["content"]> {
  switch (action.action) {
    case "screenshot": {
      const buf = await page.screenshot({ type: "png", fullPage: false });
      return [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: "image/png",
            data: buf.toString("base64"),
          },
        },
      ];
    }

    case "left_click": {
      const [x, y] = action.coordinate;
      await page.mouse.click(x, y);
      await page.waitForTimeout(400);
      const buf = await page.screenshot({ type: "png", fullPage: false });
      return [
        { type: "text", text: "left_clicked" },
        { type: "image", source: { type: "base64", media_type: "image/png", data: buf.toString("base64") } },
      ];
    }

    case "right_click": {
      const [x, y] = action.coordinate;
      await page.mouse.click(x, y, { button: "right" });
      await page.waitForTimeout(400);
      const buf = await page.screenshot({ type: "png", fullPage: false });
      return [
        { type: "text", text: "right_clicked" },
        { type: "image", source: { type: "base64", media_type: "image/png", data: buf.toString("base64") } },
      ];
    }

    case "middle_click": {
      const [x, y] = action.coordinate;
      await page.mouse.click(x, y, { button: "middle" });
      await page.waitForTimeout(400);
      const buf = await page.screenshot({ type: "png", fullPage: false });
      return [
        { type: "text", text: "middle_clicked" },
        { type: "image", source: { type: "base64", media_type: "image/png", data: buf.toString("base64") } },
      ];
    }

    case "double_click": {
      const [x, y] = action.coordinate;
      await page.mouse.dblclick(x, y);
      await page.waitForTimeout(400);
      const buf = await page.screenshot({ type: "png", fullPage: false });
      return [
        { type: "text", text: "double_clicked" },
        { type: "image", source: { type: "base64", media_type: "image/png", data: buf.toString("base64") } },
      ];
    }

    case "mouse_move": {
      const [x, y] = action.coordinate;
      await page.mouse.move(x, y);
      await page.waitForTimeout(150);
      const buf = await page.screenshot({ type: "png", fullPage: false });
      return [
        { type: "text", text: "moved" },
        { type: "image", source: { type: "base64", media_type: "image/png", data: buf.toString("base64") } },
      ];
    }

    case "left_click_drag": {
      const [sx, sy] = action.startCoordinate;
      const [ex, ey] = action.coordinate;
      await page.mouse.move(sx, sy);
      await page.mouse.down();
      await page.mouse.move(ex, ey, { steps: 10 });
      await page.mouse.up();
      await page.waitForTimeout(400);
      const buf = await page.screenshot({ type: "png", fullPage: false });
      return [
        { type: "text", text: "dragged" },
        { type: "image", source: { type: "base64", media_type: "image/png", data: buf.toString("base64") } },
      ];
    }

    case "type": {
      await page.keyboard.type(action.text, { delay: 40 });
      await page.waitForTimeout(300);
      const buf = await page.screenshot({ type: "png", fullPage: false });
      return [
        { type: "text", text: "typed" },
        { type: "image", source: { type: "base64", media_type: "image/png", data: buf.toString("base64") } },
      ];
    }

    case "key": {
      await page.keyboard.press(action.text);
      await page.waitForTimeout(300);
      const buf = await page.screenshot({ type: "png", fullPage: false });
      return [
        { type: "text", text: "key_pressed" },
        { type: "image", source: { type: "base64", media_type: "image/png", data: buf.toString("base64") } },
      ];
    }

    case "scroll": {
      const [x, y] = action.coordinate;
      const delta = action.amount * 100;
      const dx = action.direction === "left" ? -delta : action.direction === "right" ? delta : 0;
      const dy = action.direction === "up" ? -delta : action.direction === "down" ? delta : 0;
      await page.mouse.move(x, y);
      await page.mouse.wheel(dx, dy);
      await page.waitForTimeout(300);
      const buf = await page.screenshot({ type: "png", fullPage: false });
      return [
        { type: "text", text: "scrolled" },
        { type: "image", source: { type: "base64", media_type: "image/png", data: buf.toString("base64") } },
      ];
    }

    case "cursor_position": {
      return [{ type: "text", text: `cursor at (unknown)` }];
    }

    default:
      return [{ type: "text", text: "unknown_action" }];
  }
}

// ---------------------------------------------------------------------------
// Computer use tool definition — computer_20251124
// ---------------------------------------------------------------------------

const computerTool: Anthropic.Messages.BetaTool = {
  type: "computer_20251124",
  name: "computer",
  display_width_px: VIEWPORT_WIDTH,
  display_height_px: VIEWPORT_HEIGHT,
  display_number: 1,
};

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are an expert browser automation agent. Your job is to sign into Pro Football Focus (PFF) and download specific CSV data exports for college (NCAA) players.

## Credentials
- Email: ${PFF_EMAIL}
- Password: ${PFF_PASSWORD}
- Target season: ${PFF_SEASON}

## Starting URL
https://premium.pff.com/ncaa/positions/${PFF_SEASON}/REGPO

This is the "2025 NCAA Position Reports" index page. It has sections like Passing Reports, Receiving Reports, Rushing Reports, Blocking Reports, Defense Reports, Special Teams Reports, and Signature Stats. Each report card has position buttons (QB, WR, ALL, etc.) that navigate to a stats table page where you can export a CSV.

## Sign-in
If you are redirected to a login page, sign in with the credentials above, then navigate back to the starting URL.

## Your task — download these 10 CSVs IN ORDER

For each report below:
1. Go back to https://premium.pff.com/ncaa/positions/${PFF_SEASON}/REGPO
2. Scroll to find the report card
3. Click the specified position button on that card
4. On the stats table page that loads, find the Export/Download CSV button and click it
5. Wait for the download to complete, then repeat for the next report

### Downloads (report name → button to click):
1. **Passing Grades** → click **QB**
2. **Receiving Grades** → click **ALL**
3. **Rushing Grades** → click **ALL**
4. **Blocking Grades** → click **ALL**
5. **Pass Blocking** → click **ALL**
6. **Run Blocking** → click **ALL**
7. **Coverage Grades** → click **ALL**
8. **Pass Rushing Productivity** → click **ALL**
9. **Run Stop %** → click **ALL**
10. **Special Teams Grades** → click **ST**

## Finding the Export button
On each stats table page, look for:
- A button or link labeled "Export", "CSV", "Download", or a download icon (↓)
- It is usually in the top-right area of the stats table
- Click it to trigger the CSV download

## Important rules
- Always return to the positions index page between downloads
- Do NOT download the same report twice
- If a report or export button is not found, skip it and move on
- When all 10 downloads are attempted, output exactly: ALL_DOWNLOADS_COMPLETE`;

// ---------------------------------------------------------------------------
// Target reports to download
// ---------------------------------------------------------------------------

// URL slugs derived from the confirmed pattern:
// https://premium.pff.com/ncaa/positions/2025/REGPO/offense-pass-blocking?posi=OL
const TARGET_REPORTS = [
  { name: "Passing Grades",       slug: "offense-passing",                  posi: "QB"  },
  { name: "Receiving Grades",     slug: "offense-receiving",                posi: "ALL" },
  { name: "Rushing Grades",       slug: "offense-rushing",                  posi: "ALL" },
  { name: "Blocking Grades",      slug: "offense-blocking",                 posi: "ALL" },
  { name: "Pass Blocking",        slug: "offense-pass-blocking",            posi: "ALL" },
  { name: "Run Blocking",         slug: "offense-run-blocking",             posi: "ALL" },
  { name: "Defense Grades",       slug: "defense-grades",                   posi: "ALL" },
  { name: "Pass Rush Grades",     slug: "defense-pass-rush",                posi: "ALL" },
  { name: "Run Defense Grades",   slug: "defense-run-defense",              posi: "ALL" },
  { name: "Coverage Grades",      slug: "defense-coverage",                 posi: "ALL" },
  { name: "Special Teams Grades", slug: "special-teams",                    posi: "ST"  },
];

// ---------------------------------------------------------------------------
// Helper: sign in via Playwright if redirected to login page
// ---------------------------------------------------------------------------

async function ensureLoggedIn(page: Page): Promise<void> {
  const url = page.url();
  if (!url.includes("pff.com/login") && !url.includes("auth")) return;

  console.log("  Logging in...");
  // Fill email
  await page.fill('input[type="email"], input[name="email"], input[placeholder*="email" i]', PFF_EMAIL!);
  await page.waitForTimeout(400);
  // Fill password
  await page.fill('input[type="password"]', PFF_PASSWORD!);
  await page.waitForTimeout(400);
  // Submit
  await page.keyboard.press("Enter");
  await page.waitForTimeout(3000);
  console.log("  Logged in, current URL:", page.url());
}

// ---------------------------------------------------------------------------
// Helper: use computer use to find and click export button on stats page
// ---------------------------------------------------------------------------

async function clickExportButton(page: Page): Promise<boolean> {
  // Try Playwright selectors first (fast path)
  const exportSelectors = [
    'button:has-text("Export")',
    'button:has-text("CSV")',
    'a:has-text("Export")',
    'a:has-text("CSV")',
    '[aria-label*="export" i]',
    '[aria-label*="download" i]',
    '[title*="export" i]',
    '[class*="export" i]',
    '[class*="download" i]',
  ];

  for (const sel of exportSelectors) {
    try {
      const el = await page.$(sel);
      if (el) {
        console.log(`  Found export button via selector: ${sel}`);
        await el.click();
        return true;
      }
    } catch { /* try next */ }
  }

  // Fall back to computer use
  console.log("  Export button not found by selector — using computer use...");
  const buf = await page.screenshot({ type: "png", fullPage: false });
  const b64 = buf.toString("base64");

  const messages: Anthropic.Messages.BetaMessageParam[] = [{
    role: "user",
    content: [
      { type: "text", text: 'You are on a PFF stats table page. Find the Export or Download CSV button (usually top-right of the table) and click it. If you cannot find it, reply with text "EXPORT_NOT_FOUND".' },
      { type: "image", source: { type: "base64", media_type: "image/png", data: b64 } },
    ],
  }];

  let found = false;
  for (let turn = 0; turn < 8; turn++) {
    let response: Anthropic.Messages.BetaMessage | undefined;
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        response = await client.beta.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 1024,
          tools: [computerTool],
          messages,
          betas: ["computer-use-2025-11-24"],
        });
        break;
      } catch (err: unknown) {
        const status = (err as { status?: number }).status;
        const headers = (err as { headers?: Record<string, string> }).headers;
        if ((status === 529 || status === 429) && attempt < 5) {
          const retryAfter = headers?.["retry-after"];
          const wait = retryAfter ? parseInt(retryAfter) * 1000 : attempt * 20000;
          console.log(`  API ${status === 429 ? "rate limited" : "overloaded"}, waiting ${wait / 1000}s...`);
          await page.waitForTimeout(wait);
        } else { console.error("API error:", err); return false; }
      }
    }
    if (!response) return false;

    messages.push({ role: "assistant", content: response.content });
    const toolResults: Anthropic.Messages.BetaToolResultBlockParam[] = [];

    for (const block of response.content) {
      if (block.type === "text") {
        console.log(`  [Claude] ${block.text}`);
        if (block.text.includes("EXPORT_NOT_FOUND")) return false;
        if (block.text.toLowerCase().includes("clicked") || block.text.toLowerCase().includes("export")) found = true;
      } else if (block.type === "tool_use" && block.name === "computer") {
        const input = block.input as ComputerAction;
        console.log(`  [Action] ${input.action}`);
        const resultContent = await executeAction(page, input).catch((e) => [{ type: "text" as const, text: String(e) }]);
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: resultContent });
        if (input.action === "left_click") { found = true; }
      }
    }

    if (toolResults.length > 0) messages.push({ role: "user", content: toolResults });
    else break;
  }

  return found;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const CHROMIUM_PATH =
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
    `${process.env.HOME}/.cache/ms-playwright/chromium-1194/chrome-linux/chrome`;
  const executableExists = fs.existsSync(CHROMIUM_PATH);

  console.log("Launching browser...");
  const browser = await chromium.launch({
    headless: false,
    executablePath: executableExists ? CHROMIUM_PATH : undefined,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    slowMo: 50,
  });
  const context = await browser.newContext({
    viewport: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT },
    acceptDownloads: true,
  });
  const page = await context.newPage();

  // Track downloads
  context.on("download", async (download: Download) => {
    const name = download.suggestedFilename();
    await download.saveAs(path.join(downloadDir, name));
    console.log(`  Downloaded: ${name}`);
  });

  const POSITIONS_URL = `https://premium.pff.com/ncaa/positions/${PFF_SEASON}/REGPO`;
  const INDEX_URL = POSITIONS_URL; // REGPO = Regular Season

  // Step 1: Load positions page, handle login
  console.log(`\nNavigating to ${INDEX_URL}...`);
  await page.goto(INDEX_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2000);
  await ensureLoggedIn(page);

  // If login redirected us away, go back
  if (!page.url().includes("/positions/")) {
    await page.goto(INDEX_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2000);
  }

  // Step 2: Download each target report using direct URLs
  let downloaded = 0;
  for (const { name, slug, posi } of TARGET_REPORTS) {
    console.log(`\n[${downloaded + 1}/${TARGET_REPORTS.length}] ${name} (${posi})...`);

    const reportUrl = `${POSITIONS_URL}/${slug}?posi=${posi}`;
    console.log(`  Navigating to: ${reportUrl}`);
    try {
      await page.goto(reportUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(2500);
      await ensureLoggedIn(page);
      await page.waitForTimeout(1500);
    } catch (err) {
      console.log(`  Navigation failed: ${err} — skipping`);
      continue;
    }

    // Click export button
    const clicked = await clickExportButton(page);
    if (clicked) {
      console.log(`  Export triggered — waiting for download...`);
      await page.waitForTimeout(3000);
      downloaded++;
    } else {
      console.log(`  Could not find export button — skipping`);
    }
  }

  console.log(`\nFinished: ${downloaded}/${TARGET_REPORTS.length} reports downloaded`);
  await page.waitForTimeout(2000);
  await browser.close();

  const files = fs.readdirSync(downloadDir);
  console.log(`\nFiles saved to ${downloadDir}:`);
  for (const f of files) {
    const size = fs.statSync(path.join(downloadDir, f)).size;
    console.log(`  ${f} (${(size / 1024).toFixed(1)} KB)`);
  }
  console.log(`\nNext step: npm run pff:import -- --dir "${downloadDir}"`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
