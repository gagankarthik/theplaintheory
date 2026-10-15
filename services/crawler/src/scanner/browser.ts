import puppeteer, { type Browser } from "puppeteer";

/**
 * Flags required for Chromium inside containers (Fargate has no user namespaces and a small /dev/shm).
 *
 * --no-sandbox: Chromium's sandbox needs unprivileged user namespaces or a setuid helper, and Fargate
 * grants neither (no seccomp/namespace tuning, and every capability is dropped in crawler-stack.ts). The
 * renderer therefore runs unsandboxed, so the container is the boundary instead: non-root user, read-only
 * root filesystem with only /tmp writable, no Linux capabilities, a fresh incognito context per crawl, no
 * inbound access, a least-privilege task role, and the network guard on every browser request.
 *
 * Writes: Puppeteer creates the throwaway profile (user data dir) under os.tmpdir(), i.e. TMPDIR=/tmp,
 * and --disable-dev-shm-usage moves shared memory there too; HOME and the XDG dirs point under /tmp
 * (Dockerfile), so nothing else needs to be writable.
 */
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
