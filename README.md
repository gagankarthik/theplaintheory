Minimalist Habit Tracker — Full Plan (Next.js + Supabase, SSR)
0) Goal & Principles

Goal: a web-first, super-minimal habit tracker where users create a few habits, check them off daily, and (optionally) share a quiet streak + 1 accountability buddy.

Principles: privacy-first • no clutter • monochrome UI • zero “casino” gamification • fast and offline-friendly later.

1) MVP Scope (what ships first)

Auth: Passwordless (magic link) via Supabase Auth.

Habits: Create, list, and delete. Emoji-first, short titles (≤ 40 chars).

Check-ins: One-tap weekly strip; today + last 6 days visible.

Streaks: Show 🔥 count (consecutive days). If broken → “restart.”

Buddy (read-only): Add one buddy (optional) who can view ✔/✖ only.

Share card (public, optional): Read-only streak card for a single habit.

Settings: Display name + emoji avatar. Private by default.

Out of MVP (add later): PWA/offline queue, flexible cadence (x times/week), weekly recap emails, iCal export, push/web notifications.

2) Architecture Overview

Frontend: Next.js (App Router), TypeScript, Tailwind, Framer Motion (tiny).

Backend: Supabase (Postgres + Auth + RLS), Edge Functions for scheduled jobs.

SSR Auth: @supabase/ssr with cookies for server components and route handlers.

Hosting: Vercel (frontend + Next API routes). Supabase project for DB/Auth/Edge.

Analytics/Observability (optional): Vercel Analytics, Sentry.

3) Data Model (Postgres)

Tables

profiles (id PK -> auth.users, display_name, avatar_emoji, created_at)

habits (id, user_id, title, emoji, cadence='daily', is_public, created_at)

checkins (id, habit_id, user_id, day date, created_at) unique (habit_id, day)

buddies (owner_id, buddy_id) unique pair

Indexes

idx_checkins_user_day (user_id, day)

idx_checkins_habit_day (habit_id, day)

idx_habits_user (user_id)

RLS (must)

profiles: user can read/update own row

habits: user can read own + public; insert/update/delete own

checkins: user can read/insert/delete own; buddy can read via subquery

buddies: owner can read/insert/delete their buddy rows

(You already have SQL/RLS from earlier; keep them as source of truth.)

4) API & Server Logic

POST /api/habit → create habit

POST /api/checkin → insert check-in (habit_id, day)

DELETE /api/checkin → remove check-in (habit_id, day)

GET /api/share/[habitId] → public read of habits + last-7-days (only if is_public = true)

POST /logout → sign out

Streak calc: server-side query that counts consecutive days from today backward (can be a Postgres function or computed in a server component for MVP).

Edge Function (later)

weekly_digest: send low-friction recap email (only if opted in). Cron weekly.

5) Next.js Routes (App Router)

/ Landing (already built)

/(auth)/signup, /(auth)/login (magic-link) ✅

/auth/callback (exchange code → session) ✅

/(app)/page or /dashboard (protected) ✅

/new Create Habit (protected) ✅

/habit/[id] Habit detail + weekly strip (protected) ✅

/u/[name]/habit/[id] Public read-only streak card (optional; MVP if time)

/privacy, /terms (static)

Middleware

middleware.ts keeps session fresh and guards app routes (already scaffolded).

6) UI/UX System (Gen-Z minimal)

Palette: White/Black/Very-light gray. One accent via state only.

Type: Inter/Söhne; sizes 16/20/28/40. Tight tracking, big whitespace.

Controls: Large rounded buttons; 120–160ms ease-out transitions.

Microcopy: “nice.” “again.” “restart.” “clean.” (soft, neutral, not preachy)

Dark mode: Default dark, toggle optional.

Accessibility: 4.5:1 contrast; focus rings; labels; aria-pressed on toggle.

7) Dashboard & Interaction Design

Today view: List of habits with weekly strips. Quick-tap to toggle.

Empty state: “No habits yet.” → prominent “Create habit”.

Create flow: Emoji + Title + public toggle. Redirect to habit page.

Habit page: Weekly strip + quiet streak number; delete habit (confirm).

Buddy: “Add buddy” modal by email; both sides must exist on platform; show a tiny “👏” vibe ping (1/day).

Share card: Toggle “Public card” → copy link. Card shows emoji, title, last-7 grid, streak number (no personal data).

8) Security & Privacy Checklist

Enforce RLS for every table (no admin bypass).

SSR server reads always via createServerClient (no anon reads server-side).

Public endpoint returns data only for is_public = true.

Validate payloads in API routes (types, length checks).

Escape/strip user content (titles/emojis are short; still sanitize).

Cookies: HttpOnly, Secure in production.

Auth redirects allowlist: only your domains.

Rate-limiting (basic) for POST routes (Vercel middleware or Supabase Edge).

9) Performance & Reliability

Use Next.js Server Components for data-heavy views (dashboard/habit).

Keep client components small (WeekStrip only).

Cache public share pages with revalidate=60 (if allowed by privacy).

Postgres: keep date type for checkins.day to simplify comparisons.

Minimal N+1 by batching: e.g., get last-7 checkins for all habits with a single query on dashboard (later optimization).

10) Testing Strategy

Unit: util functions (date ranges, streak calculation).

Integration: API routes (/api/habit, /api/checkin) with local supabase/mock.

E2E: Playwright flows: signup → create → check/uncheck → logout; public share page loads; buddy visibility (✔/✖ only).

Accessibility tests: @axe-core/playwright basic rules.

Load sanity: simple k6 or Artillery smoke for API endpoints.

11) Analytics & KPIs (privacy-respecting)

Core KPIs:

Day-1 activation (% users with ≥1 habit and ≥1 check-in)

7-day retention

Median habits/user (target: 3–5)

Share-card creation rate

Buddy attach rate

Event examples: habit_created, checkin_toggled, share_enabled, buddy_added.

(Use Vercel Analytics + lightweight custom events; avoid PII.)

12) Growth Loops

Streak card: organic loop—friends click to view → simple signup.

One-buddy invite during onboarding (copy link, single input).

No spam: soft reminders (weekly digest opt-in later).

13) Rollout Plan & Milestones
Week 0 (Setup)

✅ Supabase project, URL/anon key in .env.local

✅ Tailwind + Framer Motion

✅ SSR auth scaffolding (@supabase/ssr, middleware)

✅ Landing page (done)

Week 1 (Auth + Core Data)

Implement profiles upsert after first login

Ship /new, /habit/[id], /api/habit, /api/checkin (done)

Dashboard today view with list + weekly strips

Basic streak calculation on server

Acceptance: user can create a habit and toggle last-7 on both dashboard & detail; streak updates.

Week 2 (Public Share + Buddy)

/u/[name]/habit/[id] public page (OG image optional)

/api/share/[habitId] returns limited fields (title, emoji, last-7, streak)

Buddy table + flows: add/remove, read-only checkins

Vibe ping (👏) once/day

Acceptance: non-logged visitor can view a public habit’s last-7 + streak; buddy can see ✔/✖ of owner’s habits.

Week 3 (Polish & QA)

Empty/loading/skeleton states; error toasts

Accessibility pass; keyboard nav

E2E tests in CI; Sentry

Performance profiling (largest routes only)

Week 4 (Nice-to-haves)

Edge Function weekly digest (opt-in)

Flexible cadence (3x/week)

iCal export of checkins

14) Deployment

Vercel → add environment variables; set production domain in Supabase Auth (redirects → /auth/callback).

Preview deployments per PR; run Playwright on preview.

Database migrations: store SQL in repo under /supabase/migrations.

15) Public Share Card: Implementation Notes

Route: /u/[name]/habit/[id]

Resolve [name] → profile id

Check habit.user_id = profile.id and is_public = true

Render: emoji, title, weekly grid, streak (no other stats)

OG Image (optional): Next’s /api/og (Satori) or Vercel OG to generate a clean PNG for link previews.

Caching: revalidate: 60 + conditional headers (safe; no private data).

16) Buddy Feature: Rules

One buddy per user (MVP).

Buddy sees owner’s checkins ✔/✖ only, not habit notes or metadata beyond title/emoji.

Either party can remove the connection; no group chats.

“👏 vibe” is a single daily toggle; store as ephemeral (buddy_vibes (date, from, to)).

17) Copy Deck (tiny)

CTA (landing): “Start your streak”

After check-in: “nice.”

Streak broken: “restart.”

Privacy hint: “Private by default. Share only if you want.”

Buddy invite: “Bring one buddy. Just ✔/✖—no details.”

18) Risk List & Mitigations

Auth callback misconfig: double-check allowed URLs in Supabase.

RLS mistakes: add tests that verify forbidden reads fail (buddy/public).

Timezones & “day”: client supplies local YYYY-MM-DD. Consider deriving server-side via user TZ later.

OG image perf: pre-generate or cache aggressively if needed.

Abuse: rate limit POST routes; captcha if abuse observed.

19) Definition of Done (MVP)

A new user can: sign up (magic link) → create 1–5 habits → check off days on both dashboard and habit page → see streak → optionally make a public streak card → optionally add one buddy who sees ✔/✖.

All table access paths enforced by RLS; no sensitive data leaks.

CI runs unit + e2e (happy path).

Deployed to production domain with correct Auth redirects.

20) What I’ve Already Added for You

Landing page (Gen-Z minimalist)

Supabase SSR scaffolding (client + server helpers, middleware, callback)

Signup/Login pages (magic link)

Dashboard skeleton

/new, /habit/[id], WeekStrip, /api/habit, /api/checkin