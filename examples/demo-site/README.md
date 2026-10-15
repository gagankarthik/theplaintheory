# Demo site (test fixture)

A five-page storefront used to exercise Plain Theory's SDK and the headless crawler
(`services/crawler`) locally. Every tracker is a local mock in `trackers/` that only sets the cookie and
storage names the real vendor uses; nothing contacts a vendor.

```bash
npm run sdk:build                                   # builds public/sdk/plain-consent.js
PLAIN_SITE_KEY=pk_... node examples/demo-site/server.mjs   # http://localhost:4000
```

`PLAIN_SITE_KEY` is the site key from the dashboard's Install page (create a site with domain
`localhost:4000`); `PLAIN_API` defaults to `http://localhost:3000/api/v1`. `PORT` moves the server.

## What it exercises

| Behaviour | Where |
| --- | --- |
| HttpOnly first-party cookie only visible through CDP (`hr_session`), plus `localization` | `server.mjs`, every HTML response |
| Cookie set on one page only (`cart`) | `server.mjs`, `/cart.html` |
| Held `<script type="text/plain" data-consent="…" src="…">` tags | `<head>` of each page |
| Held iframe (`data-consent` + `data-plain-src`) | `journal.html` |
| Tag injected at runtime (held only if the site's tracker list has a matching pattern) | inline script on `index.html` |
| `robots.txt` disallow the crawler must honour | `/checkout` |
| Internal links for a depth-1 crawl | header navigation |

## Expected results

- **Before any decision:** none of the mocks run, and only `hr_session`, `localization` (and `cart` on the basket) exist.
- **After "Accept all":** the mocks run and set `_ga`, `_hjSessionUser_*`, `_clck`, `_fbp`, `_ttp` and `intercom.*`; the YouTube embed loads.
- **Headless scan** (dashboard → Trackers → Scan, with `CRAWLER_MODE=local` and the crawler worker running):
  5 pages crawled, `/checkout` skipped by robots.txt, `hr_session` reported as HttpOnly, nothing in
  "loaded before consent". The runtime-injected tag still runs and its `_demo_dyn_ad` cookie appears in
  "To review" (unknown, first party) until a tracker with pattern `mock-dynamic-marketing` (category
  marketing) is approved and published.
