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
Navigate directly to: https://premium.pff.com/ncaa/players/${PFF_SEASON}/AS
This is the PFF Premium Stats page for ALL college players in ${PFF_SEASON}.
If it redirects to a login page, sign in and then go back to that URL.

## Your task
Download each of the following CSV exports IN ORDER. After each download completes, wait for the file to finish before proceeding.

### Required CSV exports (download all that are available):
1. **Player Grades** — overall grades for all players, all positions. Set position filter to "All", season to ${PFF_SEASON}, then click Export/Download CSV.
2. **Passing Stats** — QB passing grades and stats (position: QB)
3. **Rushing Stats** — RB/QB rushing grades (position: All or RB)
4. **Receiving Stats** — WR/TE/RB receiving grades (position: All)
5. **Blocking Grades** — OL and TE pass block + run block grades
6. **Pass Rush Grades** — DL and LB pass rush grades and pressures
7. **Run Defense Grades** — DL and LB run defense grades
8. **Coverage Grades** — DB and LB coverage grades
9. **Route Tree Stats** — WR/TE/RB targets broken out by route type
10. **Snap Counts / Alignment Snaps** — shows slot vs wide vs inline snaps per player

## Navigation approach
- The PFF premium stats are organized in tabs: Offense / Defense / Special Teams
- Each tab has sub-categories (Passing, Rushing, Receiving, Blocking, etc.)
- Look for "Export" or "CSV" or a download icon near the stats table
- For each export, ensure the season dropdown shows ${PFF_SEASON} and position is set appropriately
- After clicking Export, wait for the download to complete before moving on

## Important rules
- Do NOT download the same category twice
- If a particular export is not available, skip it and move to the next
- When all downloads are complete (or you've attempted all 10), output exactly: ALL_DOWNLOADS_COMPLETE`;

// ---------------------------------------------------------------------------
// Main agentic loop
// ---------------------------------------------------------------------------

async function main() {
  // Use existing Chromium binary if Playwright-bundled one isn't available
  const CHROMIUM_PATH =
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
    `${process.env.HOME}/.cache/ms-playwright/chromium-1194/chrome-linux/chrome`;
  const executableExists = fs.existsSync(CHROMIUM_PATH);

  console.log("Launching browser...");
  console.log(`  Chromium: ${executableExists ? CHROMIUM_PATH : "playwright default"}`);

  const browser = await chromium.launch({
    headless: false, // visible browser so you can see what's happening
    executablePath: executableExists ? CHROMIUM_PATH : undefined,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    slowMo: 50,
  });
  const context = await browser.newContext({
    viewport: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT },
    acceptDownloads: true,
  });
  const page = await context.newPage();

  // Handle file downloads automatically
  context.on("download", async (download: Download) => {
    const suggestedName = download.suggestedFilename();
    const savePath = path.join(downloadDir, suggestedName);
    await download.saveAs(savePath);
    console.log(`  Downloaded: ${suggestedName}`);
  });

  // Navigate to PFF NCAA stats page
  console.log(`\nNavigating to PFF NCAA stats (${PFF_SEASON})...`);
  await page.goto(`https://premium.pff.com/ncaa/players/${PFF_SEASON}/AS`, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await page.waitForTimeout(2000);

  // -------------------------------------------------------------------------
  // Take initial screenshot and build first user message
  // -------------------------------------------------------------------------
  const initBuf = await page.screenshot({ type: "png", fullPage: false });
  const initB64 = initBuf.toString("base64");

  const messages: Anthropic.Messages.BetaMessageParam[] = [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: "Here is the current state of the browser. Please sign into PFF if needed, then navigate to the NCAA college player stats and download all the required CSV exports as described in your instructions.",
        },
        {
          type: "image",
          source: {
            type: "base64",
            media_type: "image/png",
            data: initB64,
          },
        },
      ],
    },
  ];

  let turnCount = 0;
  let done = false;

  console.log("\nStarting computer use loop...\n");

  while (!done && turnCount < MAX_TURNS) {
    turnCount++;

    // Call Claude
    let response: Anthropic.Messages.BetaMessage;
    try {
      response = await client.beta.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools: [computerTool],
        messages,
        betas: ["computer-use-2025-11-24"],
      });
    } catch (err: unknown) {
      console.error("Anthropic API error:", err);
      break;
    }

    // Add assistant response to conversation
    messages.push({ role: "assistant", content: response.content });

    // Process each content block from Claude's response
    const toolResults: Anthropic.Messages.BetaToolResultBlockParam[] = [];

    for (const block of response.content) {
      if (block.type === "text") {
        console.log(`[Claude] ${block.text}`);
        if (block.text.includes("ALL_DOWNLOADS_COMPLETE")) {
          console.log("\nAll downloads complete!");
          done = true;
        }
        continue;
      }

      if (block.type === "tool_use" && block.name === "computer") {
        const input = block.input as ComputerAction;
        const coordStr = "coordinate" in input ? ` @ (${(input as { coordinate: [number, number] }).coordinate[0]}, ${(input as { coordinate: [number, number] }).coordinate[1]})` : "";
        const textStr = "text" in input ? ` "${(input as { text: string }).text}"` : "";
        console.log(`[Action] ${input.action}${coordStr}${textStr}`);

        let resultContent: Anthropic.Messages.BetaToolResultBlockParam["content"];
        try {
          resultContent = await executeAction(page, input);
        } catch (err: unknown) {
          resultContent = [{ type: "text", text: `Error executing action: ${String(err)}` }];
        }

        // IMPORTANT: use block.id (the actual tool_use_id from Claude's response)
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: resultContent,
        });
      }
    }

    // Send tool results back to Claude if any were generated
    if (toolResults.length > 0) {
      messages.push({ role: "user", content: toolResults });
    } else if (response.stop_reason === "end_turn") {
      // Claude finished without requesting any tool use
      console.log("\nClaude finished without tool use — stopping loop.");
      break;
    }
  }

  if (turnCount >= MAX_TURNS) {
    console.warn(`\nReached maximum turn limit (${MAX_TURNS}). Stopping.`);
  }

  // Give downloads a moment to finish writing
  await page.waitForTimeout(3000);
  await browser.close();

  // List what was downloaded
  const files = fs.readdirSync(downloadDir);
  if (files.length === 0) {
    console.log("\nNo files were downloaded.");
  } else {
    console.log(`\nFiles saved to ${downloadDir}:`);
    for (const f of files) {
      const size = fs.statSync(path.join(downloadDir, f)).size;
      console.log(`  ${f} (${(size / 1024).toFixed(1)} KB)`);
    }
  }

  console.log(`\nNext step: npm run pff:import -- --dir "${downloadDir}"`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
