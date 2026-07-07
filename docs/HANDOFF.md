# RevFactor Scheduler — Handoff & Setup

Calendly-style **sales-call booking app** for RevFactor discovery calls, plus a **rep CRM dashboard** and a **sales FAQ**. A property owner picks a rep → sees their availability + profile → books a 15-min Google Meet call. Next.js + TypeScript + Tailwind + Prisma (Supabase Postgres) + NextAuth (Google).

- **Live:** https://schedule.revfactor.io — admin at `/admin` (Google login; super-admins only)
- **Deploy:** push to `main` → Vercel auto-deploys to production

---

## Get running on a new machine (~5 min)

You do **not** need to copy any files from the old machine — everything is in this repo or in the cloud.

```bash
git clone https://github.com/federzimer/revfactor-scheduler.git
cd revfactor-scheduler
npm install

# Pull env from Vercel (recreates .env.local: DATABASE_URL, Google OAuth, NEXTAUTH_SECRET, etc.)
npm i -g vercel        # if not installed
vercel login
vercel link            # select team "federico-zimermans-projects" → project "revfactor-scheduler"
vercel env pull .env.local --environment=production

npm run dev            # http://localhost:3000
```

Notes:
- **Admin login (`/admin`) only works on the production domain** (`schedule.revfactor.io`), not localhost or Vercel previews — Google OAuth callbacks are domain-locked. The **public booking page works locally** once `.env.local` has the DB + Google Calendar creds.
- Some env vars are Vercel **"sensitive"** and come back blank from `vercel env pull` (e.g. `N8N_BOOKING_WEBHOOK_URL`). That's expected; the live deployment still has the real values.

## Infrastructure map

| Piece | Where |
|---|---|
| Code | GitHub `federzimer/revfactor-scheduler` |
| Hosting | Vercel — project `revfactor-scheduler`, team `federico-zimermans-projects`, domain `schedule.revfactor.io` |
| Database | Supabase project **"RevFactor Scheduler"**, ref `rhtswmtjvuclrxycuffg` (⚠️ NOT blackbird-hq / RevFactorCFO) |
| Emails | n8n `n8n.blackbirdhm.com`, workflow **"RevFactor Booking Reminders"** (`BV8oWYx3lxbTpX6x`) → confirmation + 24h + 1h reminders via Gmail SMTP, From `notifications@revfactor.io` |

## ⚠️ Gotchas (read before touching the DB or deploying)

- **NEVER run `prisma db push` against prod.** The DB has drifted: live PascalCase tables (`User`, `Booking`, …) coexist with legacy snake_case tables (`bookings`, `weekly_availability`, …) that still hold rows. `db push` wants to DROP them. **Schema changes = additive SQL** in [`prisma/migrations_manual/`](../prisma/migrations_manual), applied to prod via the Supabase SQL editor / MCP. Then update `schema.prisma` to match.
- **RLS is enabled** on all app tables. The app works because Prisma connects as the `postgres` role (bypasses RLS). Don't expect app queries to honor RLS policies; don't add restrictive policies expecting the app to follow them.
- **Data-URL avatars** (`User.image`, ~256² JPEG from the cropper) are deliberately kept OUT of `/api/slots` and served once via `/api/hosts`, so the public booking page stays small.
- **`bookable` flag** (`User.bookable`) controls who appears in the scheduler, independent of `active` (which gates admin sign-in).

## Key concepts

- **Booking flow:** `host → date → time → form → confirmed`. `/api/slots` and `/api/available-dates` accept `?userId=` to scope to one rep; omit it for "any host". The confirmed screen embeds the YouTube explainer.
- **Roles:** `User.role` = `super_admin | user`; `User.active` gates login (bootstrap allowlist = `ADMIN_EMAILS`). Super-admins: Federico, Gaston. Bookable reps: Emily, Ethan.
- **Emails:** `/api/book` fire-and-forwards each confirmed booking to `N8N_BOOKING_WEBHOOK_URL`; n8n owns delivery + reminder scheduling.

## Current state & backlog

**Live:** person-first booking, rep profiles (upload+crop), `bookable` control, CRM dashboard (lead email + expandable detail + editable notes + date range), rep FAQ (seeded from call transcripts), confirmation video, RLS + input-validation hardening.

**Open / next:**
1. **Migrate transactional email off Gmail SMTP → Resend or Postmark** (+ SPF/DKIM/DMARC on `revfactor.io`). Gmail SMTP causes delays/throttling/deliverability risk. Highest-value next step.
2. **Confirmation video in the email** — HTML snippet ready (poster → YouTube link); paste into the n8n confirmation node, or do it during the email migration.
3. **Granola → auto lead notes** — add a `Booking.callSummary` field; match Granola notes to bookings by rep + call time; feed via Zapier/n8n.
4. **Dated follow-up reminders** — no `FollowUp` model yet (current notes are free-text, unscheduled).
5. **Tests** — none yet. Admin write paths are verified by build + review, not live click-through.

## Conventions
- Work on a branch → PR → squash-merge to `main` (auto-deploys). `npm run build` before merging.
- One-off data scripts live in [`scripts/`](../scripts) (e.g. `seed-faqs.mjs`, run with `node --env-file=.env.local`).
