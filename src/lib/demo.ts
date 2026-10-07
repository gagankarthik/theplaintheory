/**
 * The live SDK demo (/demo) runs against a real site in the store, configured per environment.
 * Create a site for it in the dashboard (domain = this deployment's host), then set its key here.
 * Without one, the demo page 404s and every link to it is hidden, so nothing points at a dead page.
 */
export const DEMO_SITE_KEY = process.env.NEXT_PUBLIC_DEMO_SITE_KEY || undefined;
export const demoEnabled = Boolean(DEMO_SITE_KEY);
