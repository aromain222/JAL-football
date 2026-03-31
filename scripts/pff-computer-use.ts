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
 *   PFF_SEASON=2025   (default: current year)
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
const MAX_TURNS = 120; // safety limit for the agentic loop

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
// Types
// ---------------------------------------------------------------------------

type ComputerAction =
  | { action: "screenshot" }
  | { action: "click"; coordinate: [number, number] }
  | { action: "double_click"; coordinate: [number, number] }
  | { action: "right_click"; coordinate: [number, number] }
  | { action: "mouse_move"; coordinate: [number, number] }
  | { action: "type"; text: string }
  | { action: "key"; text: string }
  | { action: "scroll"; coordinate: [number, number]; direction: "up" | "down" | "left" | "right"; amount: number };

// ---------------------------------------------------------------------------
// Playwright action executor
// ---------------------------------------------------------------------------

async function executeAction(
  page: Page,
  action: ComputerAction
): Promise<string> {
  switch (action.action) {
    case "screenshot": {
      const buf = await page.screenshot({ type: "png", fullPage: false });
      return buf.toString("base64");
    }

    case "click": {
      const [x, y] = action.coordinate;
      await page.mouse.click(x, y);
      await page.waitForTimeout(300);
      return "clicked";
    }

    case "double_click": {
      const [x, y] = action.coordinate;
      await page.mouse.dblclick(x, y);
      await page.waitForTimeout(300);
      return "double_clicked";
    }

    case "right_click": {
      const [x, y] = action.coordinate;
      await page.mouse.click(x, y, { button: "right" });
      await page.waitForTimeout(300);
      return "right_clicked";
    }

    case "mouse_move": {
      const [x, y] = action.coordinate;
      await page.mouse.move(x, y);
      return "moved";
    }

    case "type": {
      await page.keyboard.type(action.text, { delay: 30 });
      await page.waitForTimeout(200);
      return "typed";
    }

    case "key": {
      await page.keyboard.press(action.text);
      await page.waitForTimeout(200);
      return "key_pressed";
    }

    case "scroll": {
      const [x, y] = action.coordinate;
      const delta = action.amount * 100;
      const dx = action.direction === "left" ? -delta : action.direction === "right" ? delta : 0;
      const dy = action.direction === "up" ? -delta : action.direction === "down" ? delta : 0;
      await page.mouse.move(x, y);
      await page.mouse.wheel(dx, dy);
      await page.waitForTimeout(300);
      return "scrolled";
    }

    default:
      return "unknown_action";
  }
}

// ---------------------------------------------------------------------------
// Computer use tool definition
// ---------------------------------------------------------------------------

const computerTool: Anthropic.Messages.BetaTool = {
  type: "computer_20241022",
  name: "computer",
  display_width_px: VIEWPORT_WIDTH,
  display_height_px: VIEWPORT_HEIGHT,
  display_number: 1,
};

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are an expert browser automation agent. Your job is to sign into Pro Football Focus (PFF) and download specific CSV data exports.

## Credentials
- Email: ${PFF_EMAIL}
- Password: ${PFF_PASSWORD}
- Target season: ${PFF_SEASON}

## Your task
1. Navigate to https://www.pff.com and sign in using the credentials above.
2. After signing in, navigate to the Stats/Data section (often under "Premium Stats" or "Player Stats").
3. Download each of the following CSV exports IN ORDER. After each download completes, wait for the file to finish downloading before proceeding to the next.

### Required CSV exports (download all that are available):
1. **Season Player Grades** — overall grades for all players, all positions (look for "Player Grades" export)
2. **Passing Stats** — QB passing grades and stats
3. **Rushing Stats** — RB/QB rushing grades and stats
4. **Receiving Stats** — WR/TE/RB receiving grades and stats
5. **Blocking Grades** — OL and TE pass block + run block grades
6. **Pass Rush Grades** — DL and LB pass rush grades and pressures
7. **Run Defense Grades** — DL and LB run defense grades
8. **Coverage Grades** — DB and LB coverage grades
9. **Route Tree Stats** — WR/TE/RB targets and receptions broken out by route type (slant, hitch, out, curl, dig, post, corner, go, screen, crosser) — look for "Routes" or "Route Tree" export
10. **Snap Counts by Alignment** — the alignment/position snap counts export showing WHERE players lined up on each snap:
    - For WR/TE: slot vs wide vs inline vs backfield snaps
    - For RB: offset/inline/slot/wide snaps
    - For DL/Edge: left end vs right end vs interior snaps
    - For LB: in-box vs off-ball snaps
    - For DB/Safety: free safety vs strong safety vs slot CB vs outside CB vs in-box vs deep snaps
    This is often labeled "Snap Counts" or "Alignment Snaps" in the PFF export menu.

## Important guidelines
- For each export, make sure the season is set to ${PFF_SEASON} before downloading.
- If a filter panel appears, set position to "All" (unless downloading a position-specific export).
- Look for a "Download" or "Export CSV" button near each stats table.
- If a particular export is not available or requires a different navigation path, skip it and proceed to the next.
- Do NOT download the same file twice.
- When all downloads are complete, output the text: ALL_DOWNLOADS_COMPLETE

## Navigation tips
- PFF premium stats are usually at pff.com/stats/player or similar.
- The export button often looks like a download icon or says "Export" / "CSV".
- You may need to click through tabs (Offense/Defense/Special Teams) to find specific exports.
- Some exports are behind a "Customize" or "Advanced" filter panel.`;

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
    headless: true,
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

  // Navigate to PFF
  await page.goto("https://www.pff.com", { waitUntil: "domcontentloaded" });

  // -------------------------------------------------------------------------
  // Build initial messages
  // -------------------------------------------------------------------------
  const messages: Anthropic.Messages.BetaMessageParam[] = [
    {
      role: "user",
      content: "Please sign into PFF and download all the required CSV exports as described in your instructions. Start by taking a screenshot to see the current state of the browser.",
    },
  ];

  let turnCount = 0;
  let done = false;

  console.log("\nStarting computer use loop...\n");

  while (!done && turnCount < MAX_TURNS) {
    turnCount++;

    // Take a screenshot before each turn to give Claude current state
    const screenshotBuf = await page.screenshot({ type: "png", fullPage: false });
    const screenshotB64 = screenshotBuf.toString("base64");

    // Append screenshot as the latest tool result (or as the first user message)
    if (turnCount > 1) {
      messages.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: `screenshot_${turnCount}`,
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/png",
                  data: screenshotB64,
                },
              },
            ],
          },
        ],
      });
    }

    // Call Claude
    let response: Anthropic.Messages.BetaMessage;
    try {
      response = await client.beta.messages.create({
        model: "claude-opus-4-6",
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools: [computerTool],
        messages,
        betas: ["computer-use-2024-10-22"],
      });
    } catch (err: unknown) {
      console.error("Anthropic API error:", err);
      break;
    }

    // Add assistant response to messages
    messages.push({ role: "assistant", content: response.content });

    // Process each content block
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
        console.log(`[Action] ${input.action}${
          "coordinate" in input ? ` @ (${input.coordinate[0]}, ${input.coordinate[1]})` : ""
        }${"text" in input ? ` "${input.text}"` : ""}`);

        let resultContent: Anthropic.Messages.BetaToolResultBlockParam["content"];

        try {
          if (input.action === "screenshot") {
            const b64 = await executeAction(page, input);
            resultContent = [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/png",
                  data: b64,
                },
              },
            ];
          } else {
            const result = await executeAction(page, input);
            // After non-screenshot actions, take a fresh screenshot
            const freshBuf = await page.screenshot({ type: "png", fullPage: false });
            resultContent = [
              { type: "text", text: result },
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/png",
                  data: freshBuf.toString("base64"),
                },
              },
            ];
          }
        } catch (err: unknown) {
          resultContent = [{ type: "text", text: `Error executing action: ${String(err)}` }];
        }

        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: resultContent,
        });
      }
    }

    // If there were tool uses, add their results and continue
    if (toolResults.length > 0) {
      messages.push({ role: "user", content: toolResults });
    }

    // If stop_reason is end_turn with no tool use, check if we're done
    if (response.stop_reason === "end_turn" && toolResults.length === 0) {
      console.log("\nClaude finished without tool use — stopping loop.");
      break;
    }
  }

  if (turnCount >= MAX_TURNS) {
    console.warn(`\nReached maximum turn limit (${MAX_TURNS}). Stopping.`);
  }

  // Give downloads a moment to finish
  await page.waitForTimeout(2000);
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
