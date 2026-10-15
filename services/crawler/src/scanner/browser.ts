import puppeteer, { type Browser } from "puppeteer";

/** Flags required for Chromium inside containers (Fargate has no user namespaces and a small /dev/shm). */
const CONTAINER_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-extensions",
  "--disable-background-networking",
  "--disable-component-update",
  "--disable-sync",
  "--mute-audio",
  "--hide-scrollbars",
  "--window-size=1366,900",
];

export async function launchBrowser(): Promise<Browser> {
  return puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: CONTAINER_ARGS,
    defaultViewport: { width: 1366, height: 900 },
    protocolTimeout: 120_000,
  });
}

/** Desktop Chrome UA without the "HeadlessChrome" marker, so sites serve their normal tag set. */
export async function realisticUserAgent(browser: Browser): Promise<string> {
  const ua = await browser.userAgent();
  return ua.replace(/HeadlessChrome/g, "Chrome").replace(/\s*Headless\s*/g, " ");
}
