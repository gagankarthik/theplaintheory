# Vite + React example

A small app using `@plaintheory/react` against the local Plain Theory server.

1. In the repo root: `npm run dev` (port 3000), sign up, and add a site with the domain `localhost`. Copy its site key into `VITE_PLAIN_SITE_KEY` in `.env.local` here.
2. Here: `npm i` then `npm run dev`, and open http://localhost:5173.

The packages are resolved from `../../packages` by the aliases in `vite.config.ts`, so nothing needs publishing. Consent requests from `localhost:5173` are accepted because the demo site's domain is `localhost`.
