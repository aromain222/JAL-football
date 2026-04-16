import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import os from "node:os";
import path from "node:path";
import { chromium, type Locator, type Page } from "playwright";

const PFF_EMAIL = process.env.PFF_EMAIL;
const PFF_PASSWORD = process.env.PFF_PASSWORD;
const PFF_SEASON = process.env.PFF_SEASON ?? "2025";
const MANUAL_ONLY = process.argv.includes("--manual");
const TIMEOUT_MS = 10 * 60 * 1000;

function getCookie(name: string, cookies: Awaited<ReturnType<ReturnType<typeof chromium.launchPersistentContext>["cookies"]>>) {
  return cookies.find((cookie) => cookie.name === name) ?? null;
}

async function getSessionState(page: Page): Promise<{
  signedIn: boolean;
  premium: boolean;
  url: string;
}> {
  const [cookies, signInButton, unlockBanner, userMenu] = await Promise.all([
    page.context().cookies(),
    page.getByRole("button", { name: /sign in/i }).isVisible().catch(() => false),
    page.getByText(/unlock pff\+/i).isVisible().catch(() => false),
    page.getByRole("button", { name: /user account menu/i }).isVisible().catch(() => false),
  ]);

  const premiumCookie = getCookie("_premium_key", cookies);
  const decoded = premiumCookie ? decodeURIComponent(premiumCookie.value) : "";

  const signedIn =
    userMenu ||
    (!signInButton && (/signedIn/i.test(decoded) ? !/signedIn[^a-z0-9]*false/i.test(decoded) : false));
  const premium =
    !unlockBanner &&
    (/premium/i.test(decoded) ? !/premium[^a-z0-9]*false/i.test(decoded) : signedIn);

  return {
    signedIn,
    premium,
    url: page.url(),
  };
}

async function fillLogin(page: Page) {
  if (!PFF_EMAIL || !PFF_PASSWORD) {
    console.log("PFF_EMAIL / PFF_PASSWORD not set. Manual sign-in required.");
    return;
  }

  const findFirstVisible = async (selectors: string[]): Promise<Locator | null> => {
    for (const selector of selectors) {
      const locator = page.locator(selector).first();
      if (await locator.isVisible().catch(() => false)) return locator;
    }
    return null;
  };

  await page.waitForSelector('input[type="password"]', { timeout: 10000 });

  const emailInput = await findFirstVisible([
    'input[type="email"]',
    'input[name="email"]',
    'input[name="username"]',
    'input[placeholder*="Email"]',
    'input[placeholder*="email"]',
  ]);
  const passwordInput = await findFirstVisible(['input[type="password"]']);

  if (!emailInput || !passwordInput) {
    throw new Error("PFF login inputs not found");
  }

  await emailInput.fill("");
  await emailInput.fill(PFF_EMAIL);
  await passwordInput.fill("");
  await passwordInput.fill(PFF_PASSWORD);
}

async function waitForPremium(page: Page) {
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    await page.waitForTimeout(2000);
    const state = await getSessionState(page);
    if (state.signedIn && state.premium) return state;
  }

  return getSessionState(page);
}

async function main() {
  const userDataDir = path.join(os.homedir(), ".pff-browser-session");
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    acceptDownloads: false,
  });
  const page = context.pages()[0] ?? (await context.newPage());

  await page.goto(`https://premium.pff.com/ncaa/players/${PFF_SEASON}/REGPO`, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await page.waitForTimeout(2500);

  let state = await getSessionState(page);
  console.log(`Current PFF session: signedIn=${state.signedIn} premium=${state.premium} url=${state.url}`);

  if (!state.signedIn || !state.premium) {
    await page.goto("https://auth.pff.com/", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2000);

    if (!MANUAL_ONLY) {
      await fillLogin(page);
      console.log("PFF credentials filled. Complete reCAPTCHA and click SIGN IN in the opened browser.");
    }

    console.log("Waiting for a premium-authenticated PFF session. Complete login in the opened browser if needed.");
    state = await waitForPremium(page);
  }

  console.log(`Final PFF session: signedIn=${state.signedIn} premium=${state.premium} url=${state.url}`);

  if (!state.signedIn || !state.premium) {
    console.error("PFF session is still not premium-authenticated. Grade scraping will not work from this state.");
    process.exitCode = 1;
    return;
  }

  await page.goto(`https://premium.pff.com/ncaa/players/${PFF_SEASON}/REGPO`, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await page.waitForTimeout(1500);
  console.log("Premium NCAA player search is ready in the persistent browser session.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
